import { Router } from 'express';
import prisma from '../../config/db.js';
import { requireAuth } from '../../middleware/auth.js';
import { resolveReader, publicProfile } from '../../services/knowledge/readerAuth.js';
import { fail, isMinor, textValue, monthPeriod } from '../../services/knowledge/policy.js';
import { librarySnapshot, synchronize, ensureNode, publicAsset } from '../../services/knowledge/library.js';
import { connectionSuggestions, observationReport } from '../../services/knowledge/learning.js';
import { explore } from '../../services/knowledge/generation.js';
import { nearbyPermit, nearbyCount } from '../../services/knowledge/nearby.js';
import { knowledgeAudio } from '../../services/knowledge/audio.js';
import { importLegacy } from '../../services/knowledge/legacy.js';
import { reportDigest } from '../../services/knowledge/reports.js';
import { defaultAllowance } from '../../services/knowledge/allowance.js';
import { deleteReaderNode, visibleEvents } from '../../services/knowledge/deletion.js';
import { visibleKnowledgeNodes, visibleReaderNodes } from '../../services/knowledge/nodeVisibility.js';
import account from './account.js';
import guardian from './guardian.js';

const router = Router();
// 此接口在认证之前，并在 index.js 的访问日志中排除；请求体也不记录。
router.post('/nearby/count', (req, res, next) => { try { res.json(nearbyCount(req.body)); } catch (error) { next(error); } });
router.use(requireAuth, resolveReader);
router.use('/account', account);
router.use('/guardian', guardian);
router.get('/reports', async (req,res,next) => {try {res.json(await reportDigest(req.reader));} catch(error) {next(error);}});
router.get('/voices', async (_req,res,next) => {
  try { res.json({voices:await prisma.voice.findMany({where:{enabled:true},select:{voiceId:true,voiceName:true,description:true},orderBy:{createdAt:'asc'},take:100})}); }
  catch(error) { next(error); }
});
/** 原设备书架只对首次绑定的读者开放；其他账号从自己的知识库阅读。 */
async function deviceSnapshot(req) {
  const snapshot = await librarySnapshot(req.reader);
  const owner = await prisma.legacyImportOwner.findUnique({where:{deviceId:req.deviceId}});
  return {...snapshot, deviceShelf:owner?.profileId === req.reader.id};
}

router.get('/library', async (req, res, next) => { try { await importLegacy(req.reader, req.deviceId); res.json(await deviceSnapshot(req)); } catch (error) { next(error); } });
router.delete('/nodes/:key', async (req,res,next) => {
  try {
    if (req.body.profileId !== req.reader.id) fail(409, '账号已切换，请刷新知识树后重试');
    await deleteReaderNode(req.reader, req.params.key, req.body);
    res.json(await deviceSnapshot(req));
  } catch (error) { next(error); }
});
router.post('/sync', async (req, res, next) => {
  try { if (req.body.profileId !== req.reader.id) fail(409, '账号已切换，离线记录仍保留在原账号'); const ack = await synchronize(req.reader, req.body.events); res.json({ ack, ...await deviceSnapshot(req) }); }
  catch (error) { next(error); }
});
router.post('/audio/:key', async (req,res,next) => { try { res.json(await knowledgeAudio(req.reader,req.params.key,req.body.language || 'zh')); } catch(error) { next(error); } });
router.post('/explore', async (req, res, next) => {
  try {
    if (req.body.profileId !== req.reader.id) fail(409, '账号已切换，请在原账号继续探索');
    const result = await explore(req.reader, req.body, { deviceId: req.deviceId });
    res.status(result.pending ? 202 : 200).json(result);
  } catch (error) { next(error); }
});

router.get('/learning', async (req, res, next) => {
  try {
    const allPersonal = await prisma.readerNode.findMany({ where: { profileId: req.reader.id, deletedAt: null }, include: { asset: true }, orderBy: { lastSeenAt: 'asc' } });
    const events = visibleEvents(await prisma.learningEvent.findMany({ where: { profileId: req.reader.id, occurredAt: { gte: new Date(Date.now() - 30 * 86400000) } }, orderBy: { occurredAt: 'asc' } }), allPersonal);
    const allGlobals = await prisma.knowledgeNode.findMany({ where: req.reader.mode === 'safe' ? { treeId: req.reader.selectedTreeId || '' } : {}, include: { asset: true, tree: { select: { status: true } } } });
    const activeGlobals = visibleKnowledgeNodes(allGlobals);
    const globals = activeGlobals.filter(node => node.tree.status === 'published');
    const visibleGlobalIds = new Set(activeGlobals.map(node => node.id));
    const activeKeys = new Set(globals.map(node => node.assetKey));
    const hiddenGlobalIds = new Set(allGlobals.filter(node => !visibleGlobalIds.has(node.id) && !activeKeys.has(node.assetKey)).map(node => node.id));
    const nodes = visibleReaderNodes(allPersonal, hiddenGlobalIds);
    const globalById=new Map(globals.map(n=>[n.id,n]));
    const personalById=new Map(nodes.map(n=>[n.id,n]));
    const graph=events.filter(e=>e.type==='connect').map(e=>[personalById.get(e.nodeId)?.assetKey,e.payload.targetId]).filter(pair=>pair.every(Boolean));
    const allowed = req.reader.mode === 'safe' ? new Set(globals.map(n => n.assetKey)) : null;
    const visibleIds = new Set(globals.map(node => node.id));
    const visibleKeys = new Set(globals.map(node => node.assetKey));
    const hiddenGlobalKeys = new Set(allGlobals.filter(node => !visibleIds.has(node.id) && !visibleKeys.has(node.assetKey)).map(node => node.assetKey));
    res.json({ due: nodes.filter(n => n.nextReviewAt && n.nextReviewAt <= new Date() && !hiddenGlobalKeys.has(n.assetKey) && (!allowed || allowed.has(n.assetKey))).map(n => ({ ...n, asset: publicAsset(n.asset) })),
      suggestions: connectionSuggestions(req.reader, nodes.filter(n => n.openedAt).map(n => ({...n.asset,parentKey:personalById.get(n.parentId)?.assetKey})), globals.map(n => ({ ...publicAsset(n.asset), parentKey:globalById.get(n.parentId)?.assetKey, globalNodeId: n.id, treeId: n.treeId })),6,graph),
      report: observationReport(allPersonal, events, 30), connections: events.filter(e => e.type === 'connect') });
  } catch (error) { next(error); }
});

router.post('/diagnosis', async (req, res, next) => {
  try {
    if (isMinor(req.reader) && (!req.reader.guardianId || !req.reader.permissions?.diagnosis)) fail(403, '有限之书需由监护人开启');
    if (req.body.accepted !== true) fail(400, '请先主动采纳一个外部范围');
    const tree = await prisma.knowledgeTree.findFirst({ where: { id: req.body.treeId, status: 'published' } });
    if (!tree) fail(404, '外部范围不存在');
    const nodes = visibleKnowledgeNodes(await prisma.knowledgeNode.findMany({ where: { treeId: tree.id } }));
    const personal = await prisma.readerNode.findMany({ where: { profileId: req.reader.id, deletedAt: null, openedAt: { not: null } } });
    const seen = new Set(personal.map(n => n.assetKey));
    res.json({ title: tree.title, curriculum: tree.curriculum, optional: nodes.filter(n => !seen.has(n.assetKey)).map(n => ({ assetKey: n.assetKey, title: n.label, label: '可选补' })) });
  } catch (error) { next(error); }
});

router.get('/corrections', async (req, res, next) => {
  try {
    const removed=await prisma.readerNode.findMany({where:{profileId:req.reader.id,deletedAt:{not:null}},select:{assetKey:true}});
    res.json({ corrections: await prisma.knowledgeCorrection.findMany({ where: { profileId: req.reader.id, assetKey:{notIn:removed.map(n=>n.assetKey)} }, orderBy: { createdAt: 'desc' } }) });
  }
  catch (error) { next(error); }
});
router.post('/corrections', async (req, res, next) => {
  try {
    await ensureNode(prisma, req.reader, req.body.assetKey);
    const correction = await prisma.knowledgeCorrection.create({ data: { profileId: req.reader.id, assetKey: req.body.assetKey,
      claim: textValue(req.body.claim, '待核查内容'), evidence: textValue(req.body.evidence, '理由或来源', 4000) } });
    res.status(201).json({ correction });
  } catch (error) { next(error); }
});
router.post('/corrections/:id/acknowledge', async (req, res, next) => {
  try {
    const result = await prisma.knowledgeCorrection.updateMany({ where: { id: req.params.id, profileId: req.reader.id, status: 'resolved' }, data: { acknowledged: true } });
    if (!result.count) fail(404, '没有可以确认的修订');
    res.json({ acknowledged: true });
  } catch (error) { next(error); }
});

router.post('/nearby/permit', async (req, res, next) => {
  try {
    if (req.body.enabled !== true || isMinor(req.reader) && (!req.reader.guardianId || !req.reader.permissions?.nearby)) fail(403, '邻域共学尚未获准开启');
    res.json(nearbyPermit(req.reader.id));
  } catch (error) { next(error); }
});

router.get('/entitlement', async (req, res, next) => {
  try {
    const { period, expiresAt } = monthPeriod();
    const entitlement = await prisma.readerEntitlement.findUnique({ where: { profileId_period: { profileId: req.reader.id, period } } });
    res.json({ entitlement: entitlement || { period, expiresAt, allowance: await defaultAllowance(prisma), consumed: 0 } });
  } catch (error) { next(error); }
});

router.get('/export', async (req, res, next) => {
  try {
    const nodes = await prisma.readerNode.findMany({ where: { profileId: req.reader.id, deletedAt: null }, include: { asset: true } });
    const events = visibleEvents(await prisma.learningEvent.findMany({ where: { profileId: req.reader.id }, orderBy: { occurredAt: 'asc' } }), nodes);
    const corrections = await prisma.knowledgeCorrection.findMany({ where: { profileId: req.reader.id, assetKey:{in:nodes.map(n=>n.assetKey)} } });
    const removed=await prisma.readerNode.findMany({where:{profileId:req.reader.id,deletedAt:{not:null}},select:{assetKey:true}});
    res.set('Content-Disposition', 'attachment; filename="unlimited-book.json"');
    res.json({ format: 'unlimited-book/1', exportedAt: new Date().toISOString(), profile: publicProfile(req.reader),
      nodes: nodes.map(n => ({ ...n, asset: publicAsset(n.asset) })), events, corrections, deletedKeys:removed.map(n=>n.assetKey) });
  } catch (error) { next(error); }
});

export default router;
