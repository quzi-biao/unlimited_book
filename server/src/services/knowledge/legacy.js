import prisma from '../../config/db.js';
import { contentIdentity } from './policy.js';

/** 将已授权设备的旧书架幂等导入个人树，不修改旧页面或公共发布状态。 */
export async function importLegacy(profile, deviceId) {
  if (!deviceId || profile.deviceId !== deviceId) return;
  const owner = await prisma.legacyImportOwner.upsert({where:{deviceId},create:{deviceId,profileId:profile.id},update:{}});
  if (owner.profileId !== profile.id) return;
  const books = await prisma.book.findMany({ where: { deviceId }, include: { pages: { include: { explanations: true }, orderBy: { createdAt: 'asc' } } } });
  for (const book of books) {
    const pending = [...book.pages]; const mapped = new Map();
    while (pending.length) {
      const index = pending.findIndex(p => !p.parentPageId || mapped.has(p.parentPageId) || !book.pages.some(n => n.id === p.parentPageId));
      // 历史循环／坏父引用孤立为根，导入不能无限递归。
      const page = pending.splice(index >= 0 ? index : 0,1)[0];
      const parent = mapped.get(page.parentPageId);
      const title = page.title || page.prompt?.slice(0,100) || book.title;
      const identity = contentIdentity({ action:'legacy',query:page.id,parentKey:parent?.assetKey,version:'legacy-1' });
      await prisma.knowledgeAsset.upsert({ where:{ key:identity.key },create:{ ...identity, action:'legacy', title, imageUrl:page.imageUrl,
        explanations:Object.fromEntries(page.explanations.map(e => [e.language,e.content])),state:'ready',reviewStatus:'private',authorProfileId:profile.id }, update:{} });
      const node = await prisma.readerNode.upsert({ where:{profileId_assetKey:{profileId:profile.id,assetKey:identity.key}},create:{ profileId:profile.id,assetKey:identity.key,parentId:parent?.id,openedAt:page.createdAt,lastSeenAt:page.createdAt,visits:1,mastery:1 },update:{} });
      mapped.set(page.id,node);
    }
  }
}
