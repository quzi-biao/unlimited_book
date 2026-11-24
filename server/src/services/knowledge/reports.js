import prisma from '../../config/db.js';
import { observationReport } from './learning.js';
import { publicAsset } from './library.js';
import { visibleEvents } from './deletion.js';

/** 只展示走过的枝叶，不引入课程分母、覆盖率或待补领域。 */
export async function readerReport(profileId, days, db = prisma) {
  const nodes=await db.readerNode.findMany({where:{profileId,deletedAt:null,openedAt:{not:null}},include:{asset:true}});
  const events=visibleEvents(await db.learningEvent.findMany({where:{profileId,occurredAt:{gte:new Date(Date.now()-days*86400000)}},orderBy:{occurredAt:'asc'}}),nodes);
  const byId=new Map(nodes.map(n=>[n.id,n]));
  const tree=nodes.filter(n=>n.asset.state==='ready'&&n.asset.reviewStatus!=='rejected').map(n=>({assetKey:n.assetKey,parentKey:byId.get(n.parentId)?.assetKey || null,asset:publicAsset(n.asset),lit:true}));
  return {...observationReport(nodes,events,days),tree};
}

/** 报告以周／月为节奏出现在应用内；不会向第三方发送学习记录。 */
export async function reportDigest(profile, db = prisma) {
  if (!profile.username || profile.ageBand !== 'adult') return {notices:[]};
  const children=await db.readerProfile.findMany({where:{guardianId:profile.id},select:{id:true,displayName:true}});
  const now=new Date();const monday=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()-(now.getUTCDay()+6)%7));
  const notices=[];
  for (const child of children) notices.push({id:`${child.id}:${monday.toISOString().slice(0,10)}`,title:`${child.displayName}的本周探险报`,report:await readerReport(child.id,7,db)});
  if (!children.length) notices.push({id:`${profile.id}:${now.toISOString().slice(0,7)}`,title:'我的知识树月报',report:await readerReport(profile.id,30,db)});
  return {notices};
}
