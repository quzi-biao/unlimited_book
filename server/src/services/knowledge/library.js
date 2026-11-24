import prisma from '../../config/db.js';
import { fail } from './policy.js';
import { publicProfile } from './readerAuth.js';
import { applyEvent, replayProgress } from './learning.js';
import { visibleEvents } from './deletion.js';
import { findActiveKnowledgeNode, hasActiveKnowledgePath, visibleKnowledgeNodes, visibleReaderNodes } from './nodeVisibility.js';

/** API 资源不暴露其他人的输入、作者身份或审核日志。 */
export function publicAsset(asset) {
  const { key, title, domain, imageUrl, explanations, audio, anchors, language, modality, reviewStatus } = asset;
  return { key, title, domain, imageUrl, explanations, audio, anchors, language, modality, reviewStatus, generated: !['curated', 'legacy'].includes(asset.action) };
}

/** 自动选择第一棵已发布树；服务器空库时明确返回空状态。 */
export async function selectedTree(profile, db = prisma) {
  const trees = await db.knowledgeTree.findMany({ where: { status: 'published' }, orderBy: { createdAt: 'asc' } });
  const tree = trees.find(t => t.id === profile.selectedTreeId) || trees[0];
  if (tree && tree.id !== profile.selectedTreeId) {
    await db.readerProfile.update({ where: { id: profile.id }, data: { selectedTreeId: tree.id } });
    profile.selectedTreeId = tree.id;
  }
  return { tree, trees };
}

/** 将全局暗节点与个人亮节点合成一张图；安全模式不返回未发布内容。 */
export async function librarySnapshot(profile, db = prisma) {
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${profile.id}))::text`;
    const fresh=await tx.readerProfile.findUnique({ where: { id: profile.id } });
    return snapshotData({...profile,treeRevision:fresh.treeRevision}, tx);
  }, { timeout: 30000 });
}

/** 与个人树删除锁一致，快照版本和节点集合必须来自同一次读取。 */
async function snapshotData(profile, db) {
  const { tree, trees } = await selectedTree(profile, db);
  const allPersonal = await db.readerNode.findMany({ where: { profileId: profile.id }, include: { asset: true }, orderBy: { createdAt: 'asc' } });
  const personal = allPersonal.filter(n => !n.deletedAt);
  const deletedKeys = allPersonal.filter(n => n.deletedAt).map(n => n.assetKey);
  const visitedGlobalIds = personal.map(node => node.globalNodeId).filter(Boolean);
  const sourceTreeIds = [...new Set([tree?.id, ...personal.map(node => node.treeId)].filter(Boolean))];
  const allGlobals = await db.knowledgeNode.findMany({ where: {
    OR: [{ treeId: { in: sourceTreeIds } }, { id: { in: visitedGlobalIds } }],
  }, include: { asset: true, tree: { select: { status: true } } }, orderBy: [{ treeId: 'asc' }, { order: 'asc' }] });
  const activeGlobals = visibleKnowledgeNodes(allGlobals);
  const globals = activeGlobals.filter(node => node.tree.status === 'published' && (node.treeId === tree?.id || visitedGlobalIds.includes(node.id)));
  const visibleGlobalIds = new Set(activeGlobals.map(n => n.id));
  const visibleKeys = new Set(globals.map(node => node.assetKey));
  const hiddenGlobalIds = new Set(allGlobals.filter(n => !visibleGlobalIds.has(n.id) && !visibleKeys.has(n.assetKey)).map(n => n.id));
  const visiblePersonal = visibleReaderNodes(personal, hiddenGlobalIds);
  const byKey = new Map(visiblePersonal.map(n => [n.assetKey, n]));
  const byId = new Map(visiblePersonal.map(n => [n.id, n]));
  const globalIds = new Map(globals.map(n => [n.id, n]));
  const globalKeys = new Set(globals.map(n => n.assetKey));
  const hiddenGlobalKeys = new Set(allGlobals.filter(n => !visibleGlobalIds.has(n.id) && !globalKeys.has(n.assetKey)).map(n => n.assetKey));
  const nodes = globals.map(n => ({ ...byKey.get(n.assetKey), id: byKey.get(n.assetKey)?.id || `g:${n.id}`, assetKey: n.assetKey,
    globalNodeId: n.id, treeId: n.treeId, parentKey: globalIds.get(n.parentId)?.assetKey || null,
    childRegions: Array.isArray(n.childRegions) ? n.childRegions : [],
    asset: publicAsset({ ...n.asset, title: n.label, domain: n.domain }), lit: !!byKey.get(n.assetKey)?.openedAt, relation: n.relation }));
  if (profile.mode !== 'safe') {
    for (const n of visiblePersonal) if (!globalKeys.has(n.assetKey) && !hiddenGlobalKeys.has(n.assetKey) && n.asset.state === 'ready' && n.asset.reviewStatus !== 'rejected') {
      const legacyPageId = n.asset.action === 'legacy' ? n.asset.identity?.query : undefined;
      nodes.push({ ...n, legacyPageId, deletable: ['text','crop'].includes(n.asset.action) && !n.globalNodeId && !n.treeId,
        parentKey: byId.get(n.parentId)?.assetKey || null, asset: publicAsset(n.asset), lit: !!n.openedAt, relation: 'exploration' });
    }
  }
  const events=visibleEvents(await db.learningEvent.findMany({where:{profileId:profile.id},orderBy:[{occurredAt:'asc'},{id:'asc'}]}),personal);
  const links=events.filter(e=>e.type==='connect');
  const connections=links.map(e=>({id:e.id,sourceKey:byId.get(e.nodeId)?.assetKey,targetKey:e.payload.targetId,reason:e.payload.reason})).filter(e=>nodes.some(n=>n.assetKey===e.sourceKey)&&nodes.some(n=>n.assetKey===e.targetKey));
  const corrections=await db.knowledgeCorrection.findMany({where:{profileId:profile.id,assetKey:{notIn:deletedKeys}}});
  return { corrections, deletedKeys, profile: publicProfile(profile), trees, nodes, connections, events, syncedAt: new Date().toISOString() };
}

/** 读取／点亮公共节点时只在个人库建立引用，不复制公共图片。 */
export async function ensureNode(db, profile, assetKey, seen = new Set()) {
  if (seen.has(assetKey)) fail(409, '树结构存在循环');
  seen.add(assetKey);
  const existing = await db.readerNode.findUnique({ where: { profileId_assetKey: { profileId: profile.id, assetKey } } });
  if (existing?.deletedAt) fail(410, '这个节点已从你的知识树删除');
  if (existing && profile.mode !== 'safe') {
    if (existing.globalNodeId) {
      const global = await db.knowledgeNode.findUnique({ where: { id: existing.globalNodeId }, include: { tree: { select: { status: true } } } });
      if (global && !await hasActiveKnowledgePath(db, global)
        && !await findActiveKnowledgeNode(db, { assetKey, tree: { status: 'published' } })) fail(403, '这个公共节点或其所属分支当前已停用');
    } else if (existing.parentId) {
      const parent = await db.readerNode.findFirst({ where: { id: existing.parentId, profileId: profile.id }, select: { assetKey: true } });
      if (!parent) fail(409, '父节点不存在或已不可访问');
      await ensureNode(db, profile, parent.assetKey, seen);
    }
    const owned = await db.knowledgeAsset.findUnique({where:{key:assetKey}});
    if (owned?.state !== 'ready' || owned.reviewStatus === 'rejected') fail(403, '内容暂不可用');
    return existing;
  }
  const historyTree = profile.mode === 'safe' && existing?.globalNodeId ? existing.treeId : null;
  const global = await findActiveKnowledgeNode(db, { assetKey, tree: { status: 'published' },
    ...(profile.mode === 'safe' ? { treeId: { in: [...new Set([historyTree, profile.selectedTreeId].filter(Boolean))] } } : {}) });
  if (!global) fail(403, '当前模式下无法访问这个节点或其所属分支已停用');
  const asset = await db.knowledgeAsset.findUnique({ where: { key: assetKey } });
  if (asset.state !== 'ready' || asset.reviewStatus !== 'approved') fail(403, '内容暂不可用');
  if (existing) return existing;
  let parentId = null;
  if (global.parentId) {
    const parent = await db.knowledgeNode.findUnique({ where: { id: global.parentId } });
    if (!parent || parent.treeId !== global.treeId) fail(409, '树结构需要修复');
    parentId = (await ensureNode(db, profile, parent.assetKey, seen)).id;
  }
  return db.readerNode.upsert({ where: { profileId_assetKey: { profileId: profile.id, assetKey } },
    create: { profileId: profile.id, assetKey, parentId, globalNodeId: global.id, treeId: global.treeId }, update: {} });
}

/** 同一读者串行提交；ACK 只在事务提交后返回，重发事件不重复累加。 */
export async function synchronize(profile, events, db = prisma) {
  if (!Array.isArray(events) || events.length > 200) fail(400, '每次最多同步 200 条学习记录');
  await selectedTree(profile, db);
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${profile.id}))::text`;
    const ack = [];
    for (const event of events) {
      if (!event || typeof event.id !== 'string' || !/^[\w-]{8,100}$/.test(event.id) || typeof event.assetKey !== 'string') fail(400, '同步事件缺少标识');
      const duplicate = await tx.learningEvent.findUnique({ where: { profileId_id: { profileId: profile.id, id: event.id } } });
      if (duplicate) { ack.push(event.id); continue; }
      // 已合法纳入个人树的公开节点，切换模式或来源后仍能补传轨迹。
      const node = await tx.readerNode.findUnique({ where: { profileId_assetKey: { profileId: profile.id, assetKey: event.assetKey } } }) || await ensureNode(tx, profile, event.assetKey);
      // 旧设备补传的事件予以确认并丢弃，不能重新点亮或恢复已删除内容。
      if (node.deletedAt) { ack.push(event.id); continue; }
      const data = applyEvent(node, event);
      if (event.type === 'connect') {
        const target = await tx.readerNode.findFirst({ where: { profileId: profile.id, assetKey: event.payload.targetId, openedAt: { not: null } } });
        if (target?.deletedAt) { ack.push(event.id); continue; }
        if (!target || target.id === node.id) fail(400, '请选择另一个已探索节点');
      }
      if (event.type === 'note') {
        const latest = await tx.learningEvent.findFirst({ where: { profileId: profile.id, nodeId: node.id, type: 'note' }, orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }] });
        if (latest && (+latest.occurredAt > +new Date(event.occurredAt) || (+latest.occurredAt === +new Date(event.occurredAt) && latest.id > event.id))) delete data.note;
      }
      await tx.learningEvent.create({ data: { id: event.id, profileId: profile.id, nodeId: node.id, type: event.type, payload: event.payload || {}, occurredAt: new Date(event.occurredAt) } });
      if (['open','review','connect'].includes(event.type)) {
        const history=await tx.learningEvent.findMany({where:{profileId:profile.id,nodeId:node.id,type:{in:['open','review','connect']}},orderBy:[{occurredAt:'asc'},{id:'asc'}]});
        Object.assign(data,replayProgress(history));
      }
      await tx.readerNode.update({ where: { id: node.id }, data });
      ack.push(event.id);
    }
    return ack;
  }, { timeout: 30000 });
}
