import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import db from '../../server/src/config/db.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const database=new URL(process.env.DATABASE_URL);
assert(['localhost','127.0.0.1'].includes(database.hostname)&&database.pathname==='/knowledge');
const base='http://127.0.0.1:5186',out='../.local-data/knowledge-verification/forest';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),profiles=new Set(),errors=[];

/** 同一组示例知识展示不同大小的真实界面，截获同步以免将示例写入个人库。 */
function fixture(){
 const titles=[['water',null,'一滴水的旅行',true],['cloud','water','云里有什么',true],['ice','water','水为什么会结冰',true],
  ['rain','cloud','雨从哪里来',false],['snow','ice','雪花的形状',false],
  ['plant',null,'种子醒来了',true],['roots','plant','根在忙什么',true],['leaves','plant','叶片里的图案',false],['seed','roots','种子如何传播',false],
  ['light',null,'光与影的秘密',false],['rainbow','light','彩虹的颜色',false],['shadow','light','会动的影子',false]];
 return titles.map(([key,parentKey,title,lit])=>({id:key,assetKey:key,parentKey,lit,openedAt:lit?new Date().toISOString():null,
   visits:lit?1:0,mastery:lit?1:0,note:'',asset:{key,title,domain:key==='plant'||parentKey==='plant'?'生命科学':'自然科学',
     imageUrl:'/knowledge/starter-primary-2-water.svg',explanations:{zh:'知识森林界面验证'},language:'zh',audio:{},anchors:[],generated:true}}));
}

/** 有界等待页面状态更新。 */
async function until(check){for(let i=0;i<100;i++){if(await check())return;await new Promise(resolve=>setTimeout(resolve,100));}throw new Error('个人知识树界面未按预期更新');}

/** 通过原有目录进入知识树。 */
async function tree(page){
 if(await page.getByLabel('选择公共知识树').isVisible())return;
 const dialog=page.getByRole('dialog');if(await dialog.count())await dialog.getByRole('button',{name:'返回阅读'}).click();
 await page.getByRole('button',{name:'目录',exact:true}).click();
 await page.locator('.forest-topic').first().waitFor();
}

/** 验证渲染后的卡片，防止视图缩放造成覆盖或文字越出卡片。 */
async function inspect(page){
 const report=await page.locator('.forest-node').evaluateAll(elements=>{
  const cards=elements.map(element=>({title:element.getAttribute('aria-label'),box:element.querySelector('.forest-card').getBoundingClientRect().toJSON(),
    text:element.querySelector('.forest-title').getBoundingClientRect().toJSON()}));
  return {cards,clipped:cards.filter(({box,text})=>text.right>box.right-4||text.left<box.left)};
 });
 assert.equal(report.clipped.length,0,JSON.stringify(report.clipped));
 for(const [i,a]of report.cards.entries())for(const b of report.cards.slice(i+1)){
  assert(a.box.right<=b.box.left||b.box.right<=a.box.left||a.box.bottom<=b.box.top||b.box.bottom<=a.box.top,`${a.title} 与 ${b.title} 重叠`);
 }
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'外层页面溢出');
}

/** 下拉标签和输入框在两种屏幕宽度下保持分离且完整可见。 */
async function inspectTreeControls(page){
 const report=await Promise.all(['选择公共知识树','探索模式'].map(name=>page.locator(`select[aria-label="${name}"]`).evaluate(select=>{
  const label=select.parentElement,range=document.createRange();range.selectNodeContents(label.firstChild);
  return {text:range.getBoundingClientRect().toJSON(),select:select.getBoundingClientRect().toJSON(),label:label.getBoundingClientRect().toJSON()};
 })));
 for(const item of report){
  assert(item.select.left>=item.label.left-1&&item.select.right<=item.label.right+1,JSON.stringify(report));
  assert(item.text.right<=item.select.left+1||item.text.bottom<=item.select.top+1,JSON.stringify(report));
 }
}

try{
 for(const [name,viewport]of [['desktop',{width:1440,height:1000}],['tablet',{width:768,height:900}],['phone',{width:390,height:844}]]){
  const context=await browser.newContext({viewport,hasTouch:name==='phone'});
  await context.addInitScript(id=>window.unlimitedBookNative={platform:'android',fingerprint:id},'forest-browser-'+randomUUID());
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  let snapshot;
  await page.route('**/api/knowledge/library',async route=>{
   if(!snapshot){const response=await route.fetch();const data=await response.json();profiles.add(data.profile.id);
    snapshot={...data,deviceShelf:false,nodes:fixture(),events:[],connections:[],deletedKeys:[],profile:{...data.profile,mode:'infinite'}};}
   await route.fulfill({json:{...snapshot,syncedAt:new Date().toISOString()}});
  });
  await page.route('**/api/knowledge/sync',async route=>{
   const {events}=route.request().postDataJSON();
   for(const event of events)if(event.type==='open')snapshot.nodes=snapshot.nodes.map(node=>node.assetKey===event.assetKey?{...node,lit:true,openedAt:event.occurredAt}:node);
   await route.fulfill({json:{...snapshot,ack:events.map(event=>event.id),syncedAt:new Date().toISOString()}});
  });
  await page.route('**/api/knowledge/explore',route=>{throw new Error('界面验证不应发起生成请求：'+route.request().url());});
  await page.goto(base);await page.locator('#input-query').waitFor();
  await page.getByRole('button',{name:'目录',exact:true}).click();
  await page.getByRole('dialog',{name:'知识树'}).waitFor();
  assert(await page.getByLabel('个人知识树',{exact:true}).isVisible());
  assert.equal(await page.getByRole('button',{name:'书架',exact:true}).count(),0);
  await page.screenshot({path:`${out}/${name}-tree.png`,fullPage:true});
  await tree(page);
  await until(()=>page.locator('.personal-tree-limb').count().then(count=>count===3));
  assert.equal(await page.getByRole('img',{name:'我的知识树'}).count(),1);
  assert((await page.locator('.personal-tree-root').evaluate(root=>root.textContent)).includes('3 个话题分枝'));
  await inspect(page);
  await page.getByRole('button',{name:'适合画布',exact:true}).click();
  await until(()=>page.locator('.forest-svg').evaluate(svg=>svg.getBoundingClientRect().width<=svg.parentElement.clientWidth+1));
  await inspectTreeControls(page);
  await until(()=>page.locator('.personal-tree-root').evaluate(root=>{
   const box=root.getBoundingClientRect(),canvas=root.closest('svg').parentElement.getBoundingClientRect();return box.bottom<=canvas.bottom+1&&box.top>=canvas.top;
  }));
  await page.screenshot({path:`${out}/${name}-overview.png`,fullPage:true});
  const before=await page.locator('.forest-svg').getAttribute('width');
  await page.getByRole('button',{name:'放大知识树'}).click();
  await until(async()=>Number(await page.locator('.forest-svg').getAttribute('width'))>Number(before));
  await page.getByRole('button',{name:'复位',exact:true}).click();
  await inspect(page);
  if(name==='phone'){
   const canvas=page.locator('.forest-scroll');
   await canvas.evaluate(element=>{element.scrollLeft=element.scrollWidth-element.clientWidth;});
   await until(()=>canvas.evaluate(element=>element.scrollLeft>0));
   await page.getByRole('button',{name:'光与影的秘密，未探索',exact:true}).tap();
  }else{
   const target=page.getByRole('button',{name:'水为什么会结冰，已探索',exact:true});
   await target.focus();await target.press('Enter');
  }
  await page.getByRole('button',{name:'我的知识树',exact:true}).waitFor();
  assert.equal((await page.locator('#btn-book-title').innerText()).trim(),'无限之书');
  await until(()=>page.getByRole('dialog').count().then(count=>count===0));
  await tree(page);
  if(name==='phone')assert.equal(await page.getByRole('button',{name:'光与影的秘密，已探索',exact:true}).count(),1);
  const canvas=page.locator('.forest-scroll');
  await canvas.evaluate(element=>{element.scrollLeft=0;element.scrollTop=element.scrollHeight-element.clientHeight;});
  await page.screenshot({path:`${out}/${name}-detail.png`,fullPage:true});
  if(name==='desktop'){
   await page.getByRole('button',{name:'放大知识树'}).click();
   const bounds=await canvas.boundingBox();
   await page.mouse.move(bounds.x+bounds.width-40,bounds.y+40);await page.mouse.down();
   await page.mouse.move(bounds.x+100,bounds.y+40,{steps:8});await page.mouse.up();
   assert(await canvas.evaluate(element=>element.scrollLeft>0),'鼠标拖动未平移画布');
  }
  snapshot={...snapshot,nodes:[],events:[]};
  await page.getByRole('button',{name:'立即同步',exact:true}).click();
  await page.getByText('你的知识树等待长出第一枝。可以选择已发布的探索内容，或在无限模式下探索感兴趣的话题。',{exact:true}).waitFor();
  await context.close();
 }
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:true,checks:['桌面、平板与手机直接打开知识树','不显示冗余书架视图','筛选器不重叠','同一根节点下三个话题分枝','书名统一且个人根不是知识节点','无卡片重叠或文字溢出','个人根完整显示','缩放和适合画布','键盘阅读','触摸打开并点亮','鼠标拖动','空树'],pageErrors:errors}));
}finally{
 await browser.close();
 const rows=await db.readerProfile.findMany({where:{id:{in:[...profiles]}},select:{deviceId:true}}),devices=rows.map(row=>row.deviceId).filter(Boolean);
 await db.legacyImportOwner.deleteMany({where:{profileId:{in:[...profiles]}}});
 await db.readerProfile.deleteMany({where:{id:{in:[...profiles]}}});
 await db.pointLedger.deleteMany({where:{deviceId:{in:devices}}});await db.deviceWallet.deleteMany({where:{deviceId:{in:devices}}});
 await db.device.deleteMany({where:{id:{in:devices}}});await db.$disconnect();
}
