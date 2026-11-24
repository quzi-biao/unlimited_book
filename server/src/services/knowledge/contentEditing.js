import { assetUrl, contentIdentity, fail } from './policy.js';

/** 创建当前节点的独立图文版本；共享资源和既有读者记录保留原内容。 */
export async function editNodeContent(tx, tree, node, input, metadata) {
  if (input.expectedAssetKey !== node.assetKey || input.revision !== tree.revision) {
    fail(409, '节点内容已变更，请刷新后再编辑');
  }
  if (node.asset.leaseUntil > new Date()) fail(409, '这个节点正在生成，请生成完成后再编辑图文');
  const imageUrl = assetUrl(input.imageUrl ?? node.asset.imageUrl);
  const explanation = input.explanation ?? node.asset.explanations?.zh;
  if (typeof explanation !== 'string' || !explanation.trim() || explanation.length > 16000) fail(400, '中文解读需为 1 至 16000 个字符');
  const anchors = input.anchors ?? node.asset.anchors;
  if (!Array.isArray(anchors) || anchors.length > 20 || anchors.some(item => typeof item !== 'string' || !item.trim() || item.length > 120)) {
    fail(400, '探索问题最多 20 条，每条需为 1 至 120 个字符');
  }
  const text = explanation.trim();
  const questions = anchors.map(item => item.trim());
  if (imageUrl === node.asset.imageUrl && text === node.asset.explanations?.zh && JSON.stringify(questions) === JSON.stringify(node.asset.anchors)) {
    return node.assetKey;
  }
  const parent = node.parentId ? await tx.knowledgeNode.findFirst({ where: { id: node.parentId, treeId: tree.id } }) : null;
  const title = metadata.label ?? node.label;
  const identity = contentIdentity({ parentKey: parent?.assetKey, action: 'curated', query: title,
    replacementFor: node.assetKey, version: `admin-edit:${tree.id}:${node.id}:${tree.revision}` });
  const asset = await tx.knowledgeAsset.create({ data: {
    ...identity, parentKey: parent?.assetKey, action: 'curated', title, domain: metadata.domain ?? node.domain,
    imageUrl, explanations: { zh: text }, anchors: questions, language: 'zh', modality: node.asset.modality,
    state: 'ready', reviewStatus: 'pending', audio: {},
  } });
  return asset.key;
}
