/**
 * 本地话题首层预生成：沿用项目模型与提示词，只填共享缓存，不生成子页或扣设备点数。
 * 默认只检查计划；--execute 才调用付费 API。进度保存在独立持久目录，可安全续跑。
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import prisma from '../src/config/db.js';
import { generateImage } from '../src/services/ai/gemini.js';
import { DEFAULT_IMAGE_SIZE } from '../src/services/ai/imageSize.js';
import { uploadBase64 } from '../src/services/oss.js';
import { buildMd5 } from '../src/services/hash.js';

const args = new Set(process.argv.slice(2));
const execute = args.has('--execute');
const concurrency = Number(process.argv.find(x => x.startsWith('--concurrency='))?.split('=')[1] || 2);
const limit = Number(process.argv.find(x => x.startsWith('--limit='))?.split('=')[1] || Infinity);
const stateRoot = '/app/topic-preparation';
const stateFile = path.join(stateRoot, 'progress.json');
let stopping = false;
let state;
let writing = Promise.resolve();
let failuresInRow = 0;

/** 只允许访问已核实的本地 Compose 数据库和本地资源目录。@returns {void} */
function assertLocal() {
  const db = new URL(process.env.DATABASE_URL || '');
  if (db.hostname !== 'postgres' || db.pathname !== '/flipbook' ||
      process.env.LOCAL_UPLOAD_DIR !== '/app/local-uploads') {
    throw new Error('仅允许在本地 flipbook Compose 环境预生成');
  }
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4) throw new Error('并发数只能为 1～4');
  if (!(limit > 0)) throw new Error('limit 必须大于 0');
}

/** 串行原子保存任务状态，恢复时不丢失已生成资源。@returns {Promise<void>} */
function checkpoint() {
  state.updatedAt = new Date().toISOString();
  state.counts = { total: state.items.length, completed: 0, pending: 0, running: 0, failed: 0 };
  for (const item of state.items) state.counts[item.status]++;
  const content = JSON.stringify(state, null, 2);
  writing = writing.then(async () => {
    const temp = stateFile + '.tmp';
    await fs.writeFile(temp, content, { mode: 0o600 });
    await fs.rename(temp, stateFile);
  });
  return writing;
}

/** 日志剔除可能出现的凭证，限制上游长报错。@returns {string} */
function errorText(error) {
  let message = String(error.message || error).slice(0, 1200);
  if (process.env.GPTIMAGE_API_KEY) message = message.split(process.env.GPTIMAGE_API_KEY).join('[redacted]');
  return message.replace(/Bearer\s+\S+/gi, 'Bearer [redacted]');
}

/** 将已保存的首层图写入全局话题缓存；不创建用户书架或页面。@returns {Promise<void>} */
async function saveCache(item) {
  const style = state.promptStyle;
  const promptText = (style.topicExploration || '$' + '{query}').replace(/\$\{query\}/g, item.name)
    + (style.unifiedStyle ? '\n\n' + style.unifiedStyle : '');
  await prisma.topicCache.upsert({
    where: { topicName: item.name },
    create: { topicName: item.name, promptText, promptMd5: buildMd5(promptText), imageUrl: item.imageUrl },
    update: {},
  });
}

/** 检查持久化图片仍可解码，避免将缺失文件误判为成功。@returns {Promise<object>} */
async function validateLocal(imageUrl) {
  if (!/^\/api\/local-uploads\/[a-zA-Z0-9._-]+$/.test(imageUrl)) throw new Error('预生成缓存必须指向本地图片');
  return sharp(path.join(process.env.LOCAL_UPLOAD_DIR, path.basename(imageUrl))).metadata();
}

/** 生成一个话题；失败只记录，不自动重试可能已经扣费的请求。@returns {Promise<void>} */
async function prepare(item) {
  item.status = 'running';
  item.attempts = (item.attempts || 0) + 1;
  item.startedAt = new Date().toISOString();
  await checkpoint();
  console.log(JSON.stringify({ event: 'start', topic: item.name, attempts: item.attempts }));
  try {
    const cached = await prisma.topicCache.findUnique({ where: { topicName: item.name } });
    if (cached) {
      item.imageUrl = cached.imageUrl;
      item.dimensions = await validateLocal(item.imageUrl).then(m => [m.width, m.height]);
    } else {
      // 已下载图片而数据库写入失败时，仅重试写库，不再调用模型。
      if (item.imageUrl) await validateLocal(item.imageUrl);
      else {
        const dataUrl = await generateImage(item.name, state.promptStyle, state.configMap, DEFAULT_IMAGE_SIZE);
        const bytes = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
        const meta = await sharp(bytes).metadata();
        item.dimensions = [meta.width, meta.height];
        item.imageUrl = await uploadBase64(dataUrl, 'pages', 'prepared-topics');
        await checkpoint();
      }
      await saveCache(item);
    }
    item.status = 'completed';
    item.completedAt = new Date().toISOString();
    delete item.error;
    failuresInRow = 0;
    await checkpoint();
    console.log(JSON.stringify({ event: 'completed', topic: item.name, dimensions: item.dimensions, ...state.counts }));
  } catch (error) {
    item.status = 'failed';
    item.error = errorText(error);
    failuresInRow++;
    const fatal = /unauthorized|invalid.*key|insufficient|quota|余额不足|额度不足|欠费|令牌.*无效|token.*invalid|HTTP (401|402|403)/i.test(item.error);
    if (fatal || failuresInRow >= 5) {
      stopping = true;
      state.stopReason = item.error;
    }
    await checkpoint();
    console.error(JSON.stringify({ event: 'failed', topic: item.name, error: item.error, stopping }));
  }
}

/** 加载快照、检查本地重置凭证，然后按限定并发运行。@returns {Promise<void>} */
async function main() {
  assertLocal();
  await fs.mkdir(stateRoot, { recursive: true, mode: 0o700 });
  const reset = JSON.parse(await fs.readFile(path.join(stateRoot, 'reset.json'), 'utf8'));
  if (!reset.verified || !reset.backup || reset.preserved.topics < 1) throw new Error('缺少已验证的本地备份/清空记录');
  try { state = JSON.parse(await fs.readFile(stateFile, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (!state) {
    const style = await prisma.promptStyle.findUnique({ where: { name: '酷炫科普风' } });
    if (!style) throw new Error('缺少现用提示词风格');
    const configs = await prisma.globalConfig.findMany({ where: { key: { in: ['model_image_gen'] } } });
    const topics = await prisma.topic.findMany({ include: { categoryRef: { select: { name: true, sortOrder: true, isActive: true } } } });
    // 与分类入口一致：停用分类的话题仍列在“其他”，本次全部准备。
    topics.sort((a, b) => (a.categoryRef?.sortOrder ?? 999) - (b.categoryRef?.sortOrder ?? 999) || a.createdAt - b.createdAt || a.id.localeCompare(b.id));
    state = {
      createdAt: new Date().toISOString(), mode: 'first-layer-only', size: DEFAULT_IMAGE_SIZE,
      model: style.imageModel, quality: 'low', backup: reset.backup,
      promptStyle: { imageModel: style.imageModel, topicExploration: style.topicExploration, unifiedStyle: style.unifiedStyle },
      configMap: Object.fromEntries(configs.map(c => [c.key, c.value])),
      items: topics.map(t => ({ id: t.id, name: t.name, category: t.categoryRef?.name || '其他', status: 'pending' })),
    };
  }
  for (const item of state.items) {
    if (item.status === 'running' || (args.has('--retry-failed') && item.status === 'failed')) item.status = 'pending';
  }
  state.status = execute ? 'running' : 'planned';
  state.stopReason = null;
  await checkpoint();
  console.log(JSON.stringify({ event: 'plan', execute, concurrency, size: state.size, model: state.model, ...state.counts }));
  if (!execute) return;
  let cursor = 0;
  const queue = state.items.filter(i => i.status === 'pending').slice(0, limit);
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (!stopping && cursor < queue.length) {
      const item = queue[cursor++];
      await prepare(item);
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }));
  state.status = stopping ? 'stopped' : state.items.every(i => i.status === 'completed') ? 'completed' : 'incomplete';
  await checkpoint();
  console.log(JSON.stringify({ event: 'finished', status: state.status, ...state.counts }));
  if (state.status === 'stopped') process.exitCode = 2;
}

process.on('SIGTERM', () => { stopping = true; });
process.on('SIGINT', () => { stopping = true; });
try { await main(); }
catch (error) { console.error(errorText(error)); process.exitCode = 1; }
finally { await prisma.$disconnect(); }
