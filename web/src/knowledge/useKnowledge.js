import { useCallback, useEffect, useRef, useState } from 'react';
import { knowledgeApi } from './api.js';
import { readLocal, mutateLocal, enqueue, acknowledge, projectEvents, cacheMedia, archiveSnapshot } from './local.js';
import { pruneDeleted } from './deletions.js';

/** 读取本地快照并连接云端；离线事件追加而非覆盖整份个人库。 */
export function useKnowledge(ready, toast) {
  const [snapshot, setSnapshot] = useState(null);
  const [status, setStatus] = useState('正在读取本地知识树');
  const [pending, setPending] = useState(0);
  const [mediaStatus, setMediaStatus] = useState('');
  const current = useRef(null);
  const syncing = useRef(null);
  const epoch = useRef(0);
  const rendering = useRef(0);
  const installing = useRef(Promise.resolve());

  /** 本地投影带序号，较早的异步读取不能覆盖较新的记录。 */
  const renderLocal = useCallback(async () => {
    const ticket = ++rendering.current;
    const data = current.current;
    if (!data) return;
    const events = await readLocal('outbox', data.profile.id) || [];
    if (ticket !== rendering.current || data !== current.current) return;
    setSnapshot(projectEvents(data, events)); setPending(events.length);
  }, []);

  /** 云端快照保存到本地，同时重放未确认事件。 */
  const install = useCallback((data) => {
    const turn = epoch.current;
    const work=installing.current.catch(()=>{}).then(async()=>{
      data = await mutateLocal('snapshots', data.profile.id, previous =>
        (previous?.profile.treeRevision || 0) > (data.profile.treeRevision || 0) ? previous : pruneDeleted(data));
      await archiveSnapshot(data);
      const removed=new Set(data.deletedKeys || []);
      await mutateLocal('outbox',data.profile.id,events=>(events || []).filter(e=>!removed.has(e.assetKey)&&!removed.has(e.payload?.targetId)));
      if (turn !== epoch.current) return;
      localStorage.setItem('knowledge_active_profile', data.profile.id);
      current.current = data;
      await renderLocal();
    });
    installing.current=work;return work;
  }, [renderLocal]);

  /** 连续补传全部批次；服务端同时验证账号归属，只删除已经确认的事件。 */
  const sync = useCallback(async () => {
    if (syncing.current) return syncing.current;
    const turn = epoch.current;
    const work = (async () => {
      try {
        setStatus('正在同步');
        do {
          const id = current.current?.profile.id;
          const events = id ? await readLocal('outbox', id) || [] : [];
          const data = events.length ? await knowledgeApi('/sync', { profileId:id, events:events.slice(0,200) }) : await knowledgeApi('/library');
          if (turn !== epoch.current) return;
          if (id && id !== data.profile.id && events.length) throw new Error('账号已切换，原账号的离线记录已保留');
          await install(data);
          // 先落盘云端快照再删除 outbox；崩溃在两者之间时重放去重，不能丢本机记录。
          if (data.ack) { await acknowledge(data.profile.id, data.ack); await renderLocal(); }
          const remaining = await readLocal('outbox',data.profile.id) || [];
          if (!remaining.length) break;
          if (events.length && !data.ack?.length) throw new Error('同步尚未得到确认，记录已保留');
        } while (turn === epoch.current);
        setStatus('本地与云端已同步');
      } catch (error) {
        setStatus(error.status === 401 ? '账号登录已过期' : '离线记录已保存在本机');
        if (error.status) toast(error.message);
      }
    })();
    syncing.current = work;
    try { await work; } finally { syncing.current = null; }
  }, [install, renderLocal, toast]);

  useEffect(() => {
    let canceled = false;
    const id = localStorage.getItem('knowledge_active_profile');
    if (id) readLocal('snapshots', id).then(data => { if (data && !canceled && !current.current) install(data); }).catch(e => toast(e.message));
    return () => { canceled = true; };
  }, [install, toast]);

  useEffect(() => {
    if (!ready) return;
    sync();
    const interval = setInterval(sync, 20000);
    window.addEventListener('online', sync);
    return () => { clearInterval(interval); window.removeEventListener('online', sync); };
  }, [ready, sync]);

  useEffect(() => {
    if (!snapshot || !navigator.onLine) return;
    let canceled = false;
    (async () => {
      let count = 0; let failed = 0;
      for (const node of snapshot.nodes) {
        if (canceled) return;
        try { await cacheMedia(node.asset.imageUrl); count++; } catch { failed++; }
      }
      if (!canceled) setMediaStatus(failed ? `${count} 张图已离线保存，${failed} 张待重试` : '图片已保存到本机');
    })();
    return () => { canceled = true; };
  }, [snapshot?.syncedAt]);

  /** 本地持久化失败时提醒，不冒称记录已保存。 */
  const record = useCallback(async (assetKey, type, payload) => {
    if (!current.current) return;
    try {
      const id = current.current.profile.id;
      await enqueue(id, assetKey, type, payload);
      if (current.current?.profile.id !== id) return;
      await renderLocal();
      if (navigator.onLine) sync();
    } catch (error) { toast(`保存失败：${error.message}`); throw error; }
  }, [sync, toast, renderLocal]);

  /** 设置使用乐观锁；冲突时加载云端版本，由用户重新选择。 */
  const settings = useCallback(async values => {
    try {
      await knowledgeApi('/account/settings', { ...values, revision: current.current.profile.settingsRevision }, 'PATCH');
      await sync();
    } catch (error) { toast(error.message); if (error.status === 409) await sync(); }
  }, [sync, toast]);

  /** 删除须由云端确认后安装完整快照，网络失败时保留现有节点。 */
  const removeNode = useCallback(async (assetKey,scope) => {
    if (!navigator.onLine) throw new Error('请联网后删除节点');
    await syncing.current;
    const data=current.current;
    const work=(async()=>{
      const result=await knowledgeApi(`/nodes/${encodeURIComponent(assetKey)}`,{
        profileId:data.profile.id,treeRevision:data.profile.treeRevision || 0,scope,
      },'DELETE');
      if (current.current?.profile.id !== data.profile.id) return;
      await install(result);return result;
    })();
    syncing.current=work;
    try{return await work;}finally{if(syncing.current===work)syncing.current=null;}
  },[install]);

  /** 切换账号先结束当前同步；原账号离线 outbox 继续单独保留。 */
  const switchAccount = useCallback(async token => {
    await syncing.current;
    epoch.current++;
    if (token) localStorage.setItem('knowledge_reader_token', token); else localStorage.removeItem('knowledge_reader_token');
    localStorage.removeItem('knowledge_active_profile');
    rendering.current++; current.current = null; setSnapshot(null); setPending(0);
    await sync();
  }, [sync]);

  return { snapshot, status, pending, mediaStatus, sync, record, settings, removeNode, switchAccount, install };
}
