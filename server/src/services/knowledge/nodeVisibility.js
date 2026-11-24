/** 返回启用且所有祖先也启用的节点，并移除指向隐藏子节点的跳转框。 */
export function visibleKnowledgeNodes(nodes, { filterRegions = true } = {}) {
  const byId = new Map(nodes.map(node => [node.id, node]));
  const visibleIds = new Set();
  for (const node of nodes) {
    if (node.active === false) continue;
    const seen = new Set();
    let cursor = node;
    let visible = true;
    while (cursor) {
      if (cursor.active === false || seen.has(cursor.id)) {
        visible = false;
        break;
      }
      seen.add(cursor.id);
      if (!cursor.parentId) break;
      cursor = byId.get(cursor.parentId);
      if (!cursor) visible = false;
    }
    if (visible) visibleIds.add(node.id);
  }
  return nodes.filter(node => visibleIds.has(node.id)).map(node => ({
    ...node,
    childRegions: !filterRegions
      ? node.childRegions
      : Array.isArray(node.childRegions)
      ? node.childRegions.filter(region => visibleIds.has(region.childNodeId))
      : [],
  }));
}

/** 隐藏锚定在停用全局节点下的个人节点及其个人后代。 */
export function visibleReaderNodes(nodes, hiddenGlobalIds) {
  const childrenByParent = new Map();
  for (const node of nodes) {
    if (!node.parentId) continue;
    const children = childrenByParent.get(node.parentId) || [];
    children.push(node.id);
    childrenByParent.set(node.parentId, children);
  }
  const hiddenIds = new Set(nodes.filter(node => node.globalNodeId && hiddenGlobalIds.has(node.globalNodeId)).map(node => node.id));
  const pending = [...hiddenIds];
  while (pending.length) {
    for (const childId of childrenByParent.get(pending.pop()) || []) {
      if (hiddenIds.has(childId)) continue;
      hiddenIds.add(childId);
      pending.push(childId);
    }
  }
  return nodes.filter(node => !hiddenIds.has(node.id));
}

/** 确认数据库中的节点和它的每个祖先都仍启用。 */
export async function hasActiveKnowledgePath(db, node) {
  const seen = new Set();
  let cursor = node;
  while (cursor) {
    if (cursor.active === false || seen.has(cursor.id)) return false;
    seen.add(cursor.id);
    if (!cursor.parentId) return true;
    cursor = await db.knowledgeNode.findUnique({
      where: { id: cursor.parentId },
      select: { id: true, treeId: true, parentId: true, active: true },
    });
    if (!cursor || cursor.treeId !== node.treeId) return false;
  }
  return false;
}

/** 同一图文可能被多个树引用，逐一寻找仍可用的节点路径。 */
export async function findActiveKnowledgeNode(db, where) {
  const candidates = await db.knowledgeNode.findMany({ where: { ...where, active: true }, include: { asset: true } });
  for (const node of candidates) if (await hasActiveKnowledgePath(db, node)) return node;
  return null;
}
