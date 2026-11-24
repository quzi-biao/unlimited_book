import { createHash } from 'node:crypto';
import { normalizeChildRegions } from './childRegions.js';
import { visibleKnowledgeNodes } from './nodeVisibility.js';

/** 统一领域错误，交给 Express 错误处理器。 */
export function fail(status, message) { throw Object.assign(new Error(message), { status }); }

/** 规范化输入；保留语义大小写以外的有效内容。 */
export function normalize(value) { return String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' '); }

/** 有界字符串校验，不把对象隐式转换成文本。 */
export function textValue(value, name, max = 2000) {
  if (typeof value !== 'string' || !normalize(value) || value.length > max) fail(400, `${name}格式不正确`);
  return normalize(value);
}

/** 稳定序列化；对象字段顺序不影响身份，数组顺序保留路径含义。 */
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}

/** 递归父内容标识使相同请求在不同路径上得到不同键。 */
export function contentIdentity({ parentKey = null, lineage, replacementFor, action, query, cropHash = null, language = 'zh', style = 'book', version = '1', level = 'general', modality = 'image', purpose = 'explore', difficulty = 'concrete-example' }) {
  if (!['text', 'crop', 'curated', 'legacy'].includes(action)) fail(400, '未知探索方式');
  const identity = { schema: 1, parentKey, ...(lineage ? { lineage } : {}), ...(replacementFor ? { replacementFor } : {}), action, query: normalize(query), cropHash, language, style, version, level, modality, purpose, difficulty, size: '1536x864' };
  return { identity, key: createHash('sha256').update(canonical(identity)).digest('hex') };
}

/** 未声明年龄的设备按未成年人边界处理，不接受客户端自报模式绕过。 */
export function isMinor(profile) { return profile.ageBand !== 'adult'; }

/** 只有读者选择无限模式后，探索请求才能进入生成流程。 */
export function assertGeneration(profile) {
  if (profile.mode !== 'infinite') fail(403, '安全模式只能探索已发布的公共知识树');
}

/**
 * 验证知识树可公开；默认要求所有子节点都有人工绘制的跳转区域。
 * @param {Array} nodes 树节点及其图文资源
 * @param {{requireChildRegions?: boolean}} options 仅本地示例种子可跳过交互标注
 * @returns {void}
 */
export function validateTree(nodes, { requireChildRegions = true } = {}) {
  if (!nodes.length) fail(400, '空知识树不能发布');
  const map = new Map(nodes.map(n => [n.id, n]));
  const childrenByParent = new Map();
  for (const node of nodes) {
    if (!node.parentId) continue;
    const children = childrenByParent.get(node.parentId) || [];
    children.push(node.id);
    childrenByParent.set(node.parentId, children);
  }
  for (const node of nodes) {
    let cursor = node; const seen = new Set();
    while (cursor) {
      if (seen.has(cursor.id)) fail(400, '知识树存在循环');
      seen.add(cursor.id);
      if (cursor.parentId && !map.has(cursor.parentId)) fail(400, '父节点必须位于同一棵树');
      cursor = map.get(cursor.parentId);
    }
  }
  for (const node of nodes) if (node.active !== undefined && typeof node.active !== 'boolean') fail(400, '节点启用状态无效');
  const visibleNodes = visibleKnowledgeNodes(nodes, { filterRegions: false });
  const visibleIds = new Set(visibleNodes.map(node => node.id));
  if (!visibleNodes.some(node => !node.parentId)) fail(400, '知识树至少需要一个启用的根节点');
  for (const node of visibleNodes) {
    if (node.asset?.state !== 'ready' || node.asset?.reviewStatus !== 'approved' || !node.asset?.imageUrl || !node.asset?.explanations?.[node.asset.language]) fail(400, '发布前须审核所有启用节点的图片与解读');
    const childIds = childrenByParent.get(node.id) || [];
    const regions = normalizeChildRegions(node.childRegions || [], childIds);
    const visibleChildIds = childIds.filter(id => visibleIds.has(id));
    if (requireChildRegions && visibleChildIds.some(id => !regions.some(region => region.childNodeId === id))) fail(400, `发布前须为“${node.label}”的每个子节点标注跳转区域（停用子节点除外）`);
  }
}

/** 只允许图片／音频 URL，拒绝脚本及任意 HTML。 */
export function assetUrl(value) {
  const url = textValue(value, '资源地址', 2000);
  if (!/^https?:\/\//.test(url) && !/^\/(api\/local-(?:assets|uploads)\/|knowledge\/)/.test(url)) fail(400, '资源地址必须是 HTTP 图片或本地资源路径');
  return url;
}

/** 月份按 UTC 计算，跨设备使用同一个权益边界。 */
export function monthPeriod(now = new Date()) {
  return { period: now.toISOString().slice(0, 7), expiresAt: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)) };
}
