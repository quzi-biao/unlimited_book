import { createHash } from 'node:crypto';

/** 构建时预缓存完整应用壳；个人 API 从不进入共享 CacheStorage。 */
export function offlinePlugin() {
  return { name:'knowledge-offline', generateBundle(_options,bundle) {
    const files=[...new Set(['index.html','app-logo.png',...Object.keys(bundle).filter(name=>!name.endsWith('.map'))])];
    const version=createHash('sha256').update('shell-2:'+files.join('|')).digest('hex').slice(0,12);
    const source=`const CACHE='unlimited-shell-${version}';
const FILES=${JSON.stringify(files)};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES.map(name=>new URL(name,self.registration.scope).href))).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('unlimited-shell-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.includes('/api/'))return;
 if(event.request.mode==='navigate')event.respondWith(fetch(event.request).catch(()=>caches.match(new URL('index.html',self.registration.scope).href)));
 else event.respondWith(caches.match(event.request,{ignoreVary:true}).then(cached=>cached||fetch(event.request)));
});`;
    this.emitFile({type:'asset',fileName:'sw.js',source});
  }};
}
