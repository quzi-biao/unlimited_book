/** 本地打包的阅读器把后端相对媒体地址解析到配置的 API 主机。 */
export function mediaUrl(url) {
  if (!url) return '';
  const base = window.unlimitedBookNative?.apiBase;
  // 随安装包提供的入门 SVG 使用本地版本，可在断网时打开。
  if (url.startsWith('/knowledge/') && window.unlimitedBookNative?.bundled) return new URL(url, location.href).href;
  return base && url.startsWith('/') ? `${base}${url}` : url;
}

/** 设备朗读是已保存文本的替代播放方式，不发起 AI 内容生成。 */
export function speakLocally(text, language) {
  if (window.KnowledgeNative?.speak) { window.KnowledgeNative.speak(text,language); return true; }
  if (window.webkit?.messageHandlers?.reader) { window.webkit.messageHandlers.reader.postMessage({action:'speak',text,language}); return true; }
  if (!window.speechSynthesis) return false;
  speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = language === 'en' ? 'en-US':'zh-CN';speechSynthesis.speak(utterance);return true;
}

/** 导出文件桥接到原生分享面板，桌面浏览器则直接下载。 */
export async function saveFile(blob,filename) {
  const native = window.KnowledgeNative?.saveFile || window.webkit?.messageHandlers?.reader;
  if (native) {
    const data = await new Promise((resolve,reject) => {const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(blob);});
    if (window.KnowledgeNative?.saveFile) window.KnowledgeNative.saveFile(filename,blob.type,data);
    else window.webkit.messageHandlers.reader.postMessage({action:'saveFile',filename,mime:blob.type,data});
    return;
  }
  const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=filename;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
}

/** iOS 自定义资源协议通过原生定位，仅接收粗网格；其他端使用浏览器许可。 */
export async function coarseLocation() {
  if (window.webkit?.messageHandlers?.reader) return new Promise((resolve,reject) => {
    const receive = event => { clearTimeout(timer); window.removeEventListener('knowledge-location',receive); event.detail.error ? reject(new Error(event.detail.error)) : resolve(event.detail.cell); };
    const timer = setTimeout(() => {window.removeEventListener('knowledge-location',receive);reject(new Error('位置请求超时'));},15000);
    window.addEventListener('knowledge-location',receive);window.webkit.messageHandlers.reader.postMessage({action:'location'});
  });
  const position = await new Promise((resolve,reject) => navigator.geolocation.getCurrentPosition(resolve,reject,{maximumAge:60000,timeout:10000}));
  const {latitude,longitude}=position.coords;
  return {x:Math.round(longitude*100),y:Math.round(latitude*100)};
}
