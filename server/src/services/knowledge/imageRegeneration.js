import prisma from '../../config/db.js';
import { getDeviceAiConfig } from '../ai/deviceConfig.js';
import { generateImage } from '../ai/gemini.js';
import { checkLocalText } from '../localSecurity.js';
import { uploadBase64 } from '../oss.js';
import { fail, textValue } from './policy.js';
import { nodeImageScope } from './nodeImageScope.js';

/** 校验编辑快照，只允许为当前草稿节点生成候选图片。 */
async function imageSource(input) {
  const treeId = textValue(input.treeId, '知识树', 100);
  const nodeId = textValue(input.nodeId, '节点', 100);
  const node = await prisma.knowledgeNode.findFirst({ where: { id: nodeId, treeId }, include: { tree: true, asset: true } });
  if (!node) fail(404, '树节点不存在，请刷新知识树');
  if (node.tree.status !== 'draft') fail(409, '请先撤回为草稿再生成');
  if (input.expectedAssetKey !== node.assetKey || input.revision !== node.tree.revision) {
    fail(409, '节点内容已变更，请刷新后再生成');
  }
  if (node.asset.leaseUntil > new Date()) fail(409, '这个节点正在生成，请完成后再重新生图');
  return node;
}

/** 复用原模板与模型生成图片预览，不修改节点、共享资源或解读文字。 */
export async function regenerateNodeImage(input, adminId) {
  const node = await imageSource(input);
  const nodes = await prisma.knowledgeNode.findMany({ where: { treeId: node.treeId }, select: { id: true, parentId: true, label: true, order: true } });
  const parent = node.parentId ? nodes.find(item => item.id === node.parentId) : null;
  if (node.parentId && !parent) fail(409, '父节点不存在，请刷新知识树');
  const imageScope = nodeImageScope(node, nodes, parent?.label);
  if (!checkLocalText(`${imageScope.query}\n${imageScope.context}`).isSafe) fail(422, '这个请求需要换一种合适的表达');
  const { promptStyle, configMap } = await getDeviceAiConfig(undefined, prisma);
  const image = await generateImage(imageScope.query, promptStyle, configMap, undefined, imageScope.context);
  const imageUrl = await uploadBase64(image, 'knowledge', adminId);
  // 生图可能耗时较长；生成期间树被发布、删除或修改时，不返回过期候选图。
  await imageSource(input);
  return { imageUrl };
}
