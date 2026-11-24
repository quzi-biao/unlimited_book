import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useKnowledge } from './useKnowledge.js';
import { knowledgeApi } from './api.js';
import { readLocal, mutateLocal } from './local.js';
import { NodeWorkspace } from './NodeWorkspace.jsx';
import { AccountPanel } from './AccountPanel.jsx';
import { LearningPanel } from './LearningPanel.jsx';
import { printBranch } from './export.js';
import { readerPreferences } from './preferences.js';
import { ReportNotice } from './ReportNotice.jsx';
import App from '../App.jsx';
import { AppStateProvider } from '../contexts/AppStateContext.jsx';
import { AppLogo } from '../components/common/Icons.jsx';
import { LoadingSpinner } from '../components/common/LoadingSpinner.jsx';
import appStyles from '../App.module.css';
import './knowledge.css';
import './reader-integration.css';
import { pruneJobs } from './deletions.js';
import './node-workspace.css';

const nodeViews={notes:'notes',explore:'explore','node-learning':'learning',correction:'correction',delete:'delete'};

/** 全端共用的知识树入口；账号数据、队列与媒体均有本地持久副本。 */
export default function KnowledgeApp() {
  const auth = useAuth();
  const [message, setMessage] = useState('');
  const toast = useCallback(text => setMessage(String(text)), []);
  const library = useKnowledge(!auth.loading && !auth.error, toast);
  const { snapshot, record } = library;
  const [selected, setSelected] = useState(null); const [panel, setPanel] = useState(null);
  const [jobs, setJobs] = useState([]);
  const running = useRef(new Set()); const profileId = snapshot?.profile.id;
  const activeProfile = useRef(profileId); activeProfile.current = profileId;
  const node = selected?.owner === profileId ? snapshot?.nodes.find(n => n.assetKey === selected.key) : null;

  useEffect(()=>{
    if (selected?.owner===profileId && snapshot?.deletedKeys?.includes(selected.key)) {
      setSelected(null);setPanel('tree');
    }
  },[profileId,selected,snapshot?.deletedKeys]);

  useEffect(() => { if (!message) return; const timer = setTimeout(() => setMessage(''),6500); return () => clearTimeout(timer); },[message]);
  useEffect(() => {
    let active = true;
    setSelected(null); setJobs([]); setPanel(null);
    if (profileId) readLocal('jobs',profileId).then(items => {
      if (active) setJobs((items || []).map(j => j.status === 'running' ? { ...j,status:'paused',nextAttempt:Date.now()+3000 } : j));
    }).catch(e => { if (active) toast(e.message); });
    return () => { active = false; };
  },[profileId, toast]);

  useEffect(()=>{
    if (!profileId || !snapshot.deletedKeys?.length) return;
    mutateLocal('jobs',profileId,items=>pruneJobs(items,snapshot.deletedKeys)).then(items=>{
      if(activeProfile.current===profileId)setJobs(items);
    }).catch(e=>toast(e.message));
  },[profileId,snapshot?.deletedKeys?.join('|'),toast]);

  /** 选择才点亮，预载图片不算探索。 */
  async function openNode(next) {
    setSelected({key:next.assetKey,owner:profileId}); setPanel(null);
    await record(next.assetKey, 'open');
  }

  /** 任务先入本地队列；请求中断后用户可重试，服务端租约防止重复生成。 */
  async function runJob(job,refreshRevision=false) {
    if (running.current.has(job.id)) return;
    running.current.add(job.id);
    const owner = profileId;
    const input=refreshRevision?{...job.input,treeRevision:snapshot.profile.treeRevision || 0}:job.input;
    const save = async updates => {
      const list = await mutateLocal('jobs', owner, items => (items || []).map(item => item.id === job.id ? { ...item,...updates } : item));
      if (activeProfile.current === owner) setJobs(list);
    };
    await save({ status:'running', input, error:null });
    try {
      let result = await knowledgeApi('/explore', { ...input,profileId:owner });
      if (result.pending) { await save({ status:'paused',nextAttempt:Date.now()+Math.max(3,result.retryAfter||3)*1000,error:'同一路径正在生成，正在等待云端结果' }); return; }
      if (activeProfile.current === owner) await library.sync();
      await save({ status:'done',assetKey:result.asset.key });
      if (activeProfile.current !== owner) return;
      toast(result.fromCache ? '已取回云端已有内容，未重复生成' : '新分枝已保存，并进入公共树审核队列');
    } catch(error) {
      await save({ status:'failed',error:error.message });
      if(activeProfile.current===owner){if(error.status===409)await library.sync();toast(error.message);}
    }
    finally { running.current.delete(job.id); }
  }

  useEffect(() => {
    if (!profileId || snapshot.profile.mode === 'safe') return;
    const timer = setInterval(() => {
      if (!navigator.onLine) return;
      const next = jobs.find(j => ['queued','paused'].includes(j.status) && (j.nextAttempt || 0) <= Date.now() && !running.current.has(j.id));
      if (next) runJob(next);
    },3000);
    return () => clearInterval(timer);
  }, [profileId,jobs,snapshot?.profile.mode]);

  /** 已有节点直接打开，新增分枝仅在无限模式下进入生成队列。 */
  async function explore(input) {
    if (input.existing) return openNode(input.existing);
    const match = snapshot.nodes.find(n => n.globalNodeId && n.treeId === snapshot.profile.selectedTreeId && n.asset.title === input.query.trim() && (n.parentKey || null) === (input.parentKey || null));
    if (match && input.action !== 'crop') return openNode(match);
    if (snapshot.profile.mode === 'safe') { toast('安全模式请从知识树中选择已经发布的节点'); return; }
    const job = { id:crypto.randomUUID(), input:{...input,treeRevision:snapshot.profile.treeRevision || 0}, status:'queued',createdAt:new Date().toISOString() };
    const list = await mutateLocal('jobs',profileId, items => [...items || [],job]);
    if (activeProfile.current !== profileId) return;
    setJobs(list); setPanel('queue');
    runJob(job);
  }

  /** 连接候选可能来自另一棵公共树，显式切换后再打开。 */
  async function openKey(key, treeId) {
    const existing = snapshot.nodes.find(n => n.assetKey === key);
    if (existing) return openNode(existing);
    if (treeId) {
      await library.settings({ selectedTreeId:treeId });
      const fresh = await knowledgeApi('/library'); await library.install(fresh);
      const found = fresh.nodes.find(n => n.assetKey === key); if (found) await openNode(found);
    } else toast('当前知识树暂时没有这页，请同步后再打开');
  }

  /** 移除队列记录不删除已经生成的书页。 */
  async function removeJob(id) {
    const next = await mutateLocal('jobs',profileId, items => (items || []).filter(j => j.id !== id));
    if (activeProfile.current === profileId) setJobs(next);
  }

  /** 删除完成后关闭当前页，返回已同步的知识树。 */
  async function deleteNode(key,scope) {
    const owner=profileId;
    await library.removeNode(key,scope);
    if(activeProfile.current!==owner)return;
    setSelected(null);setPanel('tree');
    toast(scope==='branch'?'已删除这条分枝':'已从知识树删除这一页');
  }

  if (!snapshot) return <div className={appStyles.fullCenter}><div className={appStyles.splash}>
    <AppLogo size={88} className={appStyles.splashLogo}/><h1 className={appStyles.splashTitle}>无限之书</h1>
    {auth.error || library.status.includes('离线') ? <><p>{auth.error || library.status}</p><button className="btn btn-primary" onClick={()=>{auth.initAuth();library.sync();}}>重新连接</button></> : <LoadingSpinner text="正在读取你的无限之书…"/>}
  </div></div>;
  const profile = snapshot.profile;
  const safe = profile.mode === 'safe';
  const deviceShelf = !!snapshot.deviceShelf && !safe;
  const preferences = readerPreferences(profile);
  const sectionTitle = {tree:'知识树', learning:'学习足迹', account:'我的账号', notes:'笔记',explore:'深入探索','node-learning':'学习记录',correction:'内容核查',delete:'删除节点'};
  const workspace = {snapshot, node, safe, deviceShelf, preferences, openNode, explore, openPanel:setPanel,
    treeOpen:panel === 'tree', settings:library.settings, sync:library.sync, pending:library.pending,
    status:library.status, mediaStatus:library.mediaStatus,
    closeNode:()=>setSelected(null), jobs:pruneJobs(jobs,snapshot.deletedKeys), record, queueOpen:panel === 'queue',
    setQueueOpen:open => setPanel(current => open ? 'queue' : current === 'queue' ? null : current),
    retryJob:job=>runJob(job,true), openJob:openKey, removeJob, printNode:n=>printBranch(n,snapshot.nodes).catch(error=>toast(error.message))};
  return <>
    <AppStateProvider key={profile.id + ':' + deviceShelf} deviceShelf={deviceShelf}
      initialShelfOpen={panel === 'tree'} openForTreePanel={panel === 'tree'}><App knowledge={workspace}/></AppStateProvider>
    {sectionTitle[panel] && panel !== 'tree' && <div className="shelf-dialog-backdrop" onClick={()=>setPanel(null)} onKeyDown={e=>{if(e.key==='Escape')setPanel(null);}}>
      <section className={`knowledge-app shelf-dialog${panel==='tree'?' knowledge-tree-dialog':''}${nodeViews[panel]?' node-task-dialog':''}`} aria-label={sectionTitle[panel]} role="dialog" aria-modal="true" onClick={e=>e.stopPropagation()}>
        <header className="shelf-dialog-header"><h2>{sectionTitle[panel]}</h2><button autoFocus aria-label={panel==='account'?'返回知识树':'返回阅读'} onClick={()=>setPanel(panel==='account'?'tree':null)}>{panel==='account'?'返回知识树':'关闭'}</button></header>
        {nodeViews[panel]&&node&&<NodeWorkspace key={node.assetKey+':'+panel} view={nodeViews[panel]} node={node} nodes={snapshot.nodes} events={snapshot.events} mode={profile.mode} record={record} onExplore={explore} toast={toast} onClose={()=>setPanel(null)} onDelete={deleteNode}/>}
        {panel==='account' && <AccountPanel profile={profile} switchAccount={library.switchAccount} settings={library.settings} toast={toast}/>}
        {panel==='learning' && <><ReportNotice profile={profile}/><LearningPanel snapshot={snapshot} onOpen={openKey} onClose={()=>setPanel('tree')} toast={toast} selected={node?.assetKey}/></>}
        <footer className="sync-status"><span>{library.pending ? `${library.pending} 条记录等待同步` : library.status} · {library.mediaStatus}</span><button onClick={library.sync}>立即同步</button></footer>
      </section>
    </div>}
    {message && <div role="status" className="knowledge-toast" onClick={()=>setMessage('')}>{message}</div>}
  </>;
}
