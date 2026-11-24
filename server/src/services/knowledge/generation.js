import { effectivePreferences, challengeLevel } from './preferences.js';
import { reserveAllowance } from './allowance.js';
import { randomUUID, createHash } from 'node:crypto';
import sharp from 'sharp';
import prisma from '../../config/db.js';
import { uploadBase64 } from '../oss.js';
import { readImageBuffer } from '../imageSource.js';
import { contentIdentity, textValue, assertGeneration, fail, monthPeriod, isMinor } from './policy.js';
import { assemble, activeRelease, produce } from './engine.js';
import { evaluationSignature } from './evaluationSignature.js';
import { publicAsset, ensureNode } from './library.js';
import { getDeviceAiConfig, imageStyleSignature } from '../ai/deviceConfig.js';
import { readerPath } from './readerPath.js';
import { assertTreeRevision } from './deletion.js';
import { availableIdentity, attachGeneratedNode } from './generationNodes.js';

/** 截图只能裁剪当前有权阅读的父图，客户端不能伪造路径或借 URL 读取服务器文件。 */
async function cropParent(parent, region) {
  if (!region || ['x', 'y', 'w', 'h'].some(k => !Number.isFinite(region[k])) || region.x < 0 || region.y < 0 || region.w <= 0 || region.h <= 0 || region.x + region.w > 1.000001 || region.y + region.h > 1.000001) fail(400, '截图区域无效');
  const buffer = await readImageBuffer(parent.imageUrl);
  const meta = await sharp(buffer).metadata();
  const left = Math.round(region.x * meta.width); const top = Math.round(region.y * meta.height);
  const width = Math.min(meta.width - left, Math.max(1, Math.round(region.w * meta.width)));
  const height = Math.min(meta.height - top, Math.max(1, Math.round(region.h * meta.height)));
  const output = await sharp(buffer).extract({ left, top, width, height }).resize({ width: 800, withoutEnlargement: true }).png().toBuffer();
  return { data: `data:image/png;base64,${output.toString('base64')}`, hash: createHash('sha256').update(output).digest('hex') };
}

/** 生成前统一查公共节点与缓存；租约在数据库中协调多进程并发。 */
export async function explore(profile, input, dependencies = {}) {
  const db = dependencies.db || prisma;
  const provider = dependencies.produce || produce;
  const store = dependencies.upload || uploadBase64;
  const query = textValue(input.query, '探索问题', 2000);
  const action = input.action || 'text';
  if (!['text', 'crop'].includes(action)) fail(400, '探索方式无效');
  const current = await db.readerProfile.findUnique({ where: { id: profile.id } });
  const revision = input.treeRevision ?? profile.treeRevision ?? 0;
  if (!Number.isInteger(revision) || revision !== current?.treeRevision) fail(409, '知识树已更新，请同步后重新发起探索');
  let parent = null; let parentNode = null; let lineage;
  if (input.parentKey) {
    parentNode = await ensureNode(db, profile, input.parentKey);
    parent = await db.knowledgeAsset.findUnique({ where: { key: input.parentKey } });
    const path = await readerPath(db, profile.id, parentNode, parent);
    parent.ancestry = path.ancestors;
    lineage = path.changed ? path.keys : undefined;
  }
  if (action === 'crop' && !parent) fail(400, '截图探索需要父节点');
  // 同名匹配只限当前公共树的直接子节点，不能跨路径偷换语义。
  const globalParent = parent ? await db.knowledgeNode.findFirst({ where: { treeId: profile.selectedTreeId || '', assetKey: parent.key, active: true } }) : null;
  if (globalParent) {
    if (parent.title !== globalParent.label || parent.domain !== globalParent.domain) {
      const priorLineage = Array.isArray(lineage) ? lineage : lineage ? [lineage] : [];
      lineage = [...priorLineage, { treeId: globalParent.treeId, nodeId: globalParent.id, label: globalParent.label, domain: globalParent.domain }];
    }
    parent = { ...parent, title: globalParent.label, domain: globalParent.domain };
  }
  const prepared = action === 'text' && (!parent || globalParent) ? await db.knowledgeNode.findFirst({ where: { treeId: profile.selectedTreeId || '', parentId: globalParent?.id || null, label: query, active: true, tree: { status: 'published' }, asset: { state: 'ready', reviewStatus: 'approved' } }, include: { asset: true } }) : null;
  if (prepared) return { asset: publicAsset({ ...prepared.asset, title: prepared.label, domain: prepared.domain }), node: await ensureNode(db, profile, prepared.assetKey), fromCache: true };
  assertGeneration(profile);
  const crop = action === 'crop' ? await cropParent(parent, input.region) : null;
  const aiConfig = await getDeviceAiConfig(dependencies.deviceId, db);
  const release = await activeRelease(db, profile.id, aiConfig);
  if (!release.id && !dependencies.produce) fail(503,'无限模式已开启，生成服务尚未就绪。服务启用后可在探索队列重试。');
  const preferences = effectivePreferences(profile);
  profile = {...profile,challenge:challengeLevel(profile,parentNode)};
  const modelVersion = `${release.version}:${evaluationSignature(release, aiConfig)}`;
  const identity = await availableIdentity(db, profile.id, contentIdentity({ parentKey: parent?.key, lineage, action, query, cropHash: crop?.hash || null, language: preferences.language || 'zh',
    style: imageStyleSignature(aiConfig.promptStyle, aiConfig.configMap), version: modelVersion, level: isMinor(profile) ? 'child' : preferences.level || 'general', modality: preferences.modality || 'image', purpose: preferences.purpose || 'explore', difficulty:profile.challenge }), input.treeRevision === current.treeRevision);
  const leaseId = randomUUID();
  const claim = await db.$transaction(async tx => {
    await assertTreeRevision(tx, profile.id, revision);
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${identity.key}))::text`;
    const cached = await tx.knowledgeAsset.findUnique({ where: { key: identity.key } });
    if (cached?.state === 'ready' && cached.reviewStatus !== 'rejected') return { cached };
    if (cached?.reviewStatus === 'rejected') fail(422, '这个方向的内容正在修订，请换个问题');
    if (cached?.leaseUntil && cached.leaseUntil > new Date()) return { pending: true };
    // 上次进程退出的租约到期后先返还占额，再由本次请求取得唯一新租约。
    if (cached?.reservedProfileId && cached?.reservedPeriod) {
      await tx.readerEntitlement.updateMany({ where: { profileId: cached.reservedProfileId, period: cached.reservedPeriod, consumed: { gt: 0 } }, data: { consumed: { decrement: 1 } } });
    }
    const period = await reserveAllowance(tx, profile);
    await tx.knowledgeAsset.upsert({ where: { key: identity.key }, create: { ...identity, title: query.slice(0,100), action, parentKey: parent?.key, authorProfileId: profile.id,
      language: preferences.language || 'zh', modality: preferences.modality || 'image', leaseId, leaseUntil: new Date(Date.now() + 1200000), reservedProfileId: profile.id, reservedPeriod: period },
    update: { state: 'pending', leaseId, leaseUntil: new Date(Date.now() + 1200000), reservedProfileId: profile.id, reservedPeriod: period } });
    return { period };
  });
  if (claim.pending) return { pending: true, key: identity.key, retryAfter: 3 };
  let asset = claim.cached; let node;
  if (!asset) {
    const assembly = assemble({ release, profile, parent, query, action });
    try {
      const output = await provider({ assembly, crop: crop?.data, profile, parent, aiConfig });
      const imageUrl = await store(output.image, 'knowledge', identity.key);
      asset = await db.$transaction(async tx => {
        node = await attachGeneratedNode(tx, profile.id, identity.key, parentNode?.id, revision);
        const saved = await tx.knowledgeAsset.updateMany({ where: { key: identity.key, leaseId }, data: { state: 'ready', leaseId: null, leaseUntil: null, reservedProfileId: null, reservedPeriod: null, imageUrl,
          title: output.content.title.slice(0,100), domain: output.content.domain.slice(0,80), explanations: { [identity.identity.language]: [output.content.core,output.content.explanation].filter(Boolean).join('\n\n') }, anchors: output.content.anchors } });
        if (!saved.count) fail(409, '生成任务已更新，请刷新');
        await tx.assemblyLog.create({ data: { assetKey: identity.key, version: release.version, layers: assembly.layers, conflicts: assembly.conflicts, verdict: JSON.stringify(output.verdict) } });
        return tx.knowledgeAsset.findUnique({ where: { key: identity.key } });
      });
    } catch (error) {
      await db.$transaction(async tx => {
        const changed = await tx.knowledgeAsset.updateMany({ where: { key: identity.key, leaseId }, data: { state: 'failed', leaseId: null, leaseUntil: null, reservedProfileId: null, reservedPeriod: null } });
        if (changed.count) await tx.readerEntitlement.update({ where: { profileId_period: { profileId: profile.id, period: claim.period } }, data: { consumed: { decrement: 1 } } });
      });
      throw error;
    }
  }
  node ||= await db.$transaction(tx => attachGeneratedNode(tx, profile.id, asset.key, parentNode?.id, revision));
  return { asset: publicAsset(asset), node, fromCache: !!claim.cached };
}
