/** 云端删除标记同时清理离线快照、轨迹和连接；保留子枝时跨过已删父节点。 */
export function pruneDeleted(data) {
  if (!data) return data;
  const deleted = new Set(data.deletedKeys || []);
  const byKey = new Map((data.nodes || []).map(n => [n.assetKey,n]));
  const removedIds = new Set((data.nodes || []).filter(n => deleted.has(n.assetKey)).map(n => n.id));
  const nodes = (data.nodes || []).filter(n => !deleted.has(n.assetKey));
  return { ...data, nodes: nodes.map(n => {
    let parentKey=n.parentKey, parentId=n.parentId;
    const seen=new Set();
    while (deleted.has(parentKey) && !seen.has(parentKey)) {
      seen.add(parentKey);const parent=byKey.get(parentKey);
      parentKey=parent?.parentKey || null;parentId=parent?.parentId || null;
    }
    return {...n,parentKey,parentId};
  }), events: (data.events || []).filter(e => !removedIds.has(e.nodeId) && !deleted.has(e.assetKey) && !deleted.has(e.payload?.targetId)),
    connections: (data.connections || []).filter(c => !deleted.has(c.sourceKey) && !deleted.has(c.targetKey)),
    corrections: (data.corrections || []).filter(c => !deleted.has(c.assetKey)),
  };
}

/** 删除后旧探索结果和从已删页面发起的任务不能通过队列重新打开。 */
export function pruneJobs(jobs, deletedKeys) {
  const removed = new Set(deletedKeys || []);
  return (jobs || []).filter(job => !removed.has(job.assetKey) && !removed.has(job.input?.parentKey));
}
