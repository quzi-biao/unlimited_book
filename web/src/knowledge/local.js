import { mediaUrl } from './media.js';
import { pruneDeleted } from './deletions.js';
const DB = 'unlimited-knowledge-v1';
let connection;

/** 离线数据按读者隔离；媒体按不可变 URL 复用。 */
export function database() {
  if (!connection) connection = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 2);
    request.onupgradeneeded = () => {
      for (const name of ['snapshots', 'outbox', 'media', 'jobs', 'archives']) if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return connection;
}

/** 读取持久数据；事务失败不伪装成同步成功。 */
export async function readLocal(store, key) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = db.transaction(store).objectStore(store).get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** 单事务提交变更，避免多个标签页互相覆盖待同步事件。 */
export async function mutateLocal(store, key, transform) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(store, 'readwrite');
    const objectStore = transaction.objectStore(store);
    const request = objectStore.get(key);
    let result;
    request.onsuccess = () => { result = transform(request.result); objectStore.put(result, key); };
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error('本地存储写入失败'));
  });
}

/** 先持久化事件再更新界面，网络失败时保留 outbox。 */
export async function enqueue(profileId, assetKey, type, payload = {}) {
  const event = { id: crypto.randomUUID(), assetKey, type, payload, occurredAt: new Date().toISOString() };
  await mutateLocal('outbox', profileId, events => [...events || [], event]);
  return event;
}

/** 仅移除服务端已确认的事件；同步期间新发生的事件继续保留。 */
export async function acknowledge(profileId, ids) {
  const set = new Set(ids);
  return mutateLocal('outbox', profileId, events => (events || []).filter(e => !set.has(e.id)));
}

/** 快照覆盖前重放尚未确认的本地操作，避免亮节点闪回暗色。 */
export function projectEvents(snapshot, events) {
  const pending = events.filter(e=>!(snapshot.events || []).some(saved=>saved.id===e.id)).sort((a,b)=>a.occurredAt.localeCompare(b.occurredAt)||a.id.localeCompare(b.id));
  const connections=[...snapshot.connections || [],...pending.filter(e=>e.type==='connect').map(e=>({id:e.id,sourceKey:e.assetKey,targetKey:e.payload.targetId,reason:e.payload.reason}))];
  return { ...snapshot, connections, nodes: snapshot.nodes.map(node => {
    let result = { ...node };
    for (const e of pending) if (e.assetKey === node.assetKey) {
      if (e.type === 'open') result = { ...result, lit: true, mastery:Math.max(result.mastery||0,1), openedAt: result.openedAt || e.occurredAt, visits: (result.visits || 0) + 1 };
      if (e.type === 'note') result.note = e.payload.text;
      if (e.type === 'review') result.mastery = e.payload.rating === 'again' ? 1 : e.payload.rating === 'understood' ? 4 : 2;
      if (e.type === 'connect') result.mastery = Math.max(result.mastery||0,3);
    }
    return result;
  }) };
}

/** 保留此前下载过的各棵树，不因切换安全模式或公共树丢失本机归档。 */
export function archiveSnapshot(data) {
  return mutateLocal('archives',data.profile.id,previous=>{
    const nodes=new Map((previous?.nodes || []).map(n=>[n.assetKey,n]));
    for(const node of data.nodes) nodes.set(node.assetKey,node);
    return pruneDeleted({...data,nodes:[...nodes.values()],events:[...previous?.events || [],...data.events || []].filter((e,i,list)=>list.findIndex(x=>x.id===e.id)===i)});
  });
}

/** 缓存图片字节用于离线阅读；保留原 URL 以便导出与跨设备同步。 */
export async function cacheMedia(url) {
  if (!url || await readLocal('media', url)) return;
  const response = await fetch(mediaUrl(url));
  if (!response.ok) throw new Error('图片未缓存');
  const blob = await response.blob();
  if (!blob.type.startsWith('image/') && !blob.type.startsWith('audio/')) throw new Error('媒体格式不正确');
  await mutateLocal('media', url, () => blob);
}
