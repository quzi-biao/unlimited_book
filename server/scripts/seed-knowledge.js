import prisma from '../src/config/db.js';
import { contentIdentity, validateTree } from '../src/services/knowledge/policy.js';
import { starterTrees, starterSvg } from '../src/services/knowledge/starterContent.js';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

/** 仅显式指向本机数据库时装入入门示例；不覆盖已有编辑内容。 */
export async function seedKnowledge(db = prisma) {
  const url = new URL(process.env.DATABASE_URL);
  if (!['localhost','127.0.0.1','[::1]'].includes(url.hostname)) throw new Error('入门示例脚本仅允许本机数据库');
  const folder = path.resolve(import.meta.dirname,'../../web/public/knowledge');
  await mkdir(folder,{recursive:true});
  for (const spec of starterTrees) {
    const tree = await db.knowledgeTree.upsert({where:{id:spec.id},create:{id:spec.id,title:spec.title,grade:spec.grade,curriculum:spec.curriculum,description:'从身边的观察开始，走向相邻学科。原创教学示例。'},update:{}});
    const map = new Map();
    for (const item of spec.nodes) {
      const parent = map.get(item.parent);
      const identity = contentIdentity({parentKey:parent?.assetKey,action:'curated',query:item.title,version:'starter-1'});
      const filename = `${spec.id}-${item.id}.svg`;
      await writeFile(path.join(folder,filename),starterSvg(item));
      await db.knowledgeAsset.upsert({where:{key:identity.key},create:{...identity,parentKey:parent?.assetKey || null,action:'curated',title:item.title,domain:item.domain,imageUrl:`/knowledge/${filename}`,explanations:{zh:item.text},anchors:item.anchors,state:'ready',reviewStatus:'approved',reviewNote:'原创入门示例，随源码人工检查'},update:{parentKey:parent?.assetKey || null}});
      const node = await db.knowledgeNode.upsert({where:{id:`${spec.id}-${item.id}`},create:{id:`${spec.id}-${item.id}`,treeId:tree.id,parentId:parent?.id,assetKey:identity.key,label:item.title,domain:item.domain,relation:item.relation || 'related',order:spec.nodes.indexOf(item)},update:{}});
      map.set(item.id,node);
    }
    if (tree.status === 'draft' && tree.revision === 1) {
      // 本地示例插图不是按图上子节点跳转设计的；真实编辑发布仍要求完整人工标注。
      validateTree(await db.knowledgeNode.findMany({where:{treeId:tree.id},include:{asset:true}}), {requireChildRegions:false});
      await db.knowledgeTree.update({where:{id:tree.id},data:{status:'published'}});
    }
  }
}

if (process.argv[1] === import.meta.filename) {
  seedKnowledge().then(() => console.log('两棵本地入门示例树已准备')).finally(() => prisma.$disconnect());
}
