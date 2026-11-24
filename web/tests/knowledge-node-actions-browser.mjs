import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdir,readFile} from 'node:fs/promises';
import db from '../../server/src/config/db.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const database=new URL(process.env.DATABASE_URL);
assert(['localhost','127.0.0.1'].includes(database.hostname)&&database.pathname==='/knowledge');
const out='../.local-data/knowledge-verification/more-menu';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const errors=[],events=[],requests=[];let profileId,page,snapshot;

/** 独立示例节点只用于界面测试，不写入实际知识树。 */
function node(key,title,parentKey=null){return {id:key,assetKey:key,parentKey,lit:true,openedAt:new Date().toISOString(),deletable:true,mastery:1,note:'',
 asset:{key,title,domain:'地理',language:'zh',imageUrl:'/knowledge/starter-primary-2-water.svg',explanations:{zh:'长江从青藏高原流向东海。'},anchors:['长江为什么这么长？'],generated:true}};}

/** 只等待可验证状态，不调用外部生成模型。 */
async function until(check){for(let i=0;i<100;i++){if(await check())return;await new Promise(resolve=>setTimeout(resolve,100));}throw new Error('当前页操作未按预期更新');}

/** 解读独立，其余任务从更多菜单直接进入。 */
async function open(name){
 const dialog=page.getByRole('dialog');if(await dialog.count())await dialog.getByRole('button',{name:'返回阅读'}).click();
 if(name==='AI 解读'){await page.getByRole('button',{name,exact:true}).click();return;}
 await page.getByRole('button',{name:'更多',exact:true}).click();
 await page.getByRole('menuitem',{name,exact:true}).click();
}

/** 当前任务不混入其他任务的控件。 */
async function absent(names){for(const name of names)assert.equal(await page.getByRole('dialog').getByRole('button',{name,exact:true}).count(),0,name);}

try{
 const context=await browser.newContext({viewport:{width:1365,height:950},acceptDownloads:true});
 await context.addInitScript(id=>window.unlimitedBookNative={platform:'android',fingerprint:id},'node-actions-'+randomUUID());
 page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/api/knowledge/library',async route=>{
  if(!snapshot){const original=await (await route.fetch()).json();profileId=original.profile.id;
   snapshot={...original,profile:{...original.profile,mode:'infinite',preferences:{...original.profile.preferences,voice:'test-voice'}},deviceShelf:false,nodes:[node('test-root','长江'),{...node('test-child','三峡','test-root'),deletable:false}],events:[],connections:[],deletedKeys:[]};}
  await route.fulfill({json:{...snapshot,syncedAt:new Date().toISOString()}});
 });
 await page.route('**/api/knowledge/sync',async route=>{
  const batch=route.request().postDataJSON().events;events.push(...batch);
  for(const event of batch){
   snapshot.events.push({...event,nodeId:event.assetKey});
   snapshot.nodes=snapshot.nodes.map(item=>item.assetKey===event.assetKey&&event.type==='note'?{...item,note:event.payload.text}:item);
  }
  await route.fulfill({json:{...snapshot,ack:batch.map(event=>event.id),syncedAt:new Date().toISOString()}});
 });
 await page.route('**/api/knowledge/explore',async route=>{
  requests.push(route.request().postDataJSON());await route.fulfill({status:422,json:{error:'界面验证：不调用外部模型'}});
 });
 let correction,deletions=0;
 await page.route('**/api/knowledge/corrections',async route=>{correction=route.request().postDataJSON();await route.fulfill({status:201,json:{correction}});});
 await page.route('**/api/knowledge/nodes/*',async route=>{deletions++;await route.fulfill({status:503,json:{error:'界面验证不删除真实数据'}});});
 let spoken;
 const wav=Buffer.alloc(1644);wav.write('RIFF');wav.writeUInt32LE(1636,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);
 wav.writeUInt32LE(8000,24);wav.writeUInt32LE(16000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(1600,40);
 await page.route('**/api/knowledge/audio/*',async route=>{spoken=route.request().postDataJSON();await route.fulfill({json:{url:'/api/node-actions-test.wav'}});});
 await page.route('**/api/node-actions-test.wav',route=>route.fulfill({contentType:'audio/wav',body:wav}));
 await page.goto('http://127.0.0.1:5186/');
 await page.getByRole('button',{name:'目录',exact:true}).click();
 await page.getByRole('button',{name:'长江，已探索',exact:true}).click();
 for(const width of [1365,667,540,390,320]){
  await page.setViewportSize({width,height:width>700?950:844});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  assert.equal(await page.locator('#reader-header').count(),1);
  await page.screenshot({path:`${out}/reader-${width}.png`});
  const boxes=await page.locator('#reader-header button,#display-balance').evaluateAll(items=>items.map(item=>({name:item.getAttribute('aria-label')||item.textContent,box:item.getBoundingClientRect().toJSON()})));
  for(let i=0;i<boxes.length;i++){
   const a=boxes[i];assert(a.box.left>=0&&a.box.right<=width,`${width}: ${a.name} 越界`);
   for(const b of boxes.slice(i+1))assert(a.box.right<=b.box.left||b.box.right<=a.box.left||a.box.bottom<=b.box.top||b.box.bottom<=a.box.top,`${width}: ${a.name}/${b.name} 重叠`);
  }
  const ai=await page.getByRole('button',{name:'AI 解读',exact:true}).boundingBox(),more=await page.getByRole('button',{name:'更多',exact:true}).boundingBox();
  assert.equal(ai.y,more.y);assert(more.x>=ai.x+ai.width&&more.x-ai.x-ai.width<=8,`${width}: 更多必须紧挨 AI 解读`);
  assert.equal(await page.getByRole('button',{name:'笔记',exact:true}).count(),0);
  await page.getByRole('button',{name:'更多',exact:true}).click();
  assert.deepEqual(await page.getByRole('menuitem').allTextContents(),['笔记','深入探索','学习记录','导出这一枝','我想核查','删除节点']);
  const menu=await page.getByRole('menu').boundingBox();assert(menu.x>=0&&menu.x+menu.width<=width&&menu.y+menu.height<=(width>700?950:844));
  await page.screenshot({path:`${out}/menu-${width}.png`});await page.keyboard.press('Escape');
 }
 await page.setViewportSize({width:390,height:844});
 await open('AI 解读');await page.locator('#ai-explanation-panel').waitFor();
 assert.equal(await page.locator('#ai-explanation-panel button').allTextContents().then(text=>text.join('')).then(text=>text.includes('笔记')),false);
 assert.equal(await page.locator('#ai-explanation-panel textarea').count(),0);
 await page.getByRole('button',{name:'朗读解读',exact:true}).click();await until(()=>Promise.resolve(!!spoken));assert.equal(spoken.language,'zh');
 await page.locator('#ai-explanation-panel audio').waitFor();
 await page.locator('#ai-explanation-panel').getByRole('button',{name:'关闭',exact:true}).click();
 await open('笔记');await absent(['探索新枝','留下连接','删除节点']);
 await page.getByRole('textbox',{name:'我的笔记',exact:true}).fill('我的长江笔记');await page.getByRole('button',{name:'保存笔记',exact:true}).click();
 await until(()=>Promise.resolve(events.some(event=>event.type==='note'&&event.payload.text==='我的长江笔记')));
 await page.screenshot({path:`${out}/notes-phone.png`});
 await open('深入探索');await absent(['保存笔记','留下连接','删除节点']);
 await page.getByRole('textbox',{name:'沿着这一页继续问'}).fill('为什么会有三峡？');await page.getByRole('button',{name:'探索新枝'}).click();
 await until(()=>Promise.resolve(requests.length===1));assert.equal(requests[0].parentKey,'test-root');assert.equal(requests[0].action,'text');
 await page.getByRole('region',{name:'探索队列'}).getByRole('button',{name:'关闭',exact:true}).click();
 await open('学习记录');await absent(['保存笔记','探索新枝','删除节点']);
 await page.getByRole('button',{name:'能回想起来',exact:true}).click();await until(()=>Promise.resolve(events.some(event=>event.type==='review')));
 await page.getByLabel('连接到的节点').selectOption('test-child');
 await page.getByPlaceholder('它们为什么有关？由你判断').fill('三峡位于长江上');await page.getByRole('button',{name:'留下连接'}).click();
 await until(()=>Promise.resolve(events.some(event=>event.type==='connect'&&event.payload.targetId==='test-child')));
 await page.getByRole('dialog').getByRole('button',{name:'返回阅读'}).click();
 const trigger=page.getByRole('button',{name:'更多',exact:true});
 await trigger.focus();await trigger.press('ArrowDown');await page.getByRole('menu').waitFor();
 assert.equal(await page.evaluate(()=>document.activeElement.textContent),'笔记');
 await page.keyboard.press('ArrowDown');assert.equal(await page.evaluate(()=>document.activeElement.textContent),'深入探索');
 await page.keyboard.press('End');assert.equal(await page.evaluate(()=>document.activeElement.textContent),'删除节点');
 await page.keyboard.press('ArrowDown');assert.equal(await page.evaluate(()=>document.activeElement.textContent),'笔记');
 await page.keyboard.press('ArrowUp');assert.equal(await page.evaluate(()=>document.activeElement.textContent),'删除节点');
 await page.keyboard.press('Home');assert.equal(await page.evaluate(()=>document.activeElement.textContent),'笔记');
 await page.keyboard.press('Escape');assert.equal(await trigger.getAttribute('aria-expanded'),'false');assert(await trigger.evaluate(element=>element===document.activeElement));
 await trigger.click();await page.getByRole('button',{name:'AI 解读',exact:true}).click();assert.equal(await trigger.getAttribute('aria-expanded'),'false');
 await page.locator('#ai-explanation-panel').getByRole('button',{name:'关闭',exact:true}).click();
 await trigger.click();await trigger.click();assert.equal(await trigger.getAttribute('aria-expanded'),'false');
 await trigger.click();await page.keyboard.press('Tab');assert.equal(await trigger.getAttribute('aria-expanded'),'false');
 assert(await page.locator('#btn-shop').evaluate(element=>element===document.activeElement));
 await trigger.click();await page.getByRole('menuitem',{name:'我想核查',exact:true}).click();
 await absent(['保存笔记','探索新枝','留下连接','删除节点']);
 await page.getByLabel('需要核查的原文').fill('长江的长度');await page.getByLabel('你的理由或来源').fill('想确认测量口径');await page.getByRole('button',{name:'提交核查'}).click();
 await until(()=>Promise.resolve(!!correction));assert.equal(correction.assetKey,'test-root');assert.equal(correction.claim,'长江的长度');
 await page.getByRole('dialog').getByRole('button',{name:'返回阅读'}).click();
 await trigger.click();const download=page.waitForEvent('download');await page.getByRole('menuitem',{name:'导出这一枝',exact:true}).click();
 const file=await download;assert((await readFile(await file.path(),'utf8')).includes('data:image/'));
 await open('删除节点');await page.getByRole('alertdialog',{name:'删除知识节点'}).waitFor();
 await absent(['保存笔记','探索新枝','留下连接']);assert.equal(deletions,0);
 await page.screenshot({path:`${out}/delete-phone.png`});
 await page.getByRole('alertdialog').getByRole('button',{name:'取消',exact:true}).click();assert.equal(await page.getByRole('dialog').count(),0);assert.equal(deletions,0);
 await open('笔记');assert.equal(await page.getByRole('textbox',{name:'我的笔记'}).inputValue(),'我的长江笔记');
 await page.getByRole('dialog').getByRole('button',{name:'返回阅读'}).click();
 await page.getByRole('button',{name:'目录',exact:true}).click();
 await page.getByRole('button',{name:'三峡，已探索',exact:true}).click();await trigger.click();
 assert.equal(await page.getByRole('menuitem',{name:'删除节点',exact:true}).count(),0);
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:true,checks:['5种屏宽无重叠、更多紧邻解读且菜单不越界','解读仅讲解','朗读解读','独立笔记保存','深入探索父路径','学习记录与连接','核查提交','菜单键盘及外部关闭','导出','删除确认与取消','笔记保留','公共节点无删除入口'],pageErrors:errors}));
}catch(error){if(page)await page.screenshot({path:`${out}/failure.png`,fullPage:true});throw error;}
finally{
 await browser.close();
 if(profileId){const profile=await db.readerProfile.findUnique({where:{id:profileId}});
  await db.legacyImportOwner.deleteMany({where:{profileId}});await db.readerProfile.deleteMany({where:{id:profileId}});
  if(profile?.deviceId){await db.pointLedger.deleteMany({where:{deviceId:profile.deviceId}});await db.deviceWallet.deleteMany({where:{deviceId:profile.deviceId}});await db.device.deleteMany({where:{id:profile.deviceId}});}}
 await db.$disconnect();
}
