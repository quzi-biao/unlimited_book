/** 将已生成的首层图片增量发布到生产 OSS 和共享话题缓存，不修改用户书页。 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import prisma from '../src/config/db.js';
import OSS from 'ali-oss';

const folder = process.argv[2];
const execute = process.argv.includes('--execute');

/** 原子写入可恢复的发布记录。@returns {Promise<void>} */
async function writeReport(report) {
  const target = path.join(folder, 'published.json');
  await fs.writeFile(target + '.tmp', JSON.stringify(report, null, 2), { mode: 0o600 });
  await fs.rename(target + '.tmp', target);
}

/** 校验图片清单、先备份映射，再上传并按旧版本条件更新共享缓存。@returns {Promise<void>} */
async function main() {
  if (!folder || !path.isAbsolute(folder)) throw new Error('需要绝对发布目录');
  if (process.env.LOCAL_UPLOAD_DIR) throw new Error('生产发布必须使用 OSS，不能使用本地上传目录');
  const source = JSON.parse(await fs.readFile(path.join(folder, 'manifest.json'), 'utf8'));
  const names = source.items.map(i => i.topicName);
  if (new Set(names).size !== names.length) throw new Error('重复话题');
  const topics = await prisma.topic.findMany({ where: { name: { in: names } }, select: { name: true } });
  if (topics.length !== names.length) throw new Error('生产话题清单与来源不一致');
  for (const item of source.items) {
    if (path.basename(item.filename) !== item.filename) throw new Error('无效文件名');
    const bytes = await fs.readFile(path.join(folder, 'images', item.filename));
    if (crypto.createHash('sha256').update(bytes).digest('hex') !== item.sha256) throw new Error('图片校验失败: ' + item.topicName);
    const meta = await sharp(bytes).metadata();
    if (meta.format !== item.format || !meta.width || !meta.height) throw new Error('图片格式校验失败');
  }
  console.log(JSON.stringify({ event: 'validated', topics: names.length, execute }));
  if (!execute) return;
  let report;
  try { report = JSON.parse(await fs.readFile(path.join(folder, 'published.json'), 'utf8')); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const before = await prisma.topicCache.findMany({ where: { topicName: { in: names } } });
    await fs.writeFile(path.join(folder, 'topic-caches-before.json'), JSON.stringify(before, null, 2), { flag: 'wx', mode: 0o600 });
    report = { createdAt: new Date().toISOString(), items: [], status: 'running' };
    await writeReport(report);
  }
  const before = JSON.parse(await fs.readFile(path.join(folder, 'topic-caches-before.json'), 'utf8'));
  const oss = new OSS({ endpoint: process.env.OSS_ENDPOINT, accessKeyId: process.env.OSS_KEY_ID, accessKeySecret: process.env.OSS_KEY_SECRET, bucket: process.env.OSS_BUCKET, timeout: '120s' });
  for (const item of source.items) {
    let saved = report.items.find(i => i.topicName === item.topicName && i.sha256 === item.sha256);
    if (saved?.status === 'published') {
      const live = await prisma.topicCache.findUnique({ where: { topicName: item.topicName } });
      if (live?.imageUrl !== saved.imageUrl) throw new Error('已发布缓存发生变化，需人工核对: ' + item.topicName);
      continue;
    }
    try {
      if (!saved?.imageUrl) {
        const bytes = await fs.readFile(path.join(folder, 'images', item.filename));
        const ext = item.format === 'jpeg' ? 'jpg' : item.format;
        // 内容哈希作为稳定路径，重试不会产生重复对象；保留历史资源不覆盖。
        const objectKey = 'flipbook/prepared-topics/' + item.sha256 + '.' + ext;
        await oss.put(objectKey, bytes, { headers: { 'Content-Type': 'image/' + item.format, 'x-oss-object-acl': 'public-read' } });
        const imageUrl = 'https://' + process.env.OSS_BUCKET + '.' + process.env.OSS_ENDPOINT + '/' + objectKey;
        const response = await fetch(imageUrl, { signal: AbortSignal.timeout(30000) });
        if (!response.ok) throw new Error('OSS 读取失败: ' + response.status);
        const actual = Buffer.from(await response.arrayBuffer());
        if (crypto.createHash('sha256').update(actual).digest('hex') !== item.sha256) throw new Error('OSS 内容校验不一致');
        if (saved) Object.assign(saved, { imageUrl, status: 'uploaded' });
        else { saved = { topicName: item.topicName, sha256: item.sha256, imageUrl, status: 'uploaded' }; report.items.push(saved); }
        await writeReport(report);
      }
      const data = { imageUrl: saved.imageUrl, promptText: item.promptText, promptMd5: item.promptMd5 };
      const current = await prisma.topicCache.findUnique({ where: { topicName: item.topicName } });
      if (current?.imageUrl !== saved.imageUrl) {
        const old = before.find(i => i.topicName === item.topicName);
        if (old) {
          const result = await prisma.topicCache.updateMany({
            where: { id: old.id, imageUrl: old.imageUrl, promptMd5: old.promptMd5 }, data,
          });
          if (result.count !== 1) throw new Error('生产缓存已由其他任务改变，需人工核对');
        } else if (current) throw new Error('发布期间线上创建了此缓存，需人工核对');
        else await prisma.topicCache.create({ data: { topicName: item.topicName, ...data } });
      }
      saved.status = 'published';
      saved.publishedAt = new Date().toISOString();
      delete saved.error;
      await writeReport(report);
      console.log(JSON.stringify({ event: 'published', topic: item.topicName, completed: report.items.filter(i => i.status === 'published').length, total: source.items.length }));
    } catch (error) {
      if (!saved) { saved = { topicName: item.topicName, sha256: item.sha256, status: 'failed' }; report.items.push(saved); }
      saved.error = error.message;
      report.status = 'failed';
      await writeReport(report);
      throw error;
    }
  }
  report.status = 'completed';
  await writeReport(report);
  console.log(JSON.stringify({ event: 'finished', status: report.status, published: report.items.length }));
}
try { await main(); }
catch (error) { console.error(error.message); process.exitCode = 1; }
finally { await prisma.$disconnect(); }
