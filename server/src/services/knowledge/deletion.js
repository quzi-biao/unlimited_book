import prisma from '../../config/db.js';
import { fail } from './policy.js';

/** 所有个人树写入按同一读者锁串行；删除后旧生成任务不能重新挂回节点。 */
export async function assertTreeRevision(db, profileId, revision) {
  await db.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${profileId}))::text`;
  const current = await db.readerProfile.findUnique({ where: { id: profileId } });
  if (!current || current.treeRevision !== revision) fail(409, '知识树已更新，请同步后重新发起探索');
}

/** 删除只作用于个人生成节点；保留共享图片及删除标记，单页删除将直接子节点提升一层。 */
export async function deleteReaderNode(profile, key, input, db = prisma) {
  if (!['node','branch'].includes(input.scope)) fail(400, '请选择删除这一页或整条分枝');
  if (!Number.isInteger(input.treeRevision)) fail(400, '缺少知识树版本，请同步后重试');
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${profile.id}))::text`;
    const root = await tx.readerNode.findUnique({ where: { profileId_assetKey: { profileId: profile.id, assetKey: key } }, include: { asset: true } });
    if (!root) fail(404, '这个节点不在你的知识树中');
    if (root.deletedAt) return { deletedKeys: [key] };
    await assertTreeRevision(tx, profile.id, input.treeRevision);
    const nodes = await tx.readerNode.findMany({ where: { profileId: profile.id, deletedAt: null }, include: { asset: true } });
    const selected = new Set([root.id]);
    if (input.scope === 'branch') {
      const queue = [root.id];
      for (let i=0;i<queue.length;i++) for (const node of nodes) {
        if (node.parentId === queue[i] && !selected.has(node.id)) { selected.add(node.id); queue.push(node.id); }
      }
    }
    const removed = nodes.filter(n => selected.has(n.id));
    const keys = removed.map(n => n.assetKey);
    if (removed.some(n => n.globalNodeId || n.treeId || !['text','crop'].includes(n.asset.action))
      || await tx.knowledgeNode.count({ where: { assetKey: { in: keys } } })) fail(403, '只能删除个人生成的节点，公共知识树和原图册请从各自入口管理');
    if (input.scope === 'node') await tx.readerNode.updateMany({
      where: { profileId: profile.id, deletedAt: null, parentId: root.id }, data: { parentId: root.parentId },
    });
    await tx.readerNode.updateMany({ where: { profileId: profile.id, id: { in: [...selected] } }, data: { deletedAt: new Date() } });
    await tx.readerProfile.update({ where: { id: profile.id }, data: { treeRevision: { increment: 1 } } });
    return { deletedKeys: keys };
  }, { timeout: 30000 });
}

/** 删除的个人节点不再出现在学习足迹和导出中，连接到已删除节点的事件也隐藏。 */
export function visibleEvents(events, nodes) {
  const byId = new Set(nodes.map(n => n.id)), keys = new Set(nodes.map(n => n.assetKey));
  return events.filter(e => byId.has(e.nodeId) && (e.type !== 'connect' || keys.has(e.payload?.targetId)));
}
