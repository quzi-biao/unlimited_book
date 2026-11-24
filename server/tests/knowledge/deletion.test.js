import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import db from '../../src/config/db.js';
import router from '../../src/routes/knowledge/index.js';
import { explore } from '../../src/services/knowledge/generation.js';
import { deleteReaderNode } from '../../src/services/knowledge/deletion.js';
import { librarySnapshot, synchronize, ensureNode } from '../../src/services/knowledge/library.js';
import { readerReport } from '../../src/services/knowledge/reports.js';
import { monthPeriod } from '../../src/services/knowledge/policy.js';

const suite=process.env.KNOWLEDGE_INTEGRATION==='true'?test:test.skip;
const prefix='deletion-'+randomUUID(),profiles=[],devices=[],trees=[];
let server,base,owner,other;
const provider=async({assembly})=>({content:{title:assembly.layers.L3.query,domain:'测试',core:'核心',explanation:'文字',anchors:['一','二']},image:'bytes',verdict:{}});
const deps={produce:provider,upload:async()=>'/knowledge/starter-primary-2-water.svg'};
/** 创建仅供本轮验证的独立身份。 */
async function reader(){
 const device=await db.device.create({data:{fingerprint:prefix+devices.length,deviceCode:prefix+devices.length}});devices.push(device.id);
 const p=await db.readerProfile.create({data:{deviceId:device.id,ageBand:'adult'}});profiles.push(p.id);
 const {period,expiresAt}=monthPeriod();await db.readerEntitlement.create({data:{profileId:p.id,period,expiresAt,allowance:20}});
 return p;
}
/** 请求真实路由，身份及删除范围均由服务端验证。 */
async function request(p,path,body,method=body?'POST':'GET'){
 const token=jwt.sign({sub:p.deviceId,type:'device'},process.env.JWT_SECRET||'flipbook-jwt-secret-2024');
 const res=await fetch(base+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify({profileId:p.id,...body})}:{})});
 return {status:res.status,data:await res.json()};
}
/** 取最新版本后发起模拟生成，不调用外部模型。 */
async function make(p,query,parentKey,custom=deps){
 const fresh=await db.readerProfile.findUnique({where:{id:p.id}});
 return explore(fresh,{query,action:'text',parentKey,treeRevision:fresh.treeRevision},custom);
}
/** 学习记录保留稳定事件 ID，测试旧设备补传。 */
function event(key,type='open',payload={}){
 return {id:randomUUID(),assetKey:key,type,payload,occurredAt:new Date().toISOString()};
}
before(async()=>{
 if(process.env.KNOWLEDGE_INTEGRATION!=='true')return;
 const url=new URL(process.env.DATABASE_URL);assert(['localhost','127.0.0.1'].includes(url.hostname));assert.equal(url.pathname,'/knowledge');
 owner=await reader();other=await reader();
 const app=express();app.use(express.json());app.use(router);
 app.use((e,_req,res,_next)=>res.status(e.status||500).json({error:e.message}));
 await new Promise(resolve=>{server=app.listen(0,'127.0.0.1',resolve);});base='http://127.0.0.1:'+server.address().port;
});
after(async()=>{
 if(process.env.KNOWLEDGE_INTEGRATION!=='true')return;
 if(server)await new Promise(resolve=>server.close(resolve));
 await db.knowledgeTree.deleteMany({where:{id:{in:trees}}});
 const assets=await db.knowledgeAsset.findMany({where:{authorProfileId:{in:profiles}},select:{key:true}});
 await db.assemblyLog.deleteMany({where:{assetKey:{in:assets.map(a=>a.key)}}});
 await db.readerNode.deleteMany({where:{profileId:{in:profiles}}});
 await db.knowledgeCorrection.deleteMany({where:{profileId:{in:profiles}}});
 await db.readerEntitlement.deleteMany({where:{profileId:{in:profiles}}});
 await db.readerProfile.deleteMany({where:{id:{in:profiles}}});
 await db.knowledgeAsset.deleteMany({where:{key:{in:assets.map(a=>a.key)}}});
 await db.legacyImportOwner.deleteMany({where:{deviceId:{in:devices}}});
 await db.device.deleteMany({where:{id:{in:devices}}});await db.$disconnect();
});

suite('单页和整枝删除：账号隔离、保留子枝、删除同步、学习导出和共享缓存',async()=>{
 const root=await make(owner,prefix+'根'),middle=await make(owner,prefix+'中间',root.asset.key);
 const leaf=await make(owner,prefix+'叶',middle.asset.key),sibling=await make(owner,prefix+'旁枝',root.asset.key);
 const shared=await make(other,prefix+'根');assert.equal(shared.asset.key,root.asset.key);
 await synchronize(owner,[event(root.asset.key),event(middle.asset.key),event(middle.asset.key,'note',{text:'删除前笔记'}),event(leaf.asset.key),event(leaf.asset.key,'note',{text:'必须保留'}),event(leaf.asset.key,'connect',{targetId:middle.asset.key,reason:'旧连接'})]);
 assert.equal((await request(other,'/nodes/'+middle.asset.key,{scope:'branch',treeRevision:0},'DELETE')).status,404);
 assert.equal((await request(owner,'/nodes/'+middle.asset.key,{scope:'invalid',treeRevision:0},'DELETE')).status,400);
 assert.equal((await request(owner,'/nodes/'+middle.asset.key,{profileId:other.id,scope:'node',treeRevision:0},'DELETE')).status,409);
 const result=await request(owner,'/nodes/'+middle.asset.key,{scope:'node',treeRevision:0},'DELETE');
 assert.equal(result.status,200,JSON.stringify(result.data));assert.equal(result.data.profile.treeRevision,1);
 assert(result.data.deletedKeys.includes(middle.asset.key));assert(!result.data.nodes.some(n=>n.assetKey===middle.asset.key));
 const kept=result.data.nodes.find(n=>n.assetKey===leaf.asset.key);
 assert.equal(kept.parentKey,root.asset.key);assert.equal(kept.note,'必须保留');assert(kept.lit);
 assert(!result.data.events.some(e=>e.nodeId===middle.node.id || e.payload.targetId===middle.asset.key));
 const tombstone=await db.readerNode.findUnique({where:{id:middle.node.id}});
 assert(tombstone.deletedAt);assert.equal(tombstone.note,'删除前笔记');
 const late=[event(middle.asset.key,'note',{text:'旧设备不应复原'}),event(leaf.asset.key,'connect',{targetId:middle.asset.key,reason:'旧设备连接'})];
 assert.deepEqual(await synchronize(owner,late),late.map(e=>e.id));
 assert.equal((await db.readerNode.findUnique({where:{id:middle.node.id}})).note,'删除前笔记');
 assert.equal((await request(owner,'/nodes/'+middle.asset.key,{scope:'node',treeRevision:0},'DELETE')).status,200);
 assert.equal((await request(owner,'/nodes/'+root.asset.key,{scope:'branch',treeRevision:0},'DELETE')).status,409);
 assert.equal((await request(owner,'/nodes/'+root.asset.key,{scope:'branch',treeRevision:1},'DELETE')).status,200);
 const snapshot=await librarySnapshot(owner);
 for(const x of [root,middle,leaf,sibling])assert(snapshot.deletedKeys.includes(x.asset.key));
 const exported=(await request(owner,'/export')).data;
 assert(!exported.nodes.some(n=>[root,middle,leaf,sibling].some(x=>x.asset.key===n.assetKey)));
 assert.equal(exported.events.length,0);
 assert.equal((await request(owner,'/learning')).data.report.expressions.length,0);
 assert.equal((await readerReport(owner.id,7)).tree.length,0);
 assert((await librarySnapshot(other)).nodes.some(n=>n.assetKey===root.asset.key));
 assert.equal((await db.knowledgeAsset.findUnique({where:{key:root.asset.key}})).state,'ready');
 await assert.rejects(ensureNode(db,owner,root.asset.key),{status:410});
 await assert.rejects(explore(await db.readerProfile.findUnique({where:{id:owner.id}}),{query:prefix+'根'},deps),{status:410});
 const regenerated=await make(owner,prefix+'根');
 assert.notEqual(regenerated.asset.key,root.asset.key);assert.equal(regenerated.fromCache,false);
 assert.equal((await make(owner,prefix+'根')).asset.key,regenerated.asset.key);
});

suite('公共节点不能通过个人删除入口移除',async()=>{
 const asset=await db.knowledgeAsset.create({data:{key:prefix+'public',identity:{},action:'curated',title:'公共节点',state:'ready',reviewStatus:'approved',authorProfileId:owner.id}});
 const tree=await db.knowledgeTree.create({data:{title:prefix,status:'published'}});trees.push(tree.id);
 await db.knowledgeNode.create({data:{treeId:tree.id,assetKey:asset.key,label:asset.title,domain:'科学'}});
 await ensureNode(db,owner,asset.key);
 const p=await db.readerProfile.findUnique({where:{id:owner.id}});
 assert.equal((await request(p,'/nodes/'+asset.key,{scope:'branch',treeRevision:p.treeRevision},'DELETE')).status,403);
 assert.equal(await db.knowledgeNode.count({where:{assetKey:asset.key}}),1);
});

suite('生成期间删除分枝，结束后不出现悬空节点且返还生成额度',async()=>{
 const root=await make(other,prefix+'并发父页');
 let release,start;
 const begun=new Promise(resolve=>{start=resolve;}),gate=new Promise(resolve=>{release=resolve;});
 const pending=make(other,prefix+'尚在生成',root.asset.key,{...deps,produce:async input=>{start();await gate;return provider(input);}});
 const rejection=assert.rejects(pending,{status:409});
 await begun;
 const p=await db.readerProfile.findUnique({where:{id:other.id}});
 const {period}=monthPeriod();
 const before=await db.readerEntitlement.findUnique({where:{profileId_period:{profileId:other.id,period}}});
 await deleteReaderNode(p,root.asset.key,{scope:'branch',treeRevision:p.treeRevision});
 release();await rejection;
 assert.equal((await db.readerEntitlement.findUnique({where:{profileId_period:{profileId:other.id,period}}})).consumed,before.consumed-1);
 assert(!await db.readerNode.findFirst({where:{profileId:other.id,deletedAt:null,parentId:root.node.id}}));
});
