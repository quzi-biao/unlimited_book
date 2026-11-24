import { fail } from './policy.js';

/** 当前探索上下文来自个人树；图片的原始生成血缘仅用于追溯，不能覆盖修正后的挂接。 */
export async function readerPath(db, profileId, node, asset) {
  const ancestors = [];
  const keys = [node.assetKey];
  const seen = new Set([node.id]);
  let current = node;
  let source = asset;
  let changed = false;
  while (current.parentId && ancestors.length < 16) {
    const parent = await db.readerNode.findFirst({ where: { id: current.parentId, profileId, deletedAt: null }, include: { asset: true } });
    if (!parent || seen.has(parent.id)) fail(409, '知识树路径需要修复，请同步后重试');
    seen.add(parent.id);
    const asset = parent.asset;
    if (source.parentKey !== asset.key) changed = true;
    ancestors.unshift({ title: asset.title, action: asset.action, summary: asset.explanations?.[asset.language]?.slice(0,240) });
    keys.unshift(asset.key);
    current = parent;
    source = asset;
  }
  if (!current.parentId && source.parentKey) changed = true;
  return { ancestors, keys, changed };
}
