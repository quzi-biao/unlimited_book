import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../../src/config/db.js';
import router from '../../src/routes/knowledge/index.js';
import adminRouter from '../../src/routes/admin/knowledge.js';
import { requireAdmin } from '../../src/routes/admin/auth.js';
import { knowledgeBoundary } from '../../src/middleware/knowledgeBoundary.js';
import { seedKnowledge } from '../../scripts/seed-knowledge.js';
import { explore } from '../../src/services/knowledge/generation.js';
import { synchronize, librarySnapshot, ensureNode } from '../../src/services/knowledge/library.js';
import { handleOrderPaid } from '../../src/services/paymentSettlement.js';
import { requestRefund } from '../../src/services/paymentRefund.js';
import { knowledgeAudio } from '../../src/services/knowledge/audio.js';
import { monthPeriod } from '../../src/services/knowledge/policy.js';
import { repairReaderRoots } from '../../scripts/repair-reader-roots.js';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const enabled = process.env.KNOWLEDGE_INTEGRATION === 'true';
const suite = enabled ? test : test.skip;
const prefix = `test-${randomUUID()}`;
let server,base,device,profile,token,accountToken;
const created = []; const trees=[]; const editorialAssets=[];

/** 创建隔离读者，使用本机测试数据库。 */
async function reader(data = {}) {
  const row = await prisma.readerProfile.create({data:{displayName:prefix,ageBand:'adult',...data}});
  created.push(row.id); return row;
}
/** 请求经过真实 JWT、中间件、路由与 PostgreSQL。 */
async function request(path,body,options = {}) {
  if (path.endsWith('/sync') || path.endsWith('/explore')) body = {profileId:profile.id,...body};
  const response = await fetch(`${base}${path}`,{method:options.method || (body === undefined?'GET':'POST'),headers:{'Content-Type':'application/json',Authorization:`Bearer ${options.token || token}`,...(accountToken && !options.guest ? {'X-Reader-Token':accountToken} : {}),...options.headers},...(body === undefined?{}:{body:JSON.stringify(body)})});
  return {status:response.status,data:await response.json()};
}
/** 随机事件 ID 用于测试重放，而非替代真正的数据库去重。 */
function event(assetKey,type='open',payload={}) {return {id:randomUUID(),assetKey,type,payload,occurredAt:new Date().toISOString()};}

before(async () => {
  if (!enabled) return;
  const url = new URL(process.env.DATABASE_URL);
  assert(['127.0.0.1','localhost'].includes(url.hostname),'集成测试只能访问本机数据库');
  assert.equal(url.pathname,'/knowledge','必须使用独立 knowledge 测试库');
  await seedKnowledge();
  device = await prisma.device.create({data:{fingerprint:prefix,deviceCode:prefix}});
  profile = await reader({deviceId:device.id});
  token = jwt.sign({sub:device.id,type:'device'},process.env.JWT_SECRET || 'flipbook-jwt-secret-2024');
  const app = express();app.use(express.json());app.use('/api/knowledge',router);
  app.use('/api/admin/knowledge',requireAdmin,adminRouter);
  app.use('/api',knowledgeBoundary);
  app.post('/api/ai/generate-image',(_req,res) => res.json({bypassed:true}));
  app.get('/api/books',(_req,res) => res.json({bypassed:true}));
  app.use((error,_req,res,_next) => res.status(error.status || 500).json({error:error.message}));
  await new Promise(resolve => {server=app.listen(0,'127.0.0.1',resolve);});
  base=`http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (!enabled) return;
  if(server) await new Promise(resolve => server.close(resolve));
  await prisma.knowledgeTree.deleteMany({where:{id:{in:trees}}});
  const assets=await prisma.knowledgeAsset.findMany({where:{authorProfileId:{in:created}},select:{key:true}});
  await prisma.knowledgeAudioJob.deleteMany({where:{OR:assets.map(a=>({key:{startsWith:a.key+':'}}))}});
  await prisma.assemblyLog.deleteMany({where:{assetKey:{in:assets.map(a=>a.key)}}});
  await prisma.readerNode.deleteMany({where:{profileId:{in:created}}});
  await prisma.knowledgeAsset.deleteMany({where:{key:{in:editorialAssets}}});
  await prisma.knowledgeAsset.deleteMany({where:{key:{in:assets.map(a=>a.key)}}});
  await prisma.knowledgeCorrection.deleteMany({where:{profileId:{in:created}}});
  await prisma.readerEntitlement.deleteMany({where:{profileId:{in:created}}});
  await prisma.guardianInvite.deleteMany({where:{childId:{in:created}}});
  await prisma.readerProfile.deleteMany({where:{id:{in:created}}});
  if(device) {
    await prisma.payment.deleteMany({where:{order:{deviceId:device.id}}});
    await prisma.order.deleteMany({where:{deviceId:device.id}});
    await prisma.pointLedger.deleteMany({where:{deviceId:device.id}});
    await prisma.deviceWallet.deleteMany({where:{deviceId:device.id}});
    await prisma.legacyImportOwner.deleteMany({where:{deviceId:device.id}});
  }
  if(device)await prisma.device.delete({where:{id:device.id}});
  await prisma.$disconnect();
});

suite('新身份首次即有公共树，节点未探索前为暗色，不调用生成',async () => {
  const result=await request('/api/knowledge/library');assert.equal(result.status,200);
  assert(result.data.trees.length>=2);assert.equal(result.data.nodes.length,6);
  assert(result.data.nodes.every(n=>!n.lit));profile.selectedTreeId=result.data.profile.selectedTreeId;
  const prepared=await explore(profile,{query:'一滴水的旅行',action:'text'},{produce:()=>{throw new Error('不能调 AI');}});
  assert.equal(prepared.fromCache,true);
});

suite('切换公共内容来源后个人树保留旧分枝；安全模式只重开已有公开轨迹',async()=>{
  const first=(await librarySnapshot(profile)).nodes.find(node=>node.asset.title==='一滴水的旅行');
  const secondTree=await prisma.knowledgeTree.findFirst({where:{status:'published',id:{not:profile.selectedTreeId}},include:{nodes:{include:{asset:true}}}});
  assert(first&&secondTree?.nodes.length);
  await synchronize(profile,[event(first.assetKey)]);
  const prior=(await librarySnapshot(profile)).nodes.find(node=>node.assetKey===first.assetKey);
  assert.equal(prior.lit,true);
  await prisma.readerProfile.update({where:{id:profile.id},data:{selectedTreeId:secondTree.id,mode:'safe'}});
  const changed=await librarySnapshot({...profile,selectedTreeId:secondTree.id,mode:'safe'});
  const retained=changed.nodes.find(node=>node.assetKey===first.assetKey);
  assert(retained,'已探索话题仍是同一棵个人树的一部分');assert.equal(retained.lit,true);
  assert(changed.nodes.some(node=>node.treeId===secondTree.id&&!node.lit),'新来源作为未探索的暗分枝可见');
  await synchronize({...profile,selectedTreeId:secondTree.id,mode:'safe'},[event(first.assetKey)]);
  const otherSource=await prisma.knowledgeNode.findFirst({where:{treeId:first.treeId,assetKey:{not:first.assetKey}}});
  const response=await request('/api/knowledge/sync',{events:[event(otherSource.assetKey)]});
  assert.equal(response.status,403,'安全模式不能直接打开已发布但未选用的其他公共树内容');
  await prisma.readerProfile.update({where:{id:profile.id},data:{selectedTreeId:first.treeId,mode:'infinite'}});
  await prisma.learningEvent.deleteMany({where:{profileId:profile.id}});
  await prisma.readerNode.deleteMany({where:{profileId:profile.id}});
  profile.selectedTreeId=first.treeId;profile.mode='infinite';
});

suite('离线事件重传和并发同步只记一次；父引用正确且只点亮访问节点',async () => {
  const snapshot=await librarySnapshot(profile);const leaf=snapshot.nodes.find(n=>n.asset.title==='云里有什么');
  const opened=event(leaf.assetKey);
  const results=await Promise.all(Array.from({length:5},()=>request('/api/knowledge/sync',{events:[opened]})));
  assert(results.every(r=>r.status===200),JSON.stringify(results));
  const node=await prisma.readerNode.findUnique({where:{profileId_assetKey:{profileId:profile.id,assetKey:leaf.assetKey}}});
  assert.equal(node.visits,1);assert(node.parentId);
  assert.equal((await prisma.learningEvent.count({where:{profileId:profile.id,id:opened.id}})),1);
  const updated=(await request('/api/knowledge/library')).data;
  assert.equal(updated.nodes.filter(n=>n.lit).length,1);
});

suite('同步批次任意事件非法时全部回滚；跨账号节点不能写入',async () => {
  const snapshot=await librarySnapshot(profile);const key=snapshot.nodes[0].assetKey;
  const first=event(key);const bad=event(key,'dwell',{seconds:999});
  const response=await request('/api/knowledge/sync',{events:[first,bad]});assert.equal(response.status,400);
  assert.equal(await prisma.learningEvent.count({where:{profileId:profile.id,id:first.id}}),0);
  const foreign=event('not-owned-or-published');
  assert.equal((await request('/api/knowledge/sync',{events:[foreign]})).status,403);
});

suite('笔记乱序到达保留较新显示值，原始版本都可导出',async () => {
  const key=(await librarySnapshot(profile)).nodes[0].assetKey;
  const newer={...event(key,'note',{text:'新笔记'}),occurredAt:new Date(Date.now()-1000).toISOString()};
  const older={...event(key,'note',{text:'旧笔记'}),occurredAt:new Date(Date.now()-10000).toISOString()};
  await synchronize(profile,[newer]);await synchronize(profile,[older]);
  const result=await request('/api/knowledge/export');assert.equal(result.status,200);
  assert.equal(result.data.nodes.find(n=>n.assetKey===key).note,'新笔记');
  assert(result.data.events.some(e=>e.payload.text==='旧笔记'));assert(!('passwordHash' in result.data.profile));
});

suite('设置冲突返回 409；安全模式直接请求旧生成接口与旧书架都被拒绝',async () => {
  const before=await prisma.readerProfile.findUnique({where:{id:profile.id}});
  const result=await request('/api/knowledge/account/settings',{mode:'safe',revision:before.settingsRevision},{method:'PATCH'});assert.equal(result.status,200);
  assert.equal((await request('/api/knowledge/account/settings',{mode:'infinite',revision:before.settingsRevision},{method:'PATCH'})).status,409);
  assert.equal((await request('/api/knowledge/account/settings',{mode:'infinite'},{method:'PATCH'})).status,400);
  assert.equal((await request('/api/ai/generate-image',{query:'绕过'})).status,403);
  assert.equal((await request('/api/books')).status,403);
  assert.equal((await request('/api/knowledge/explore',{query:'未发布问题'})).status,403);
  const safe=await prisma.readerProfile.findUnique({where:{id:profile.id}});
  assert.equal((await explore(safe,{query:'一滴水的旅行'})).fromCache,true);
  await prisma.readerProfile.update({where:{id:profile.id},data:{mode:'infinite'}});
});

suite('同一路径多读者并发只调一次生成，命中不扣额度；失败自动返还',async () => {
  const a=await reader();const b=await reader();const {period,expiresAt}=monthPeriod();
  for(const p of [a,b])await prisma.readerEntitlement.create({data:{profileId:p.id,period,expiresAt,allowance:5}});
  let calls=0;let release;const gate=new Promise(resolve=>{release=resolve;});
  const deps={produce:async()=>{calls++;await gate;return{content:{title:'并发分枝',domain:'科学',explanation:'可核查文字',anchors:['问题一','问题二']},image:'bytes',verdict:{textSafe:true,imageSafe:true,factConsistent:true}};},upload:async()=>'/knowledge/test.svg'};
  const input={query:`并发-${prefix}`,action:'text'};
  const first=explore(a,input,deps);
  for(let i=0;i<30 && calls===0;i++)await new Promise(r=>setTimeout(r,10));
  const second=await explore(b,input,deps);assert.equal(second.pending,true);
  release();const done=await first;assert.equal(done.fromCache,false);
  const reused=await explore(b,input,deps);assert.equal(reused.fromCache,true);assert.equal(calls,1);assert.equal(done.asset.key,reused.asset.key);
  assert.equal((await prisma.readerEntitlement.findUnique({where:{profileId_period:{profileId:b.id,period}}})).consumed,0);
  await assert.rejects(explore(a,{query:`失败-${prefix}`},{...deps,produce:async()=>{throw new Error('provider failed');}}),/provider failed/);
  assert.equal((await prisma.readerEntitlement.findUnique({where:{profileId_period:{profileId:a.id,period}}})).consumed,1);
  const safe={...a,mode:'safe',selectedTreeId:'starter-primary-2'};
  await synchronize(safe,[event(done.asset.key,'note',{text:'切换模式前的离线笔记'})]);
  assert(!(await librarySnapshot(safe)).nodes.some(n=>n.assetKey===done.asset.key));
});

suite('历史误挂接精确修复：备份、幂等、学习记录保留，后续上下文与缓存沿修正后的路径',async()=>{
  const p=await reader(), {period,expiresAt}=monthPeriod();
  await prisma.readerEntitlement.create({data:{profileId:p.id,period,expiresAt,allowance:10}});
  const calls=[];
  const deps={produce:async input=>{
    calls.push(input);
    return {content:{title:input.assembly.layers.L3.query,domain:'测试',core:'说明',explanation:'本地验证',anchors:['一','二']},image:'bytes',verdict:{}};
  },upload:async()=>'/knowledge/starter-primary-2-water.svg'};
  const quantum=await explore(p,{query:prefix+'量子力学'},deps);
  const river=await explore(p,{query:'长江',parentKey:quantum.asset.key},deps);
  const yellow=await explore(p,{query:'黄河',parentKey:quantum.asset.key},deps);
  const child=await explore(p,{query:'支流',parentKey:river.asset.key},deps);
  assert(!('lineage' in (await prisma.knowledgeAsset.findUnique({where:{key:child.asset.key}})).identity));
  assert(calls.at(-1).parent.ancestry.some(a=>a.title===quantum.asset.title));
  await synchronize(p,[event(river.asset.key),event(river.asset.key,'note',{text:'保留原笔记'}),event(child.asset.key),event(yellow.asset.key)]);
  const before=await librarySnapshot(p);
  const plan={profileId:p.id,nodes:[river,yellow].map(result=>({id:result.node.id,assetKey:result.asset.key,
    query:result.asset.title,expectedParentId:quantum.node.id,expectedParentKey:quantum.asset.key}))};
  const directory=await mkdtemp(join(tmpdir(),'reader-roots-'));
  const backupFile=join(directory,'before.json');
  try {
    const preview=await repairReaderRoots(prisma,plan);
    assert.equal(preview.applied,false);assert.equal(preview.changed.length,2);
    const invalid={...plan,nodes:[plan.nodes[0],{...plan.nodes[1],expectedParentId:river.node.id,expectedParentKey:river.asset.key}]};
    await assert.rejects(repairReaderRoots(prisma,invalid,{apply:true,backupFile}),/挂接已变化/);
    assert.equal((await prisma.readerNode.findUnique({where:{id:river.node.id}})).parentId,quantum.node.id);
    const done=await repairReaderRoots(prisma,plan,{apply:true,backupFile});
    assert.equal(done.changed.length,2);
    const backup=JSON.parse(await readFile(backupFile,'utf8'));
    assert.equal(backup.nodes.find(n=>n.id===river.node.id).parentId,quantum.node.id);
    const after=await librarySnapshot(p);
    for(const result of [river,yellow]) {
      const original=before.nodes.find(n=>n.id===result.node.id),fixed=after.nodes.find(n=>n.id===result.node.id);
      assert.deepEqual(fixed,{...original,parentId:null,parentKey:null});
    }
    assert.deepEqual(after.nodes.find(n=>n.id===child.node.id),before.nodes.find(n=>n.id===child.node.id));
    assert.deepEqual(after.events,before.events);
    assert.deepEqual(await repairReaderRoots(prisma,plan,{apply:true,backupFile}),{applied:false,changed:[]});
    const next=await explore(p,{query:'支流',parentKey:river.asset.key},deps);
    assert.notEqual(next.asset.key,child.asset.key);
    assert.deepEqual(calls.at(-1).parent.ancestry,[]);
    assert.equal(next.node.parentId,river.node.id);
    const cached=await explore(p,{query:'支流',parentKey:river.asset.key},deps);
    assert(cached.fromCache);assert.equal(cached.asset.key,next.asset.key);
    await explore(p,{query:'更深入的问题',parentKey:child.asset.key},deps);
    assert.deepEqual(calls.at(-1).parent.ancestry.map(a=>a.title),['长江']);
  } finally {await rm(directory,{recursive:true,force:true});}
});

suite('多个不同问题并发争用同一月额度时不会超额',async()=>{
  const p=await reader();const {period,expiresAt}=monthPeriod();
  await prisma.readerEntitlement.create({data:{profileId:p.id,period,expiresAt,allowance:2}});
  const deps={produce:async()=>({content:{title:'额度并发',domain:'数学',explanation:'本地测试',anchors:['一','二']},image:'bytes',verdict:{}}),upload:async()=>'/knowledge/test.svg'};
  const results=await Promise.allSettled(Array.from({length:5},(_,i)=>explore(p,{query:`budget-${prefix}-${i}`},deps)));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,2);
  assert(results.filter(r=>r.status==='rejected').every(r=>r.reason.status===402));
  assert.equal((await prisma.readerEntitlement.findUnique({where:{profileId_period:{profileId:p.id,period}}})).consumed,2);
});

suite('注册保留个人轨迹，账号 JWT 可跨设备读取，不能成为管理员',async () => {
  const registration=await request('/api/knowledge/account/register',{username:`r_${prefix}`,password:'test-password-12345',ageBand:'adult',displayName:'测试读者'});
  assert.equal(registration.status,200,JSON.stringify(registration.data));
  assert.equal(registration.data.profile.id,profile.id);
  accountToken=registration.data.token;
  const login=await request('/api/knowledge/account/login',{username:`r_${prefix}`,password:'test-password-12345'});assert.equal(login.status,200);
  const cross=await request('/api/knowledge/library',undefined,{headers:{'X-Reader-Token':login.data.token}});assert.equal(cross.status,200);assert(cross.data.nodes.some(n=>n.lit));
  assert.equal((await request('/api/admin/knowledge',undefined,{token:login.data.token})).status,401);
  assert.equal((await request('/api/knowledge/library',undefined,{headers:{'X-Reader-Token':'expired'}})).status,401);
});

suite('儿童绑定只能使用一次邀请码，诊断与邻域均须监护许可',async () => {
  const child=await reader({username:`c_${prefix}`,ageBand:'minor'});
  const readerJwt=jwt.sign({sub:child.id,type:'reader'},process.env.JWT_SECRET||'flipbook-jwt-secret-2024');
  const headers={'X-Reader-Token':readerJwt};
  assert.equal((await request('/api/knowledge/diagnosis',{treeId:'starter-primary-2',accepted:true},{headers})).status,403);
  assert.equal((await request('/api/knowledge/nearby/permit',{enabled:true},{headers})).status,403);
  const invitation=await request('/api/knowledge/guardian/invite',{}, {headers});assert.equal(invitation.status,200);
  const accepted=await request('/api/knowledge/guardian/accept',{code:invitation.data.code});assert.equal(accepted.status,200,JSON.stringify(accepted));
  assert.equal((await request('/api/knowledge/guardian/accept',{code:invitation.data.code})).status,400);
  const linked=await prisma.readerProfile.findUnique({where:{id:child.id}});assert.equal(linked.guardianId,profile.id);assert.equal(linked.mode,child.mode);
  assert.equal((await request(`/api/knowledge/guardian/children/${child.id}`,{revision:linked.settingsRevision,permissions:{diagnosis:true},personalization:false},{method:'PATCH'})).status,200);
  assert.equal((await request('/api/knowledge/diagnosis',{treeId:'starter-primary-2',accepted:true},{headers})).status,200);
  const fresh=await prisma.readerProfile.findUnique({where:{id:child.id}});
  assert.equal(fresh.mode, child.mode);
  const changed=await request('/api/knowledge/account/settings',{revision:fresh.settingsRevision,preferences:{personalization:true}},{headers,method:'PATCH'});
  assert.equal(changed.data.profile.preferences.personalization,false);
  let revision = changed.data.profile.settingsRevision;
  for (const mode of ['safe', 'infinite']) {
    const saved = await request('/api/knowledge/account/settings', {mode, revision}, {headers, method:'PATCH'});
    assert.equal(saved.status, 200);
    assert.equal(saved.data.profile.mode, mode);
    revision = saved.data.profile.settingsRevision;
  }
  const report=await request(`/api/knowledge/guardian/children/${child.id}/report`);
  assert.equal(report.status,200);assert.deepEqual(report.data.report.tree,[]);
  const digest=await request('/api/knowledge/reports');assert.equal(digest.status,200);
  assert(digest.data.notices.some(n=>n.title.includes('本周探险报')));
  assert.equal((await request(`/api/knowledge/guardian/children/${profile.id}/report`,undefined,{headers})).status,404);
});


suite('退出账号产生独立访客；离线批次不得写入切换后的账号',async()=>{
  const guest=await request('/api/knowledge/library',undefined,{guest:true});
  assert.equal(guest.status,200);assert.notEqual(guest.data.profile.id,profile.id);
  assert.equal(guest.data.deviceShelf,false);
  assert.equal((await request('/api/books',undefined,{guest:true})).status,403);
  created.push(guest.data.profile.id);assert(!guest.data.nodes.some(n=>n.lit));
  const wrong=await request('/api/knowledge/sync',{profileId:profile.id,events:[]},{guest:true});
  assert.equal(wrong.status,409);
  const restored=await request('/api/knowledge/library');assert.equal(restored.data.profile.id,profile.id);
  assert.equal(restored.data.deviceShelf,true);
  assert.equal((await request('/api/books')).status,200);
});

suite('支付回调并发只入账一次，金额不符不发放权益',async()=>{
  const order=await prisma.order.create({data:{deviceId:device.id,readerProfileId:profile.id,amount:1200,points:120,monthlyAllowance:30}});
  const payment={transaction_id:`wx-${prefix}`,amount:{total:1200,currency:'CNY'}};
  await assert.rejects(handleOrderPaid(order.id,{...payment,amount:{total:1,currency:'CNY'}}),/金额/);
  const results=await Promise.all(Array.from({length:5},()=>handleOrderPaid(order.id,payment)));
  assert.equal(results.filter(r=>!r.alreadyPaid).length,1);
  assert.equal((await prisma.deviceWallet.findUnique({where:{deviceId:device.id}})).balance,120);
  const {period}=monthPeriod();
  assert.equal((await prisma.readerEntitlement.findUnique({where:{profileId_period:{profileId:profile.id,period}}})).allowance,30);
  assert.equal(await prisma.payment.count({where:{orderId:order.id}}),1);
});

suite('退款受理不算成功，重复到账确认只撤回一次点数与原月份额度',async()=>{
  const order=await prisma.order.create({data:{deviceId:device.id,readerProfileId:profile.id,amount:1800,points:180,monthlyAllowance:50}});
  const paid={transaction_id:`refund-${prefix}`,amount:{total:1800,currency:'CNY'}};
  await handleOrderPaid(order.id,paid);
  const balance=(await prisma.deviceWallet.findUnique({where:{deviceId:device.id}})).balance;
  const {period}=monthPeriod();
  const allowance=(await prisma.readerEntitlement.findUnique({where:{profileId_period:{profileId:profile.id,period}}})).allowance;
  const data={out_trade_no:order.id,out_refund_no:`REFUND_${order.id}`,amount:{total:1800,refund:1800},status:'PROCESSING'};
  const deps={refund:async()=>({data}),query:async()=>({data})};
  assert.equal((await requestRefund(order.id,deps)).status,'refund_pending');
  await handleOrderPaid(order.id,paid);
  assert.equal((await prisma.deviceWallet.findUnique({where:{deviceId:device.id}})).balance,balance);
  await assert.rejects(requestRefund(order.id,{query:async()=>({data:{...data,amount:{total:1800,refund:1}}})}),/不符/);
  data.status='SUCCESS';
  await Promise.all(Array.from({length:5},()=>requestRefund(order.id,deps)));
  assert.equal((await prisma.deviceWallet.findUnique({where:{deviceId:device.id}})).balance,balance-180);
  assert.equal((await prisma.readerEntitlement.findUnique({where:{profileId_period:{profileId:profile.id,period}}})).allowance,allowance-50);
  assert.equal(await prisma.pointLedger.count({where:{refId:order.id,type:'refund'}}),1);
});

suite('多设备自评逆序补传仍得到相同掌握状态与到期日',async()=>{
  const a=await reader();const b=await reader();
  const key=(await librarySnapshot(a)).nodes[0].assetKey;await librarySnapshot(b);
  const review=(days,rating)=>({...event(key,'review',{rating}),occurredAt:new Date(Date.now()-days*86400000).toISOString()});
  const records=[review(5,'remembered'),review(3,'understood'),review(1,'again')];
  await synchronize(a,records);await synchronize(b,[...records].reverse());
  const states=await Promise.all([a,b].map(p=>prisma.readerNode.findUnique({where:{profileId_assetKey:{profileId:p.id,assetKey:key}},select:{mastery:true,reviewStep:true,nextReviewAt:true}})));
  assert.deepEqual(states[0],states[1]);assert.equal(states[0].mastery,1);
});


suite('编辑审核与全局发布是独立步骤；拒绝后读者不能继续打开资源',async()=>{
  const admin=jwt.sign({sub:'test-admin',type:'admin',role:'superadmin'},process.env.JWT_SECRET||'flipbook-jwt-secret-2024');
  const opts={token:admin};
  const result=await request('/api/admin/knowledge/trees',{title:prefix,grade:'test'},opts);assert.equal(result.status,201);
  const tree=result.data.tree;trees.push(tree.id);
  assert.equal((await request(`/api/admin/knowledge/trees/${tree.id}`,{status:'published',revision:tree.revision},{...opts,method:'PATCH'})).status,400);
  const node=await request(`/api/admin/knowledge/trees/${tree.id}/nodes`,{title:'审核节点',domain:'科学',explanation:'经人工核查的说明',imageUrl:'/knowledge/water.svg',reviewed:true},opts);
  assert.equal(node.status,201,JSON.stringify(node));editorialAssets.push(node.data.node.assetKey);
  const edited=await request(`/api/admin/knowledge/trees/${tree.id}/nodes/${node.data.node.id}`,{label:'修改后的节点',domain:'物理',relation:'cause'},{...opts,method:'PATCH'});
  assert.equal(edited.status,200,JSON.stringify(edited));
  assert.deepEqual({label:edited.data.node.label,domain:edited.data.node.domain,relation:edited.data.node.relation},{label:'修改后的节点',domain:'物理',relation:'cause'});
  assert.equal((await prisma.knowledgeAsset.findUnique({where:{key:node.data.node.assetKey}})).title,'审核节点');
  assert(!(await request('/api/knowledge/library')).data.trees.some(t=>t.id===tree.id));
  assert.equal((await request(`/api/admin/knowledge/trees/${tree.id}`,{status:'published',revision:tree.revision+2},{...opts,method:'PATCH'})).status,200);
  assert((await request('/api/knowledge/library')).data.trees.some(t=>t.id===tree.id));
  const editedSnapshot=await librarySnapshot({...profile,selectedTreeId:tree.id,mode:'safe'});
  assert.equal(editedSnapshot.nodes.find(item=>item.globalNodeId===node.data.node.id)?.asset.title,'修改后的节点');
  assert.equal(editedSnapshot.nodes.find(item=>item.globalNodeId===node.data.node.id)?.asset.domain,'物理');
  const generator=await reader({mode:'infinite',selectedTreeId:tree.id});
  const {period,expiresAt}=monthPeriod();
  await prisma.readerEntitlement.create({data:{profileId:generator.id,period,expiresAt,allowance:3}});
  let parentTitle='';
  const generated=await explore(generator,{query:`子节点-${prefix}`,action:'text',parentKey:node.data.node.assetKey,treeRevision:0},{
    produce:async({parent})=>{parentTitle=parent.title;return{content:{title:'新子节点',domain:'物理',core:'核心概念',explanation:'扩展内容',anchors:[]},image:'test',verdict:{textSafe:true,imageSafe:true,factConsistent:true,styleConsistent:true}};},
    upload:async()=>'/knowledge/test-edited-parent.svg',
  });
  assert.equal(parentTitle,'修改后的节点');
  assert(generated.asset.key);
  assert((await prisma.knowledgeAsset.findUnique({where:{key:generated.asset.key}})).identity.lineage.some(item=>item.label==='修改后的节点'));
  const viewed=await request('/api/knowledge/sync',{events:[event(node.data.node.assetKey)]});assert.equal(viewed.status,200);
  assert.equal((await request(`/api/admin/knowledge/reviews/${node.data.node.assetKey}`,{status:'rejected',note:'需要修订'},opts)).status,200);
  const fresh=(await request('/api/knowledge/library')).data;
  assert(!fresh.trees.some(t=>t.id===tree.id));assert(!fresh.nodes.some(n=>n.assetKey===node.data.node.assetKey));
  assert.equal((await request(`/api/knowledge/audio/${node.data.node.assetKey}`,{language:'zh'})).status,403);
});

suite('已发布节点可停用和恢复；隐藏分支不能被读者重新打开',async()=>{
  const admin=jwt.sign({sub:'test-admin',type:'admin',role:'superadmin'},process.env.JWT_SECRET||'flipbook-jwt-secret-2024');
  const opts={token:admin};
  const createdTree=await request('/api/admin/knowledge/trees',{title:`${prefix}-activation`,grade:'test'},opts);assert.equal(createdTree.status,201);
  const tree=createdTree.data.tree;trees.push(tree.id);
  const addNode=async(title,parentId)=>{
    const result=await request(`/api/admin/knowledge/trees/${tree.id}/nodes`,{title,domain:'科学',explanation:'已核查内容',imageUrl:'/knowledge/water.svg',reviewed:true,...(parentId?{parentId}:{})},opts);
    assert.equal(result.status,201,JSON.stringify(result));editorialAssets.push(result.data.node.assetKey);return result.data.node;
  };
  const root=await addNode(`${prefix}-active-root`);
  const child=await addNode(`${prefix}-active-child`,root.id);
  let current=await prisma.knowledgeTree.findUnique({where:{id:tree.id},select:{revision:true}});
  const annotated=await request(`/api/admin/knowledge/trees/${tree.id}/nodes/${root.id}/child-regions`,{
    childRegions:[{childNodeId:child.id,x:0.1,y:0.1,w:0.5,h:0.5}],expectedAssetKey:root.assetKey,revision:current.revision,
  },{...opts,method:'PATCH'});
  assert.equal(annotated.status,200,JSON.stringify(annotated));
  current=await prisma.knowledgeTree.findUnique({where:{id:tree.id},select:{revision:true}});
  assert.equal((await request(`/api/admin/knowledge/trees/${tree.id}`,{status:'published',revision:current.revision},{...opts,method:'PATCH'})).status,200);
  const readerProfile=await reader({mode:'safe',selectedTreeId:tree.id});
  const infiniteReader=await reader({mode:'infinite',selectedTreeId:tree.id});
  const childRef=await ensureNode(prisma,infiniteReader,child.assetKey);
  const personalAsset=await prisma.knowledgeAsset.create({data:{key:`${prefix}-personal-child`,identity:{},action:'text',title:'个人后代',imageUrl:'/knowledge/water.svg',explanations:{zh:'说明'},authorProfileId:infiniteReader.id,state:'ready',reviewStatus:'approved'}});
  await prisma.readerNode.create({data:{profileId:infiniteReader.id,assetKey:personalAsset.key,parentId:childRef.id}});
  current=await prisma.knowledgeTree.findUnique({where:{id:tree.id},select:{revision:true}});
  const stopped=await request(`/api/admin/knowledge/trees/${tree.id}/nodes/${child.id}/active`,{active:false,revision:current.revision},{...opts,method:'PATCH'});
  assert.equal(stopped.status,200,JSON.stringify(stopped));assert.equal(stopped.data.node.active,false);
  const snapshot=await librarySnapshot(readerProfile);
  assert(snapshot.nodes.some(node=>node.globalNodeId===root.id));assert(!snapshot.nodes.some(node=>node.globalNodeId===child.id));
  assert.deepEqual(snapshot.nodes.find(node=>node.globalNodeId===root.id).childRegions,[]);
  await assert.rejects(ensureNode(prisma,readerProfile,child.assetKey),{status:403});
  assert(!((await librarySnapshot(infiniteReader)).nodes.some(node=>node.assetKey===personalAsset.key)));
  await assert.rejects(ensureNode(prisma,infiniteReader,personalAsset.key),{status:403});
  const sharedTree=await prisma.knowledgeTree.create({data:{title:`${prefix}-shared-active`,status:'published'}});trees.push(sharedTree.id);
  await prisma.knowledgeNode.create({data:{treeId:sharedTree.id,assetKey:child.assetKey,label:child.label,domain:'科学'}});
  assert(await ensureNode(prisma,{...infiniteReader,selectedTreeId:sharedTree.id},child.assetKey));
  assert(await ensureNode(prisma,{...infiniteReader,selectedTreeId:sharedTree.id,mode:'safe'},child.assetKey));
  assert((await librarySnapshot({...infiniteReader,selectedTreeId:sharedTree.id})).nodes.some(node=>node.assetKey===child.assetKey));
  await prisma.knowledgeTree.update({where:{id:sharedTree.id},data:{status:'draft'}});
  current=await prisma.knowledgeTree.findUnique({where:{id:tree.id},select:{revision:true}});
  const enabledNode=await request(`/api/admin/knowledge/trees/${tree.id}/nodes/${child.id}/active`,{active:true,revision:current.revision},{...opts,method:'PATCH'});
  assert.equal(enabledNode.status,200,JSON.stringify(enabledNode));assert.equal(enabledNode.data.node.active,true);
  assert((await librarySnapshot(readerProfile)).nodes.some(node=>node.globalNodeId===child.id));
  assert.equal((await request(`/api/admin/knowledge/trees/${tree.id}/nodes/${child.id}/active`,{active:false,revision:current.revision},{...opts,method:'PATCH'})).status,409);
  current=await prisma.knowledgeTree.findUnique({where:{id:tree.id},select:{revision:true}});
  assert.equal((await request(`/api/admin/knowledge/trees/${tree.id}/nodes/${root.id}/active`,{active:false,revision:current.revision},{...opts,method:'PATCH'})).status,200);
  assert.equal((await librarySnapshot(readerProfile)).nodes.length,0);
  assert.equal((await librarySnapshot(infiniteReader)).nodes.length,0);
  await assert.rejects(ensureNode(prisma,infiniteReader,child.assetKey),{status:403});
  const otherSource=await prisma.knowledgeTree.findFirst({where:{status:'published',id:{not:tree.id}}});
  assert(!((await librarySnapshot({...infiniteReader,selectedTreeId:otherSource.id})).nodes.some(node=>node.assetKey===personalAsset.key)));
  current=await prisma.knowledgeTree.findUnique({where:{id:tree.id},select:{revision:true}});
  assert.equal((await request(`/api/admin/knowledge/trees/${tree.id}/nodes/${root.id}/active`,{active:true,revision:current.revision},{...opts,method:'PATCH'})).status,200);
  assert((await librarySnapshot(infiniteReader)).nodes.some(node=>node.assetKey===personalAsset.key));
});

suite('删除草稿节点会一并删除整枝后代但保留共享图文资源',async()=>{
  const admin=jwt.sign({sub:'test-admin',type:'admin',role:'superadmin'},process.env.JWT_SECRET||'flipbook-jwt-secret-2024');
  const opts={token:admin};
  const createdTree=await request('/api/admin/knowledge/trees',{title:`${prefix}-delete`,grade:'test'},opts);assert.equal(createdTree.status,201);
  const tree=createdTree.data.tree;trees.push(tree.id);
  const addNode=async(title,parentId)=>{
    const result=await request(`/api/admin/knowledge/trees/${tree.id}/nodes`,{title,domain:'科学',explanation:'已核查内容',imageUrl:'/knowledge/water.svg',reviewed:true,...(parentId?{parentId}:{})},opts);
    assert.equal(result.status,201,JSON.stringify(result));editorialAssets.push(result.data.node.assetKey);return result.data.node;
  };
  const root=await addNode(`${prefix}-root`);
  const child=await addNode(`${prefix}-child`,root.id);
  const grandchild=await addNode(`${prefix}-grandchild`,child.id);
  const sibling=await addNode(`${prefix}-sibling`);
  const removed=await request(`/api/admin/knowledge/trees/${tree.id}/nodes/${root.id}`,undefined,{...opts,method:'DELETE'});
  assert.equal(removed.status,200,JSON.stringify(removed));assert.equal(removed.data.deletedNodes,3);
  const remaining=await prisma.knowledgeNode.findMany({where:{treeId:tree.id},select:{id:true}});
  assert.deepEqual(remaining.map(node=>node.id),[sibling.id]);
  assert.equal(await prisma.knowledgeAsset.count({where:{key:{in:[root.assetKey,child.assetKey,grandchild.assetKey]}}}),3);
});

suite('删除整棵草稿树会清理节点并保留图文资源，同时修复读者所选树',async()=>{
  const admin=jwt.sign({sub:'test-admin',type:'admin',role:'superadmin'},process.env.JWT_SECRET||'flipbook-jwt-secret-2024');
  const opts={token:admin};
  const fallback=await prisma.knowledgeTree.findFirst({where:{status:'published'},orderBy:{createdAt:'asc'},select:{id:true}});
  assert(fallback,'集成测试需要至少一棵已发布知识树作为切换目标');
  const createdTree=await request('/api/admin/knowledge/trees',{title:`${prefix}-whole-delete`,grade:'test'},opts);assert.equal(createdTree.status,201);
  const tree=createdTree.data.tree;trees.push(tree.id);
  const profile=await reader({selectedTreeId:tree.id,settingsRevision:4});
  const addNode=async(title,parentId)=>{
    const result=await request(`/api/admin/knowledge/trees/${tree.id}/nodes`,{title,domain:'科学',explanation:'已核查内容',imageUrl:'/knowledge/water.svg',reviewed:true,...(parentId?{parentId}:{})},opts);
    assert.equal(result.status,201,JSON.stringify(result));editorialAssets.push(result.data.node.assetKey);return result.data.node;
  };
  const root=await addNode(`${prefix}-whole-root`);
  const child=await addNode(`${prefix}-whole-child`,root.id);
  const current=await prisma.knowledgeTree.findUnique({where:{id:tree.id},select:{revision:true}});
  const removed=await request(`/api/admin/knowledge/trees/${tree.id}`,{revision:current.revision},{...opts,method:'DELETE'});
  assert.equal(removed.status,200,JSON.stringify(removed));assert.equal(removed.data.deletedNodes,2);
  assert.equal(await prisma.knowledgeTree.findUnique({where:{id:tree.id}}),null);
  assert.equal(await prisma.knowledgeNode.count({where:{treeId:tree.id}}),0);
  assert.equal(await prisma.knowledgeAsset.count({where:{key:{in:[root.assetKey,child.assetKey]}}}),2);
  const updatedProfile=await prisma.readerProfile.findUnique({where:{id:profile.id}});
  assert.equal(updatedProfile.selectedTreeId,fallback.id);assert.equal(updatedProfile.settingsRevision,5);

  const published=await prisma.knowledgeTree.findUnique({where:{id:fallback.id},select:{revision:true}});
  const rejected=await request(`/api/admin/knowledge/trees/${fallback.id}`,{revision:published.revision},{...opts,method:'DELETE'});
  assert.equal(rejected.status,409);
  assert(await prisma.knowledgeTree.findUnique({where:{id:fallback.id}}));
});

suite('生成进程中断后租约重领返还旧占额；语音复用与失败退额',async()=>{
  const p=await reader();const {period,expiresAt}=monthPeriod();
  await prisma.readerEntitlement.create({data:{profileId:p.id,period,expiresAt,allowance:5}});
  const deps={produce:async()=>({content:{title:'音轨测试',domain:'科学',explanation:'音轨解释',anchors:['一','二']},image:'test',verdict:{textSafe:true,imageSafe:true,factConsistent:true,styleConsistent:true}}),upload:async()=>'/knowledge/test.svg'};
  const input={query:`lease-${prefix}`};
  const first=await explore(p,input,deps);
  await prisma.knowledgeAsset.update({where:{key:first.asset.key},data:{state:'pending',leaseId:'expired',leaseUntil:new Date(0),reservedProfileId:p.id,reservedPeriod:period}});
  await explore(p,input,deps);
  assert.equal((await prisma.readerEntitlement.findUnique({where:{profileId_period:{profileId:p.id,period}}})).consumed,1);
  await assert.rejects(knowledgeAudio(p,first.asset.key,'zh',{synthesize:async()=>{throw new Error('tts failure');}}),/tts failure/);
  assert.equal((await prisma.readerEntitlement.findUnique({where:{profileId_period:{profileId:p.id,period}}})).consumed,1);
  let calls=0;const audioDeps={synthesize:async()=>{calls++;return{totalBuffer:Buffer.from('mp3')};},upload:async()=>'/api/local-uploads/test.mp3'};
  const audio=await knowledgeAudio(p,first.asset.key,'zh',audioDeps);assert.equal(audio.fromCache,false);
  await knowledgeAudio(p,first.asset.key,'zh',audioDeps);assert.equal(calls,1);
  assert.equal((await prisma.readerEntitlement.findUnique({where:{profileId_period:{profileId:p.id,period}}})).consumed,2);
});
