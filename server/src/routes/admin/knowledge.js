import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import promptsRouter from './knowledgePrompts.js';
import imagesRouter from './knowledgeImages.js';
import prisma from '../../config/db.js';
import { requireSuperAdmin } from './auth.js';
import { fail, textValue, contentIdentity, validateTree, assetUrl, monthPeriod } from '../../services/knowledge/policy.js';
import { activeRelease, assemble, generateTreeOutline, produce } from '../../services/knowledge/engine.js';
import { getDeviceAiConfig } from '../../services/ai/deviceConfig.js';
import { uploadBase64 } from '../../services/oss.js';
import { editNodeContent } from '../../services/knowledge/contentEditing.js';
import { nodeImageScope } from '../../services/knowledge/nodeImageScope.js';
import { normalizeChildRegions } from '../../services/knowledge/childRegions.js';
import { identifyChildRegion } from '../../services/knowledge/childRegionSuggestions.js';
import { checkLocalText } from '../../services/localSecurity.js';
import { resetNodeContent } from '../../services/knowledge/nodeReset.js';
import { addOutlineNodes } from '../../services/knowledge/treeOutlinePersistence.js';

const router = Router();
router.use(requireSuperAdmin);
router.use('/prompts', promptsRouter);
router.use('/images', imagesRouter);

router.get('/', async (_req, res, next) => {
  try {
    const [trees, reviews, corrections, releases] = await Promise.all([
      prisma.knowledgeTree.findMany({ include: { nodes: { include: { asset: true }, orderBy: { order: 'asc' } } }, orderBy: { createdAt: 'asc' } }),
      prisma.knowledgeAsset.findMany({ where: { reviewStatus: 'pending', state: 'ready', OR: [{ nodes: { some: {} } }, { authorProfileId: { not: null } }] }, orderBy: { createdAt: 'asc' }, take: 100 }),
      prisma.knowledgeCorrection.findMany({ where: { status: 'open' }, orderBy: { createdAt: 'asc' }, take: 100 }),
      prisma.promptRelease.findMany({ orderBy: { createdAt: 'desc' }, take: 20 }),
    ]);
    res.json({ trees, reviews, corrections, releases });
  } catch (error) { next(error); }
});

router.post('/trees/generate', async (req, res, next) => {
  try {
    const input = {
      title: textValue(req.body.title, '名称', 100),
      grade: String(req.body.grade || '').slice(0, 80),
      curriculum: String(req.body.curriculum || '').slice(0, 200),
      description: String(req.body.description || '').slice(0, 2000),
      generationPrompt: String(req.body.generationPrompt || '').slice(0, 2000),
    };
    const outline = await generateTreeOutline(input);
    const tree = await prisma.$transaction(async tx => {
      const created = await tx.knowledgeTree.create({ data: {
        title: input.title,
        grade: input.grade,
        curriculum: input.curriculum,
        description: input.description,
      } });
      return addOutlineNodes(tx, created, outline);
    });
    res.status(201).json({ tree });
  } catch (error) { next(error); }
});

router.post('/trees/:id/plan', async (req, res, next) => {
  try {
    const tree = await prisma.knowledgeTree.findUnique({ where: { id: req.params.id }, include: { nodes: true } });
    if (!tree) fail(404, '知识树不存在');
    if (tree.status !== 'draft') fail(409, '请先撤回为草稿再规划');
    if (tree.nodes.length) fail(409, '仅可为没有节点的空草稿生成结构');
    const outline = await generateTreeOutline({
      title: tree.title,
      grade: tree.grade,
      curriculum: tree.curriculum,
      description: tree.description,
      generationPrompt: String(req.body.generationPrompt || '').slice(0, 2000),
    });
    const updated = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${tree.id}))::text`;
      const current = await tx.knowledgeTree.findUnique({ where: { id: tree.id }, include: { nodes: true } });
      if (!current || current.status !== 'draft' || current.nodes.length) fail(409, '草稿已变更，请刷新后重试');
      return addOutlineNodes(tx, current, outline, true);
    });
    res.json({ tree: updated });
  } catch (error) { next(error); }
});

router.post('/trees', async (req, res, next) => {
  try {
    const tree = await prisma.knowledgeTree.create({ data: { title: textValue(req.body.title, '名称', 100), grade: String(req.body.grade || '').slice(0,80),
      curriculum: String(req.body.curriculum || '').slice(0,200), description: String(req.body.description || '').slice(0,2000) } });
    res.status(201).json({ tree });
  } catch (error) { next(error); }
});

router.post('/trees/:id/nodes', async (req, res, next) => {
  try {
    const node = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${req.params.id}))::text`;
      const tree = await tx.knowledgeTree.findUnique({ where: { id: req.params.id } });
      if (!tree) fail(404, '知识树不存在');
      if (tree.status === 'published') fail(409, '请先撤回为草稿再编辑');
      const parent = req.body.parentId ? await tx.knowledgeNode.findFirst({ where: { id: req.body.parentId, treeId: tree.id } }) : null;
      if (req.body.parentId && !parent) fail(400, '父节点不属于当前知识树');
      let asset;
      if (req.body.assetKey) {
        asset = await tx.knowledgeAsset.findUnique({ where: { key: req.body.assetKey } });
        if (asset?.state !== 'ready' || asset.reviewStatus !== 'approved') fail(400, '请选择已审核资源');
      } else {
        if (req.body.reviewed !== true) fail(400, '请确认已审核图片与文本');
        const title = textValue(req.body.title, '节点标题', 100);
        const explanation = textValue(req.body.explanation, '解读', 16000);
        const identity = contentIdentity({ parentKey: parent?.assetKey, query: title, action: 'curated', version: `${tree.id}:${tree.revision}` });
        asset = await tx.knowledgeAsset.upsert({ where: { key: identity.key }, create: { ...identity, action: 'curated', parentKey: parent?.assetKey,
          title, domain: textValue(req.body.domain, '领域', 80), imageUrl: assetUrl(req.body.imageUrl), explanations: { zh: explanation },
          state: 'ready', reviewStatus: 'approved', reviewedBy: req.adminUser.id }, update: {} });
      }
      const node = await tx.knowledgeNode.create({ data: { treeId: tree.id, parentId: parent?.id, assetKey: asset.key, label: asset.title, domain: asset.domain,
        relation: ['cause','related','temporary'].includes(req.body.relation) ? req.body.relation : 'related', order: await tx.knowledgeNode.count({ where: { treeId: tree.id } }) } });
      await tx.knowledgeTree.update({ where: { id: tree.id }, data: { revision: { increment: 1 } } });
      return node;
    });
    res.status(201).json({ node });
  } catch (error) { next(error); }
});

router.patch('/trees/:treeId/nodes/:id', async (req, res, next) => {
  try {
    const node = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${req.params.treeId}))::text`;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${req.params.treeId + ':' + req.params.id}))::text`;
      const tree = await tx.knowledgeTree.findUnique({ where: { id: req.params.treeId } });
      if (!tree) fail(404, '知识树不存在');
      if (tree.status !== 'draft') fail(409, '请先撤回为草稿再编辑');
      const current = await tx.knowledgeNode.findFirst({ where: { id: req.params.id, treeId: tree.id }, include: { asset: true } });
      if (!current) fail(404, '树节点不存在');
      const data = {};
      if ('label' in req.body) data.label = textValue(req.body.label, '节点名称', 100);
      if ('domain' in req.body) data.domain = textValue(req.body.domain, '领域', 80);
      if ('relation' in req.body) {
        if (!['cause', 'related', 'temporary'].includes(req.body.relation)) fail(400, '连接关系无效');
        data.relation = req.body.relation;
      }
      if ('imageUrl' in req.body && req.body.imageUrl !== current.asset.imageUrl) data.childRegions = [];
      if (['imageUrl', 'explanation', 'anchors'].some(key => key in req.body)) {
        data.assetKey = await editNodeContent(tx, tree, current, req.body, data);
      }
      if (!Object.keys(data).length) fail(400, '没有可修改的节点信息');
      const updated = await tx.knowledgeNode.update({ where: { id: current.id }, data, include: { asset: true } });
      await tx.knowledgeTree.update({ where: { id: tree.id }, data: { revision: { increment: 1 } } });
      return updated;
    });
    res.json({ node });
  } catch (error) { next(error); }
});

router.patch('/trees/:treeId/nodes/:id/active', async (req, res, next) => {
  try {
    if (typeof req.body.active !== 'boolean' || !Number.isInteger(req.body.revision)) fail(400, '缺少有效的节点状态或版本');
    const node = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${req.params.treeId}))::text`;
      const tree = await tx.knowledgeTree.findUnique({ where: { id: req.params.treeId }, include: { nodes: { include: { asset: true } } } });
      if (!tree) fail(404, '知识树不存在');
      if (tree.revision !== req.body.revision) fail(409, '知识树已变更，请刷新后再操作');
      const current = tree.nodes.find(item => item.id === req.params.id);
      if (!current) fail(404, '树节点不存在');
      if (current.active === req.body.active) return current;
      const nextNodes = tree.nodes.map(item => item.id === current.id ? { ...item, active: req.body.active } : item);
      if (tree.status === 'published' && req.body.active) validateTree(nextNodes);
      const updated = await tx.knowledgeNode.update({ where: { id: current.id }, data: { active: req.body.active }, include: { asset: true } });
      await tx.knowledgeTree.update({ where: { id: tree.id }, data: { revision: { increment: 1 } } });
      return updated;
    });
    res.json({ node });
  } catch (error) { next(error); }
});

router.post('/trees/:treeId/nodes/:id/child-regions/identify', async (req, res, next) => {
  try {
    const tree = await prisma.knowledgeTree.findUnique({ where: { id: req.params.treeId } });
    if (!tree) fail(404, '知识树不存在');
    if (tree.status !== 'draft') fail(409, '请先撤回为草稿再标注');
    const current = await prisma.knowledgeNode.findFirst({ where: { id: req.params.id, treeId: tree.id }, include: { asset: true } });
    if (!current) fail(404, '树节点不存在');
    if (req.body.expectedAssetKey !== current.assetKey || req.body.revision !== tree.revision) fail(409, '节点内容已变更，请刷新后再标注');
    if (current.asset.state !== 'ready' || !current.asset.imageUrl) fail(409, '请先生成当前节点图片');
    const children = await prisma.knowledgeNode.findMany({ where: { treeId: tree.id, parentId: current.id }, select: { id: true, label: true }, orderBy: { order: 'asc' } });
    const suggestions = await identifyChildRegion(current.asset.imageUrl, req.body.region, children);
    const latest = await prisma.knowledgeTree.findUnique({ where: { id: tree.id }, select: { revision: true, status: true } });
    if (!latest || latest.status !== 'draft' || latest.revision !== tree.revision) fail(409, '树内容已变更，请刷新后重新识别');
    res.json(suggestions);
  } catch (error) { next(error); }
});

router.patch('/trees/:treeId/nodes/:id/child-regions', async (req, res, next) => {
  try {
    const node = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${req.params.treeId}))::text`;
      const tree = await tx.knowledgeTree.findUnique({ where: { id: req.params.treeId } });
      if (!tree) fail(404, '知识树不存在');
      if (tree.status !== 'draft') fail(409, '请先撤回为草稿再标注');
      const current = await tx.knowledgeNode.findFirst({ where: { id: req.params.id, treeId: tree.id }, include: { asset: true } });
      if (!current) fail(404, '树节点不存在');
      if (req.body.expectedAssetKey !== current.assetKey || req.body.revision !== tree.revision) fail(409, '节点内容已变更，请刷新后再标注');
      if (current.asset.state !== 'ready' || !current.asset.imageUrl) fail(409, '请先生成当前节点图片');
      const children = await tx.knowledgeNode.findMany({ where: { treeId: tree.id, parentId: current.id }, select: { id: true } });
      const childRegions = normalizeChildRegions(req.body.childRegions, children.map(child => child.id));
      const updated = await tx.knowledgeNode.update({ where: { id: current.id }, data: { childRegions } });
      await tx.knowledgeTree.update({ where: { id: tree.id }, data: { revision: { increment: 1 } } });
      return updated;
    });
    res.json({ node });
  } catch (error) { next(error); }
});

router.post('/trees/:treeId/nodes/:nodeId/reset', async (req, res, next) => {
  try {
    const node = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${req.params.treeId}))::text`;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${req.params.treeId + ':' + req.params.nodeId}))::text`;
      const tree = await tx.knowledgeTree.findUnique({ where: { id: req.params.treeId } });
      if (!tree) fail(404, '知识树不存在');
      if (tree.status !== 'draft') fail(409, '请先撤回为草稿再重置');
      const current = await tx.knowledgeNode.findFirst({ where: { id: req.params.nodeId, treeId: tree.id }, include: { asset: true } });
      if (!current) fail(404, '树节点不存在');
      return resetNodeContent(tx, tree, current, req.body);
    });
    res.json({ node });
  } catch (error) { next(error); }
});

router.post('/trees/:treeId/nodes/:nodeId/generate', async (req, res, next) => {
  let leaseId;
  let assetKey;
  try {
    const claim = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${req.params.treeId + ':' + req.params.nodeId}))::text`;
      const tree = await tx.knowledgeTree.findUnique({ where: { id: req.params.treeId } });
      if (!tree) fail(404, '知识树不存在');
      if (tree.status !== 'draft') fail(409, '请先撤回为草稿再生成');
      const node = await tx.knowledgeNode.findFirst({ where: { id: req.params.nodeId, treeId: tree.id }, include: { asset: true } });
      if (!node) fail(404, '树节点不存在');
      assetKey = node.assetKey;
      if (node.asset.state === 'ready' && node.asset.imageUrl && node.asset.explanations?.zh) return { done: true, node };
      if (node.asset.leaseUntil && node.asset.leaseUntil > new Date()) fail(409, '这个节点正在生成');
      let parent = null;
      if (node.parentId) {
        const parentNode = await tx.knowledgeNode.findUnique({ where: { id: node.parentId }, include: { asset: true } });
        if (!parentNode) fail(409, '父节点不存在，请刷新知识树');
        parent = {
          ...parentNode.asset,
          title: parentNode.label,
          domain: parentNode.domain,
          outlineOnly: parentNode.asset.state !== 'ready',
        };
      }
      const scopeNodes = await tx.knowledgeNode.findMany({ where: { treeId: tree.id }, select: { id: true, parentId: true, label: true, order: true } });
      const imageScope = nodeImageScope(node, scopeNodes, parent?.title);
      if (!checkLocalText(`${imageScope.query}\n${imageScope.context}`).isSafe) fail(422, '节点知识结构未通过本地安全检查');
      leaseId = randomUUID();
      await tx.knowledgeAsset.update({ where: { key: node.assetKey }, data: { state: 'pending', leaseId, leaseUntil: new Date(Date.now() + 20 * 60 * 1000) } });
      return { node, parent, imageScope, revision: tree.revision };
    });
    if (claim.done) return res.json({ asset: claim.node.asset });

    const profile = { id: `admin-tree:${req.params.treeId}`, ageBand: 'minor', preferences: { language: 'zh' } };
    const aiConfig = await getDeviceAiConfig(undefined, prisma);
    const release = await activeRelease(prisma, profile.id, aiConfig);
    const assembly = assemble({ release, profile, parent: claim.parent, query: claim.node.label, action: 'text' });
    const output = await produce({ assembly, profile, parent: claim.parent, aiConfig, imageQuery: claim.imageScope.query, imageContext: claim.imageScope.context });
    const imageUrl = await uploadBase64(output.image, 'knowledge', assetKey);
    const saved = await prisma.$transaction(async tx => {
      const currentTree = await tx.knowledgeTree.findUnique({ where: { id: req.params.treeId }, select: { revision: true, status: true } });
      if (!currentTree || currentTree.status !== 'draft' || currentTree.revision !== claim.revision) fail(409, '知识结构已变更，请刷新后重新生成');
      const changed = await tx.knowledgeAsset.updateMany({ where: { key: assetKey, leaseId }, data: {
        state: 'ready', leaseId: null, leaseUntil: null, imageUrl,
        title: output.content.title.slice(0, 100),
        domain: output.content.domain.slice(0, 80),
        explanations: { zh: [output.content.core, output.content.explanation].filter(Boolean).join('\n\n') },
        anchors: output.content.anchors,
        reviewStatus: 'pending',
      } });
      if (!changed.count) fail(409, '生成任务已更新，请刷新');
      const updated = await tx.knowledgeNode.updateMany({ where: { id: req.params.nodeId, treeId: req.params.treeId, assetKey }, data: { label: output.content.title.slice(0, 100), domain: output.content.domain.slice(0, 80), childRegions: [] } });
      if (!updated.count) fail(409, '节点内容已变更，请刷新');
      await tx.assemblyLog.create({ data: { assetKey, version: release.version, layers: assembly.layers, conflicts: assembly.conflicts, verdict: JSON.stringify(output.verdict) } });
      return tx.knowledgeAsset.findUnique({ where: { key: assetKey } });
    });
    res.json({ asset: saved });
  } catch (error) {
    if (leaseId && assetKey) await prisma.knowledgeAsset.updateMany({ where: { key: assetKey, leaseId }, data: { state: 'pending', leaseId: null, leaseUntil: null } }).catch(() => {});
    next(error);
  }
});

router.patch('/trees/:id', async (req, res, next) => {
  try {
    if (!['draft', 'published'].includes(req.body.status) || !Number.isInteger(req.body.revision)) fail(400, '缺少有效状态或版本');
    await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${req.params.id}))::text`;
      const tree = await tx.knowledgeTree.findUnique({ where: { id: req.params.id }, include: { nodes: { include: { asset: true } } } });
      if (!tree || tree.revision !== req.body.revision) fail(409, '知识树已变更，请刷新后重试');
      if (req.body.status === 'published') validateTree(tree.nodes);
      await tx.knowledgeTree.update({ where: { id: tree.id }, data: { status: req.body.status, revision: { increment: 1 } } });
    });
    res.json({ saved: true });
  } catch (error) { next(error); }
});

router.delete('/trees/:id', async (req, res, next) => {
  try {
    const result = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${req.params.id}))::text`;
      const tree = await tx.knowledgeTree.findUnique({ where: { id: req.params.id } });
      if (!tree) fail(404, '知识树不存在');
      if (tree.status !== 'draft') fail(409, '请先撤回已发布的知识树，再删除');
      if (!Number.isInteger(req.body.revision) || req.body.revision !== tree.revision) fail(409, '知识树已变更，请刷新后再删除');
      const deletedNodes = await tx.knowledgeNode.count({ where: { treeId: tree.id } });
      const fallback = await tx.knowledgeTree.findFirst({
        where: { status: 'published', id: { not: tree.id } },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      await tx.readerProfile.updateMany({
        where: { selectedTreeId: tree.id },
        data: { selectedTreeId: fallback?.id || null, settingsRevision: { increment: 1 } },
      });
      await tx.knowledgeTree.delete({ where: { id: tree.id } });
      return { deletedNodes };
    });
    res.json({ deleted: true, ...result });
  } catch (error) { next(error); }
});

router.delete('/trees/:treeId/nodes/:id', async (req, res, next) => {
  try {
    const deletedNodes = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${req.params.treeId}))::text`;
      const tree = await tx.knowledgeTree.findUnique({ where: { id: req.params.treeId } });
      if (!tree || tree.status !== 'draft') fail(409, '只可编辑草稿');
      const nodes = await tx.knowledgeNode.findMany({ where: { treeId: tree.id }, select: { id: true, parentId: true, childRegions: true } });
      if (!nodes.some(node => node.id === req.params.id)) fail(404, '树节点不存在');
      const childrenByParent = new Map();
      nodes.forEach(node => {
        if (!node.parentId) return;
        const children = childrenByParent.get(node.parentId) || [];
        children.push(node.id);
        childrenByParent.set(node.parentId, children);
      });
      const ids = new Set([req.params.id]);
      const pending = [req.params.id];
      while (pending.length) {
        for (const childId of childrenByParent.get(pending.pop()) || []) {
          if (ids.has(childId)) continue;
          ids.add(childId);
          pending.push(childId);
        }
      }
      const deletedRoot = nodes.find(node => node.id === req.params.id);
      const survivingParent = nodes.find(node => node.id === deletedRoot.parentId);
      if (survivingParent) {
        const childRegions = (Array.isArray(survivingParent.childRegions) ? survivingParent.childRegions : [])
          .filter(region => !ids.has(region.childNodeId));
        await tx.knowledgeNode.update({ where: { id: survivingParent.id }, data: { childRegions } });
      }
      await tx.knowledgeNode.deleteMany({ where: { treeId: tree.id, id: { in: [...ids] } } });
      await tx.knowledgeTree.update({ where: { id: tree.id }, data: { revision: { increment: 1 } } });
      return ids.size;
    });
    res.json({ deleted: true, deletedNodes });
  } catch (error) { next(error); }
});

router.post('/reviews/:key', async (req, res, next) => {
  try {
    if (!['approved', 'rejected'].includes(req.body.status)) fail(400, '审核决定无效');
    const note = textValue(req.body.note, '审核意见', 2000);
    await prisma.$transaction(async tx => {
      const changed = await tx.knowledgeAsset.updateMany({ where: { key: req.params.key, state: 'ready' }, data: { reviewStatus: req.body.status, reviewNote: note, reviewedBy: req.adminUser.id } });
      if (!changed.count) fail(404, '待审核资源不存在');
      if (req.body.status === 'rejected') {
        const nodes = await tx.knowledgeNode.findMany({ where: { assetKey: req.params.key } });
        await tx.knowledgeTree.updateMany({ where: { id: { in: nodes.map(n => n.treeId) } }, data: { status: 'draft', revision: { increment: 1 } } });
      }
    });
    res.json({ saved: true });
  } catch (error) { next(error); }
});

router.post('/corrections/:id', async (req, res, next) => {
  try {
    const resolution = textValue(req.body.resolution, '核查结果', 8000);
    await prisma.knowledgeCorrection.update({ where: { id: req.params.id }, data: { status: 'resolved', resolution, acknowledged: false } });
    res.json({ saved: true });
  } catch (error) { next(error); }
});

router.post('/entitlements', async (req, res, next) => {
  try {
    const profile = await prisma.readerProfile.findUnique({ where: { username: String(req.body.username || '').toLowerCase() } });
    if (!profile) fail(404, '账号不存在');
    if (!Number.isInteger(req.body.allowance) || req.body.allowance < 0 || req.body.allowance > 100000) fail(400, '月度额度无效');
    const { period, expiresAt } = monthPeriod();
    const entitlement = await prisma.readerEntitlement.upsert({ where: { profileId_period: { profileId: profile.id, period } },
      create: { profileId: profile.id, period, expiresAt, allowance: req.body.allowance }, update: { allowance: req.body.allowance } });
    res.json({ entitlement });
  } catch (error) { next(error); }
});

router.post('/prompts', async (req, res, next) => {
  try {
    const release = await prisma.promptRelease.create({ data: { version: textValue(req.body.version, '版本', 80), base: textValue(req.body.base, '基座', 12000), safety: textValue(req.body.safety, '安全约束', 8000) } });
    res.status(201).json({ release });
  } catch (error) { next(error); }
});

router.get('/assembly/:key', async (req, res, next) => {
  try { res.json({ logs: await prisma.assemblyLog.findMany({ where: { assetKey: req.params.key }, orderBy: { createdAt: 'desc' } }) }); }
  catch (error) { next(error); }
});

export default router;
