import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import db from '../../server/src/config/db.js';
import {contentIdentity} from '../../server/src/services/knowledge/policy.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const database=new URL(process.env.DATABASE_URL);
assert(['localhost','127.0.0.1'].includes(database.hostname)&&database.pathname==='/knowledge');
const base='http://127.0.0.1:5186',prefix='delete-browser-'+randomUUID().slice(0,8);
const browser=await chromium.launch({headless:true,channel:'chrome'});
const profiles=new Set(),deviceIds=new Set(),errors=[],assets=[];
let page;
/** 等待持久化状态变化。 */
async function until(check){for(let i=0;i<150;i++){if(await check())return;await new Promise(r=>setTimeout(r,100));}throw new Error('状态未按预期更新');}
/** 独立浏览器设备，测试账号使用正常注册和登录接口。 */
async function device(){
 const context=await browser.newContext({viewport:{width:1365,height:950}});
 await context.addInitScript(id=>window.unlimitedBookNative={platform:'android',fingerprint:id},prefix+randomUUID());
 const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(base);
 await p.locator('#input-query').waitFor();profiles.add(await p.evaluate(()=>localStorage.getItem('knowledge_active_profile')));
 return {context,page:p};
}
/** 读取某个账号的 IndexedDB 数据。 */
async function local(p,store){return p.evaluate(async store=>{
 const id=localStorage.getItem('knowledge_active_profile');
 const db=await new Promise(resolve=>{const r=indexedDB.open('unlimited-knowledge-v1',2);r.onsuccess=()=>resolve(r.result);});
 const data=await new Promise(resolve=>{const r=db.transaction(store).objectStore(store).get(id);r.onsuccess=()=>resolve(r.result);});db.close();return data;
},store);}
/** 测试登录，不把凭据输出到日志。 */
async function account(p,path,username,password){
 await p.evaluate(async({path,username,password})=>{
  const response=await fetch('/api/knowledge/account/'+path,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+localStorage.getItem('wuxian_token')},
    body:JSON.stringify({username,password,ageBand:'adult',displayName:'删除功能验证'})});
  const data=await response.json();if(!response.ok)throw new Error(data.error);
  localStorage.setItem('knowledge_reader_token',data.token);
 },{path,username,password});
 await p.reload();await p.locator('#input-query').waitFor();
}
/** 树入口及原有阅读详情入口。 */
async function tree(p){
 if(await p.getByLabel('选择公共知识树').isVisible())return;
 const dialog=p.getByRole('dialog');
 if(await dialog.count())await dialog.getByRole('button',{name:'返回阅读'}).click();
 await p.getByRole('button',{name:'目录',exact:true}).click();
}
/** 打开节点后可直接使用阅读页操作。 */
async function openPage(p,title){
 await tree(p);await p.getByRole('button',{name:title+'，已探索',exact:true}).click();
}
/** 笔记使用独立入口。 */
async function openNotes(p,title){
 await openPage(p,title);await more(p,'笔记');
}
/** 更多菜单直达对应操作，不经过 AI 解读。 */
async function more(p,name){await p.getByRole('button',{name:'更多',exact:true}).click();await p.getByRole('menuitem',{name,exact:true}).click();}
/** 测试专用个人节点，不调用生图，也不触碰用户的实际图册。 */
async function node(profileId,title,parent){
 const identity=contentIdentity({query:prefix+title,action:'text',parentKey:parent?.assetKey});
 const asset=await db.knowledgeAsset.create({data:{...identity,action:'text',title,parentKey:parent?.assetKey,authorProfileId:profileId,
  state:'ready',imageUrl:'/knowledge/starter-primary-2-water.svg',explanations:{zh:'删除行为验证'},anchors:['问题一','问题二']}});
 assets.push(asset.key);
 return db.readerNode.create({data:{profileId,assetKey:asset.key,parentId:parent?.id,openedAt:new Date(),visits:1,mastery:1,note:title.includes('保留')?'保留子页的笔记':''}});
}
try{
 const first=await device();page=first.page;
 const username=prefix,password=randomUUID()+'test';
 await account(page,'register',username,password);
 const profileId=await page.evaluate(()=>localStorage.getItem('knowledge_active_profile'));profiles.add(profileId);
 const root=await node(profileId,'删除测试根节点');
 const middle=await node(profileId,'删除测试待删页',root);
 const leaf=await node(profileId,'删除测试保留子页',middle);
 await node(profileId,'删除测试旁枝',root);
 await page.reload();await until(async()=>(await local(page,'snapshots'))?.nodes.some(n=>n.assetKey===leaf.assetKey));
 const second=await device();await account(second.page,'login',username,password);
 await until(async()=>(await local(second.page,'snapshots'))?.nodes.some(n=>n.assetKey===middle.assetKey));
 await second.page.evaluate(async({key})=>{
  const db=await new Promise(resolve=>{const r=indexedDB.open('unlimited-knowledge-v1',2);r.onsuccess=()=>resolve(r.result);});
  const id=localStorage.getItem('knowledge_active_profile');
  await new Promise(resolve=>{const tx=db.transaction('jobs','readwrite');tx.objectStore('jobs').put([{id:'old-done',status:'done',assetKey:key,input:{query:'旧结果'}},
    {id:'old-retry',status:'failed',input:{query:'仍可重试',action:'text',treeRevision:0}}],id);tx.oncomplete=resolve;});db.close();
 },{key:middle.assetKey});
 await second.page.reload();await second.page.locator('#input-query').waitFor();
 await openNotes(second.page,'删除测试待删页');
 await second.context.setOffline(true);
 await second.page.getByRole('textbox',{name:'我的笔记',exact:true}).fill('旧设备未同步的笔记');
 await second.page.getByRole('button',{name:'保存笔记',exact:true}).click();
 await until(async()=>(await local(second.page,'outbox'))?.some(e=>e.type==='note'));
 await openPage(page,'删除测试待删页');
 await more(page,'删除节点');
 await page.screenshot({path:'../.local-data/knowledge-verification/node-delete-confirm.png',fullPage:true});
 await page.getByRole('alertdialog').getByRole('button',{name:'取消',exact:true}).click();
 assert.equal((await db.readerNode.findUnique({where:{id:middle.id}})).deletedAt,null);
 await more(page,'删除节点');
 await page.route('**/api/knowledge/nodes/*',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'测试：网络暂不可用'})}));
 await page.getByRole('button',{name:'确认删除',exact:true}).click();
 await page.getByRole('alert').getByText('测试：网络暂不可用',{exact:true}).waitFor();
 assert.equal((await db.readerNode.findUnique({where:{id:middle.id}})).deletedAt,null);
 await page.unroute('**/api/knowledge/nodes/*');
 await page.getByRole('button',{name:'确认删除',exact:true}).click();
 await until(async()=>(await local(page,'snapshots'))?.deletedKeys.includes(middle.assetKey));
 assert.equal(await page.getByRole('button',{name:'删除测试待删页，已探索',exact:true}).count(),0);
 const kept=(await local(page,'snapshots')).nodes.find(n=>n.assetKey===leaf.assetKey);
 assert.equal(kept.parentKey,root.assetKey);assert.equal(kept.note,'保留子页的笔记');
 await second.context.setOffline(false);
 await until(async()=>(await local(second.page,'snapshots'))?.deletedKeys.includes(middle.assetKey));
 await until(async()=>(await local(second.page,'outbox'))?.length===0);
 await until(async()=>!(await local(second.page,'jobs'))?.some(j=>j.assetKey===middle.assetKey));
 assert(!(await local(second.page,'archives')).nodes.some(n=>n.assetKey===middle.assetKey));
 let retryInput;
 await second.page.route('**/api/knowledge/explore',async route=>{
  retryInput=route.request().postDataJSON();await route.fulfill({status:422,contentType:'application/json',body:JSON.stringify({error:'测试重试参数'})});
 });
 await second.page.getByRole('dialog').getByRole('button',{name:'返回阅读',exact:true}).click();
 await second.page.getByRole('button',{name:'探索队列',exact:true}).click();
 await second.page.getByRole('region',{name:'探索队列'}).getByRole('button',{name:'重试',exact:true}).click();
 await until(()=>!!retryInput);assert.equal(retryInput.treeRevision,1);
 await second.page.unroute('**/api/knowledge/explore');
 await openPage(page,'删除测试根节点');
 await more(page,'删除节点');
 await page.getByRole('radio',{name:'删除整条分枝',exact:false}).check();
 await page.getByRole('button',{name:'确认删除',exact:true}).click();
 await until(async()=>(await local(page,'snapshots'))?.deletedKeys.includes(root.assetKey));
 for(const store of ['snapshots','archives'])assert(!(await local(page,store)).nodes.some(n=>assets.includes(n.assetKey)));
 await page.evaluate(()=>navigator.serviceWorker.ready);
 await until(()=>page.evaluate(()=>!!navigator.serviceWorker.controller));
 await first.context.setOffline(true);await page.reload();
 await tree(page);
 assert.equal(await page.getByRole('button',{name:/删除测试.+，已探索/}).count(),0);
 await first.context.setOffline(false);
 await page.getByRole('button',{name:'立即同步',exact:true}).click();
 await until(async()=>(await local(page,'outbox') || []).length===0);
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:true,scenarios:['取消','失败保留','单页删除保留子枝','整枝删除','旧设备补传','清理队列','清理归档','离线刷新','其他任务重试'],pageErrors:errors}));
}catch(error){
 if(page){await page.screenshot({path:'../.local-data/knowledge-verification/node-delete-failure.png',fullPage:true});console.log((await page.locator('body').innerText()).slice(-1600));}throw error;
}finally{
 await browser.close();
 const rows=await db.readerProfile.findMany({where:{id:{in:[...profiles]}},select:{deviceId:true}});
 for(const row of rows)if(row.deviceId)deviceIds.add(row.deviceId);
 await db.readerNode.deleteMany({where:{profileId:{in:[...profiles]}}});
 await db.readerEntitlement.deleteMany({where:{profileId:{in:[...profiles]}}});
 await db.knowledgeCorrection.deleteMany({where:{profileId:{in:[...profiles]}}});
 await db.readerProfile.deleteMany({where:{id:{in:[...profiles]}}});
 await db.knowledgeAsset.deleteMany({where:{key:{in:assets}}});
 await db.legacyImportOwner.deleteMany({where:{profileId:{in:[...profiles]}}});
 await db.pointLedger.deleteMany({where:{deviceId:{in:[...deviceIds]}}});
 await db.deviceWallet.deleteMany({where:{deviceId:{in:[...deviceIds]}}});
 await db.device.deleteMany({where:{id:{in:[...deviceIds]}}});
 await db.$disconnect();
}
