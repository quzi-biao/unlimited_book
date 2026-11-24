/** 抛出带 HTTP 状态码的区域校验错误。 */
function fail(status, message) {
  throw Object.assign(new Error(message), { status });
}

/** 校验图片上的归一化手绘区域。 */
export function normalizeChildRegionBox(region) {
  if (!region || typeof region !== 'object' || Array.isArray(region)) fail(400, '框选区域格式不正确');
  const { x, y, w, h } = region;
  if (![x, y, w, h].every(Number.isFinite) || x < 0 || y < 0 || w < 0.01 || h < 0.01 || x + w > 1.000001 || y + h > 1.000001) {
    fail(400, '框选区域须位于图片范围内');
  }
  return { x, y, w, h };
}

/** 验证父图上的人工热点仅指向直接子节点，并使用归一化坐标保存。 */
export function normalizeChildRegions(regions, directChildIds) {
  if (!Array.isArray(regions) || regions.length > directChildIds.length) fail(400, '子节点区域格式不正确');
  const children = new Set(directChildIds);
  const seen = new Set();
  return regions.map(region => {
    if (!region || typeof region !== 'object' || Array.isArray(region)) fail(400, '子节点区域格式不正确');
    const { childNodeId, label } = region;
    if (typeof childNodeId !== 'string' || !children.has(childNodeId)) fail(400, '跳转目标必须是当前节点的直接子节点');
    if (seen.has(childNodeId)) fail(400, '每个子节点只能标注一个区域');
    const box = normalizeChildRegionBox(region);
    if (label !== undefined && (typeof label !== 'string' || label.length > 100)) fail(400, '跳转区域名称格式不正确');
    seen.add(childNodeId);
    return { childNodeId, ...(label?.trim() ? { label: label.trim() } : {}), ...box };
  });
}

/** 将视觉模型识别的直接子节点序号映射为树内节点 ID。 */
export function normalizeChildRegionIdentification(result, children) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) fail(502, 'AI 未返回有效的识别结果');
  const { childIndex, confidence } = result;
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) fail(502, 'AI 返回了无效的识别置信度');
  if (childIndex === null || confidence < 0.45) return { childNodeId: null, confidence };
  if (!Number.isInteger(childIndex) || childIndex < 0 || childIndex >= children.length) fail(502, 'AI 识别结果指向了未知子节点');
  return { childNodeId: children[childIndex].id, confidence };
}

