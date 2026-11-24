import { contentIdentity, fail } from './policy.js';

/** 重置当前节点的图文版本，保留旧资源和树内其他节点的引用。 */
export async function resetNodeContent(tx, tree, node, input) {
  if (input.expectedAssetKey !== node.assetKey || input.revision !== tree.revision) {
    fail(409, '节点内容已变更，请刷新后再重置');
  }
  if (node.asset.state !== 'ready') fail(409, '当前节点尚未生成图文');
  if (node.asset.leaseUntil > new Date()) fail(409, '这个节点正在生成，请完成后再重置');
  const parent = node.parentId
    ? await tx.knowledgeNode.findFirst({ where: { id: node.parentId, treeId: tree.id } })
    : null;
  const identity = contentIdentity({
    parentKey: parent?.assetKey,
    action: 'curated',
    query: node.label,
    replacementFor: node.assetKey,
    version: `admin-reset:${tree.id}:${node.id}:${tree.revision}`,
  });
  const asset = await tx.knowledgeAsset.create({ data: {
    ...identity,
    parentKey: parent?.assetKey,
    action: 'curated',
    title: node.label,
    domain: node.domain,
    imageUrl: '',
    explanations: {},
    anchors: [],
    language: 'zh',
    modality: node.asset.modality,
    state: 'pending',
    reviewStatus: 'pending',
  } });
  await tx.knowledgeNode.update({ where: { id: node.id }, data: { assetKey: asset.key, childRegions: [] } });
  await tx.knowledgeTree.update({ where: { id: tree.id }, data: { revision: { increment: 1 } } });
  return tx.knowledgeNode.findUnique({ where: { id: node.id }, include: { asset: true } });
}
