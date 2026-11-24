import { contentIdentity } from './policy.js';

/** 将已校验的规划结构写入草稿，并复用之前规划留下的同标识图文资源。
 * @param {object} tx Prisma 事务客户端
 * @param {object} tree 目标知识树
 * @param {Array} outline 已校验的父节点优先结构
 * @param {boolean} incrementRevision 是否递增树版本
 * @returns {Promise<object>} 更新后的树和节点
 */
export async function addOutlineNodes(tx, tree, outline, incrementRevision = false) {
  const ids = new Map();
  const assetKeys = new Map();
  const offset = await tx.knowledgeNode.count({ where: { treeId: tree.id } });
  for (const [order, item] of outline.entries()) {
    const parentKey = item.parentId ? assetKeys.get(item.parentId) : null;
    const identity = contentIdentity({ parentKey, query: item.title, action: 'curated', version: `admin-outline:${tree.id}` });
    await tx.knowledgeAsset.upsert({
      where: { key: identity.key },
      create: {
        ...identity,
        parentKey,
        action: 'curated',
        title: item.title,
        domain: item.domain,
        imageUrl: '',
        explanations: {},
        anchors: [],
        language: 'zh',
        modality: 'image',
        state: 'pending',
        reviewStatus: 'pending',
      },
      update: {},
    });
    const node = await tx.knowledgeNode.create({ data: {
      treeId: tree.id,
      parentId: item.parentId ? ids.get(item.parentId) : null,
      assetKey: identity.key,
      label: item.title,
      domain: item.domain,
      relation: item.relation,
      order: offset + order,
    } });
    ids.set(item.id, node.id);
    assetKeys.set(item.id, identity.key);
  }
  if (incrementRevision) await tx.knowledgeTree.update({ where: { id: tree.id }, data: { revision: { increment: 1 } } });
  return tx.knowledgeTree.findUnique({ where: { id: tree.id }, include: { nodes: { include: { asset: true }, orderBy: { order: 'asc' } } } });
}
