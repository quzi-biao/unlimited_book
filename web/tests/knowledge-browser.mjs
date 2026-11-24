import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base=process.env.KNOWLEDGE_WEB_URL || 'http://127.0.0.1:5186';
assert(['localhost','127.0.0.1'].includes(new URL(base).hostname),'Only local verification is allowed');
const out=process.env.KNOWLEDGE_EVIDENCE || '../.local-data/knowledge-verification';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
let latestPage;
const errors=[];const username=`browser_${randomUUID().slice(0,12)}`;
/** 每个浏览器模拟独立安装身份，避免相同指纹干扰跨设备测试。 */
async function device(){
  const context=await browser.newContext({viewport:{width:1365,height:950},acceptDownloads:true});
  await context.addInitScript(({id})=>{window.unlimitedBookNative={platform:'android',fingerprint:id};},{id:`browser-${randomUUID()}`});
  const page=await context.newPage();latestPage=page;page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);try { await page.getByRole('button',{name:'目录',exact:true}).waitFor();
    assert.equal(await page.locator('.tree-node').count(),0);
    if (!latestPage || !await page.getByRole('button',{name:'设置',exact:true}).count()) throw new Error('原版设置入口未显示');
    await page.screenshot({path:`${out}/original-home.png`});
    await tree(page); } catch(e) { console.log('Startup failure:', await page.locator('body').innerText()); throw e; }
  return {context,page};
}
/** 从原版目录打开知识树，公共页继续用原版画布和解读操作。 */
async function tree(page) {
  if(await page.getByLabel('选择公共知识树').isVisible()) return;
  const dialog=page.getByRole('dialog');
  if(await dialog.count()) await dialog.getByRole('button',{name:'返回阅读'}).click();
  await page.getByRole('button',{name:'目录',exact:true}).click();
  await page.getByLabel('选择公共知识树').waitFor();
}
/** 笔记直接从阅读页打开，不经过 AI 解读。 */
async function notes(page) {
  const dialog=page.getByRole('dialog');if(await dialog.count())await dialog.getByRole('button',{name:'返回阅读'}).click();
  await page.getByRole('button',{name:'更多',exact:true}).click();
  await page.getByRole('menuitem',{name:'笔记',exact:true}).click();
}
/** 用本地测试身份创建两页旧格式图册，验证公共页可以切回旧画布，搜索仍会复用原书。 */
async function checkLegacyShelf(page) {
  const bookTitle = '地球 Atlas';
  const bookId = await page.evaluate(async title => {
    const headers = {'Content-Type':'application/json', Authorization:'Bearer '+localStorage.getItem('wuxian_token'),
      'X-Reader-Token':localStorage.getItem('knowledge_reader_token')};
    async function create(path, body) {
      const res = await fetch(path,{method:'POST',headers,body:JSON.stringify(body)});
      if (!res.ok) throw new Error('测试图册创建失败 '+res.status);
      return res.json();
    }
    const {book} = await create('/api/books',{title});
    const path = '/api/books/'+book.id+'/pages';
    const {page:first} = await create(path,{imageUrl:'/knowledge/starter-primary-2-water.svg'});
    await create(path,{imageUrl:'/knowledge/starter-primary-2-cloud.svg',parentPageId:first.id});
    return book.id;
  },bookTitle);
  await tree(page);
  await page.getByRole('button',{name:'一滴水的旅行，已探索'}).click();
  const generated = [];
  const watch = req => { if (/\/api\/(knowledge\/explore|ai\/generate-image)$/.test(new URL(req.url()).pathname)) generated.push(req.url()); };
  page.on('request', watch);
  try {
    await page.locator('#input-query').fill('地球 atlas');
    await page.locator('#input-query').press('Enter');
    await page.getByRole('img',{name:'AI 生成的科普图册'}).waitFor();
    assert.equal(await page.locator('#btn-book-title').innerText(),bookTitle);
    await page.getByRole('button',{name:'下一页'}).click();
    await until(()=>page.getByRole('img',{name:'AI 生成的科普图册'}).evaluate(img=>img.src.endsWith('cloud.svg')));
    await page.reload();
    await until(()=>page.evaluate(id=>JSON.parse(localStorage.getItem('flipbook_session'))?.bookId===id,bookId));
    await page.getByRole('button',{name:'目录',exact:true}).click();
    await page.locator('aside').getByText(bookTitle,{exact:true}).click();
    await until(()=>page.getByRole('img',{name:'AI 生成的科普图册'}).evaluate(img=>img.src.endsWith('water.svg')));
    assert.deepEqual(generated,[]);
  } finally {page.off('request', watch);}
}
/** 明确深入使用父页；底部搜索即使正在读一页，也必须建立根话题。 */
async function checkExplorationOrigins(page) {
  const requests=[];
  await page.route('**/api/knowledge/explore',async route=>{
    requests.push(route.request().postDataJSON());
    await route.fulfill({status:422,contentType:'application/json',body:JSON.stringify({error:'本地请求参数验证：不调用模型'})});
  });
  try {
    const snapshot=await local(page,'snapshots');
    const parent=snapshot.nodes.find(n=>n.asset.title==='一滴水的旅行').assetKey;
    await page.getByRole('dialog').getByRole('button',{name:'返回阅读'}).click();
    await page.getByRole('button',{name:'更多',exact:true}).click();
    await page.getByRole('menuitem',{name:'深入探索',exact:true}).click();
    await page.getByRole('textbox',{name:'沿着这一页继续问'}).fill('为什么雨滴落下？');
    await page.getByRole('button',{name:'探索新枝'}).click();
    await until(()=>requests.length===1);
    assert.equal(requests[0].parentKey,parent);assert.equal(requests[0].action,'text');
    assert.equal(await page.getByRole('dialog').count(),0);
    await page.locator('#input-query').fill('独立的新话题');
    await page.locator('#input-query').press('Enter');
    await until(()=>requests.length===2);
    assert(!requests[1].parentKey);assert.equal(requests[1].action,'text');
    const queue=page.getByRole('region',{name:'探索队列'});
    await queue.waitFor();assert.equal(await page.getByRole('dialog').count(),0);
    await queue.getByRole('button',{name:'关闭',exact:true}).click();
    await notes(page);
  } finally { await page.unroute('**/api/knowledge/explore'); }
}
/** 读取实际持久数据验证离线与 ACK 结果。 */
async function local(page,store){return page.evaluate(async store=>{
  const db=await new Promise(resolve=>{const r=indexedDB.open('unlimited-knowledge-v1');r.onsuccess=()=>resolve(r.result);});
  const id=localStorage.getItem('knowledge_active_profile');if(!id)return null;
  return new Promise(resolve=>{const r=db.transaction(store).objectStore(store).get(id);r.onsuccess=()=>resolve(r.result);});
},store);}
/** 有界等待实际状态，而非固定长时间等待。 */
async function until(check){for(let i=0;i<150;i++){if(await check())return;await new Promise(r=>setTimeout(r,100));}throw new Error('Timed out waiting for persisted state');}
try{
  const {context,page}=await device();
  await page.evaluate(()=>navigator.serviceWorker.ready);
  await until(()=>page.evaluate(()=>!!navigator.serviceWorker.controller));
  const modeSelect = page.getByLabel('探索模式');
  for (const mode of ['safe', 'infinite']) {
    await modeSelect.selectOption(mode);
    await until(async () => (await local(page,'snapshots'))?.profile.mode === mode);
  }
  await page.reload();
  await tree(page);
  assert.equal(await modeSelect.inputValue(), 'infinite');
  assert.equal(await page.locator('.tree-node.lit').count(),0);
  assert(await page.locator('.forest-branch').count()>0);
  await page.screenshot({path:`${out}/tree-desktop.png`,fullPage:true});
  await page.getByRole('button',{name:'一滴水的旅行，未探索'}).click();
  await page.getByRole('img',{name:'一滴水的旅行',exact:true}).waitFor();
  await notes(page);
  await until(async()=> (await local(page,'outbox') || []).length===0);
  await page.getByText('图片已保存到本机',{exact:false}).waitFor();
  await checkExplorationOrigins(page);
  await page.screenshot({path:`${out}/reader-desktop.png`,fullPage:true});
  await context.setOffline(true);
  await page.locator('textarea').first().fill('断网也能保存：水循环。');
  await page.getByRole('button',{name:'保存笔记'}).click();
  await until(async()=> (await local(page,'outbox') || []).some(e=>e.type==='note'));
  await page.reload();
  await tree(page);
  await page.getByRole('button',{name:'一滴水的旅行，已探索'}).click();
  await notes(page);
  assert.equal(await page.locator('textarea').first().inputValue(),'断网也能保存：水循环。');
  await until(()=>page.getByRole('img',{name:'一滴水的旅行',exact:true}).evaluate(img=>img.complete&&img.naturalWidth>0));
  await page.evaluate(async()=>{
    const db=await new Promise(resolve=>{const r=indexedDB.open('unlimited-knowledge-v1');r.onsuccess=()=>resolve(r.result);});
    const id=localStorage.getItem('knowledge_active_profile');
    await new Promise(resolve=>{const tx=db.transaction(['outbox','snapshots'],'readwrite');const r=tx.objectStore('snapshots').get(id);r.onsuccess=()=>{
      const key=r.result.nodes[0].assetKey;const q=tx.objectStore('outbox').get(id);q.onsuccess=()=>tx.objectStore('outbox').put([...(q.result||[]),...Array.from({length:205},()=>({id:crypto.randomUUID(),assetKey:key,type:'dwell',payload:{seconds:1},occurredAt:new Date().toISOString()}))],id);};tx.oncomplete=resolve;});
  });
  await context.setOffline(false);
  await page.getByRole('button',{name:'立即同步'}).click();
  await until(async()=> (await local(page,'outbox') || []).length===0);
  await tree(page);
  await page.getByRole('button',{name:'我的账号',exact:true}).click();
  assert.equal(await page.getByRole('dialog').getByLabel('画风',{exact:true}).count(),0);
  await page.getByRole('button',{name:'创建账号',exact:true}).click();
  await page.getByLabel('账号',{exact:true}).fill(username);
  await page.getByLabel('密码',{exact:true}).fill('browser-local-password-123');
  await page.getByLabel('昵称',{exact:true}).fill('浏览器验证');
  await page.getByLabel('使用者').selectOption('minor');
  await page.getByRole('button',{name:'创建并保留本机轨迹'}).click();
  await until(async()=> (await local(page,'snapshots'))?.profile.username===username);
  await checkLegacyShelf(page);
  await tree(page);
  await page.getByLabel('探索模式').selectOption('safe');
  await until(async()=> (await local(page,'snapshots')).profile.mode==='safe');
  assert.equal(await page.getByRole('textbox',{name:'探索新问题'}).count(),0);
  await page.getByLabel('选择公共知识树').selectOption('starter-junior-1');
  await until(async()=> (await local(page,'snapshots')).profile.selectedTreeId==='starter-junior-1');
  await page.getByLabel('选择公共知识树').selectOption('starter-primary-2');
  await until(async()=> (await local(page,'snapshots')).profile.selectedTreeId==='starter-primary-2');
  const second=await device();
  await tree(second.page);
  await second.page.getByRole('button',{name:'我的账号',exact:true}).click();
  await second.page.getByLabel('账号',{exact:true}).fill(username);
  await second.page.getByLabel('密码',{exact:true}).fill('browser-local-password-123');
  await second.page.evaluate(()=>localStorage.setItem('knowledge_reader_token','expired-token'));
  await second.page.getByRole('button',{name:'登录',exact:true}).click();
  await until(async()=> (await local(second.page,'snapshots'))?.profile.username===username);
  await tree(second.page);
  await second.page.getByRole('button',{name:'一滴水的旅行，已探索'}).click();
  await notes(second.page);
  assert.equal(await second.page.locator('textarea').first().inputValue(),'断网也能保存：水循环。');
  await second.page.getByRole('dialog').getByRole('button',{name:'返回阅读'}).click();
  await second.page.getByRole('button',{name:'更多',exact:true}).click();
  const download=second.page.waitForEvent('download');
  await second.page.getByRole('menuitem',{name:'导出这一枝'}).click();
  const file=await download;await file.saveAs(`${out}/branch.html`);
  assert((await readFile(`${out}/branch.html`,'utf8')).includes('data:image/'));
  await tree(second.page);
  await second.page.getByRole('button',{name:'我的账号',exact:true}).click();
  const jsonDownload=second.page.waitForEvent('download');
  await second.page.getByRole('button',{name:'导出知识库与完整轨迹'}).click();
  const json=await jsonDownload;await json.saveAs(`${out}/library.json`);
  assert(Object.keys(JSON.parse(await readFile(`${out}/library.json`,'utf8')).media).length>0);
  const archive=await local(page,'archives');assert(archive.nodes.length>=12,'切换公共树后本机保留两棵树');
  await second.context.setOffline(true);
  const offlineDownload=second.page.waitForEvent('download');
  await second.page.getByRole('button',{name:'导出知识库与完整轨迹'}).click();
  await (await offlineDownload).saveAs(`${out}/offline-library.json`);
  const offline=JSON.parse(await readFile(`${out}/offline-library.json`,'utf8'));
  assert.equal(offline.source,'local-snapshot');assert(offline.events.length>0);
  await second.context.setOffline(false);
  await second.page.getByRole('button',{name:'切回本机身份'}).click();
  await until(async()=> (await local(second.page,'snapshots'))?.profile.username===null);
  await tree(second.page);
  assert.equal(await second.page.locator('.tree-node.lit').count(),0);
  for(const [name,viewport] of [['phone-portrait',{width:390,height:844}],['phone-landscape',{width:844,height:390}],['tablet',{width:1024,height:768}]]){
    await page.setViewportSize(viewport);await page.screenshot({path:`${out}/${name}.png`,fullPage:true});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${name} overflow`);
  }
  assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,scenarios:19,pageErrors:errors}));
}catch(error){console.log('Failure page:',await latestPage.locator('body').innerText());await latestPage.screenshot({path:`${out}/failure.png`,fullPage:true});throw error;}finally{await browser.close();}
