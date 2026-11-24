import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import prisma from '../src/config/db.js';

/** 只按已核对的节点清单解除个人树误挂接，保存完整备份；不改内容身份、子节点及学习记录。 */
export async function repairReaderRoots(db, plan, { apply = false, backupFile } = {}) {
  assert(typeof plan.profileId === 'string' && plan.nodes?.length, '修复清单缺少读者或节点');
  assert.equal(new Set(plan.nodes.map(n => n.id)).size, plan.nodes.length, '清单节点重复');
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${plan.profileId}))::text`;
    const before = await tx.readerNode.findMany({ where: { profileId: plan.profileId }, orderBy: { id: 'asc' } });
    const byId = new Map(before.map(n => [n.id,n]));
    const assets = await tx.knowledgeAsset.findMany({ where: { key: { in: before.map(n => n.assetKey) } }, orderBy: { key: 'asc' } });
    const byKey = new Map(assets.map(a => [a.key,a]));
    const changed = [];
    for (const target of plan.nodes) {
      const node = byId.get(target.id), parent = byId.get(target.expectedParentId);
      assert(node && parent, '清单中的节点或父节点不属于该读者');
      assert.equal(node.assetKey, target.assetKey, '节点内容与核对清单不符');
      assert.equal(parent.assetKey, target.expectedParentKey, '原父节点内容与清单不符');
      assert(!node.globalNodeId && !node.treeId, '不能通过个人树修复脚本改公共节点');
      const asset = byKey.get(node.assetKey);
      assert.equal(asset.action, 'text', '只修复已确认的独立文字话题');
      assert.equal(asset.identity.query, target.query, '原始请求与清单不符');
      assert(node.parentId === null || node.parentId === parent.id, '节点挂接已变化，停止修复');
      if (node.parentId !== null) changed.push(node);
    }
    if (!apply || !changed.length) return { applied: false, changed: changed.map(n => n.id) };
    assert(backupFile, '必须先指定备份路径');
    const events = await tx.learningEvent.findMany({ where: { profileId: plan.profileId }, orderBy: { id: 'asc' } });
    await mkdir(dirname(backupFile), { recursive: true });
    await writeFile(backupFile, JSON.stringify({ savedAt: new Date().toISOString(), plan, nodes: before, assets, events },null,2), { flag: 'wx', mode: 0o600 });
    for (const node of changed) {
      const result = await tx.readerNode.updateMany({ where: { id: node.id, profileId: plan.profileId, parentId: node.parentId }, data: { parentId: null } });
      assert.equal(result.count, 1, '节点已变化，整批回滚');
    }
    const changedIds = new Set(changed.map(n => n.id));
    const after = await tx.readerNode.findMany({ where: { profileId: plan.profileId }, orderBy: { id: 'asc' } });
    assert.deepEqual(after, before.map(n => changedIds.has(n.id) ? { ...n, parentId: null } : n));
    assert.deepEqual(await tx.knowledgeAsset.findMany({ where: { key: { in: before.map(n => n.assetKey) } }, orderBy: { key: 'asc' } }), assets);
    assert.deepEqual(await tx.learningEvent.findMany({ where: { profileId: plan.profileId }, orderBy: { id: 'asc' } }), events);
    return { applied: true, changed: changed.map(n => n.id), backupFile };
  }, { timeout: 30000 });
}

/** 手工运行只允许独立本机 knowledge 数据库，默认预览；应用前需要精确清单及唯一备份文件名。 */
async function main() {
  const database = new URL(process.env.DATABASE_URL);
  assert(['127.0.0.1','localhost'].includes(database.hostname) && database.pathname === '/knowledge', '仅允许本机 knowledge 库');
  const [manifest, backup, flag] = process.argv.slice(2);
  assert(manifest, '用法：node scripts/repair-reader-roots.js 清单.json 备份.json [--apply]');
  const plan = JSON.parse(await readFile(manifest, 'utf8'));
  console.log(JSON.stringify(await repairReaderRoots(prisma, plan, { apply: flag === '--apply', backupFile: backup && resolve(backup) })));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
}
