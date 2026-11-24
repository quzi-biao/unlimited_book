import { knowledgeApi } from './api.js';
import { saveFile, mediaUrl } from './media.js';
import { readLocal, cacheMedia } from './local.js';

/** 取得可携带的媒体字节；缺失时明确失败，不生成依赖在线链接的伪离线包。 */
async function embeddedMedia(url) {
  if (!url) return null;
  await cacheMedia(url);
  const blob = await readLocal('media',url);
  if (!blob) throw new Error('部分媒体尚未保存，请联网后重新导出');
  return new Promise((resolve,reject) => { const reader=new FileReader(); reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob); });
}

/** 开放 JSON 同时携带原始事件、未同步事件和媒体字节。 */
export async function exportLibrary() {
  let data;
  try { data = await knowledgeApi('/export'); }
  catch(error) {
    const id=localStorage.getItem('knowledge_active_profile');
    const cached=id&&(await readLocal('archives',id) || await readLocal('snapshots',id));
    if(!cached)throw error;
    data={format:'unlimited-book/1',exportedAt:new Date().toISOString(),source:'local-snapshot',syncedAt:cached.syncedAt,profile:cached.profile,nodes:cached.nodes,events:cached.events||[],corrections:cached.corrections||[],deletedKeys:cached.deletedKeys||[]};
  }
  const deleted=new Set(data.deletedKeys || []);
  const pending = (await readLocal('outbox', data.profile.id) || []).filter(e=>!deleted.has(e.assetKey)&&!deleted.has(e.payload?.targetId));
  const media = {};
  for (const node of data.nodes) {
    for (const url of [node.asset.imageUrl,...Object.values(node.asset.audio || {})]) if (url && !media[url]) media[url] = await embeddedMedia(url);
  }
  await download(new Blob([JSON.stringify({ ...data, media, pendingEvents: pending }, null, 2)], { type: 'application/json' }), '无限之书-个人知识库.json');
}

/** 下载用户选定的文件，不触发外部打印服务。 */
function download(blob, filename) { return saveFile(blob,filename); }

/** 转义用户文本，打印页绝不把笔记当作 HTML 指令。 */
function escape(value) { return String(value || '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])); }

/** 用户选择一枝后生成自包含 HTML，可用浏览器标准打印另存为 PDF。 */
export async function printBranch(root, nodes) {
  const selected = []; const seen = new Set();
  const queue = [root];
  while (queue.length) {
    const node = queue.shift(); if (seen.has(node.assetKey)) continue;
    seen.add(node.assetKey); selected.push(node); queue.push(...nodes.filter(n => n.parentKey === node.assetKey && n.lit));
  }
  const pages = [];
  for (const node of selected) {
    const source = await embeddedMedia(node.asset.imageUrl);
    pages.push(`<article><p class="eyebrow">无限之书 · ${escape(node.asset.domain)}</p><h1>${escape(node.asset.title)}</h1><img src="${escape(source)}" alt="${escape(node.asset.title)}"><div class="content">${escape(node.asset.explanations?.[node.asset.language])}</div>${node.note ? `<aside><h2>我的理解</h2>${escape(node.note)}</aside>` : ''}<footer>${node.asset.generated ? 'AI 生成内容，欢迎核查' : '来自公共知识树'} · 我的探索切片</footer></article>`);
  }
  const html = `<!doctype html><html lang="zh"><meta charset="utf-8"><title>${escape(root.asset.title)}</title><style>@page{size:A4;margin:16mm}body{font:16px/1.8 serif;color:#20342d;max-width:850px;margin:auto;background:#faf9f3}article{padding:28px;break-after:page}.eyebrow{letter-spacing:4px;color:#43735a}h1{font-size:36px;border-bottom:2px solid #8aa58d}img{width:100%;border-radius:14px}.content{white-space:pre-wrap}aside{background:#eff3e9;padding:20px;white-space:pre-wrap}footer{margin-top:32px;color:#68756c}@media print{body{background:white}article{padding:0}}</style>${pages.join('')}</html>`;
  await download(new Blob([html], { type: 'text/html;charset=utf-8' }), `无限之书-${root.asset.title.replace(/[\\/:*?"<>|]/g,'')}.html`);
}
