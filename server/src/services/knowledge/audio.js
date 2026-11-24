import prisma from '../../config/db.js';
import { synthesizeSpeech } from '../ai/tts.js';
import { uploadBuffer } from '../oss.js';
import { assertGeneration, fail } from './policy.js';
import { ensureNode } from './library.js';
import { reserveAllowance } from './allowance.js';
import { createHash, randomUUID } from 'node:crypto';
import { effectivePreferences } from './preferences.js';

/** 音轨按内容、语言、音色共用；数据库租约跨进程去重，失败返还额度。 */
export async function knowledgeAudio(profile, key, language = 'zh', dependencies = {}) {
  const db = dependencies.db || prisma;
  await ensureNode(db,profile,key);
  const asset = await db.knowledgeAsset.findUnique({where:{key}});
  const text = asset.explanations?.[language];
  if (!text) fail(404,'这页还没有该语言的解读');
  const voices = await db.voice.findMany({where:{enabled:true},orderBy:{createdAt:'asc'},take:100});
  const voice = voices.find(v => v.voiceId === effectivePreferences(profile).voice)?.voiceId || voices[0]?.voiceId || 'Chinese (Mandarin)_Lyrical_Voice';
  const audioKey = createHash('sha256').update(`${language}:${voice}:${text}`).digest('hex');
  if (asset.audio?.[audioKey]) return { url:asset.audio[audioKey],fromCache:true };
  assertGeneration(profile);
  const taskKey = `${key}:${audioKey}`; const leaseId = randomUUID();
  const claim = await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${taskKey}))::text`;
    const existing = await tx.knowledgeAudioJob.findUnique({where:{key:taskKey}});
    if (existing?.url) return {url:existing.url};
    if (existing?.leaseUntil > new Date()) fail(409,'音轨正在准备，请稍后重试或使用设备朗读');
    if (existing?.reservedProfileId) await tx.readerEntitlement.updateMany({where:{profileId:existing.reservedProfileId,period:existing.reservedPeriod,consumed:{gt:0}},data:{consumed:{decrement:1}}});
    const period = await reserveAllowance(tx,profile);
    const lease = {leaseId,leaseUntil:new Date(Date.now()+600000),reservedProfileId:profile.id,reservedPeriod:period};
    await tx.knowledgeAudioJob.upsert({where:{key:taskKey},create:{key:taskKey,...lease},update:lease});
    return {period};
  });
  if (claim.url) return {url:claim.url,fromCache:true};
  try {
    const result = await (dependencies.synthesize || synthesizeSpeech)(text,{voiceId:voice});
    const url = await (dependencies.upload || uploadBuffer)(result.totalBuffer,'knowledge-audio','mp3',audioKey);
    await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))::text`;
      const changed = await tx.knowledgeAudioJob.updateMany({where:{key:taskKey,leaseId},data:{url,leaseId:null,leaseUntil:null,reservedProfileId:null,reservedPeriod:null}});
      if (!changed.count) fail(409,'音轨任务已更新，请重试');
      const latest = await tx.knowledgeAsset.findUnique({where:{key}});
      await tx.knowledgeAsset.update({where:{key},data:{audio:{...latest.audio,[audioKey]:url}}});
    });
    return {url,fromCache:false};
  } catch(error) {
    await db.$transaction(async tx => {
      const changed = await tx.knowledgeAudioJob.updateMany({where:{key:taskKey,leaseId},data:{leaseId:null,leaseUntil:null,reservedProfileId:null,reservedPeriod:null}});
      if (changed.count) await tx.readerEntitlement.update({where:{profileId_period:{profileId:profile.id,period:claim.period}},data:{consumed:{decrement:1}}});
    });
    throw error;
  }
}
