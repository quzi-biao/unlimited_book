import { contentIdentity, fail } from './policy.js';
import { assertTreeRevision } from './deletion.js';

/** 用户在同步删除结果后重新输入相同话题时生成新版本；旧客户端与旧任务不能恢复已删除节点。 */
export async function availableIdentity(db, profileId, identity, allowReplacement) {
  for (let i=0;i<100;i++) {
    const existing = await db.readerNode.findUnique({ where: { profileId_assetKey: { profileId, assetKey: identity.key } } });
    if (!existing?.deletedAt) return identity;
    if (!allowReplacement) fail(410, '这页已删除，请同步知识树后重新搜索');
    identity = contentIdentity({ ...identity.identity, replacementFor: identity.key });
  }
  fail(409, '这个话题已多次重新生成，请换一种描述');
}

/** 与删除共享事务锁；途中删除父节点或分枝时，生成结束后不会出现悬空子节点。 */
export async function attachGeneratedNode(db, profileId, assetKey, parentId, revision) {
  await assertTreeRevision(db, profileId, revision);
  if (parentId && !await db.readerNode.findFirst({ where: { id: parentId, profileId, deletedAt: null } })) fail(410, '父节点已删除，请从知识树重新开始');
  const existing = await db.readerNode.findUnique({ where: { profileId_assetKey: { profileId, assetKey } } });
  if (existing?.deletedAt) fail(410, '这页已删除，请从知识树重新开始');
  return db.readerNode.upsert({ where: { profileId_assetKey: { profileId, assetKey } },
    create: { profileId, assetKey, parentId: parentId || null }, update: {} });
}
