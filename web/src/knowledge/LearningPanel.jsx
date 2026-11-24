import { useEffect, useState } from 'react';
import { knowledgeApi } from './api.js';
import { coarseLocation } from './media.js';
import { Report } from './AccountPanel.jsx';

/** 回想、候选连接、主动诊断和可见纠错共用同一份轨迹。 */
export function LearningPanel({ snapshot, onOpen, onClose, toast, selected }) {
  const [data, setData] = useState(null); const [corrections, setCorrections] = useState([]);
  const [treeId, setTreeId] = useState(snapshot.profile.selectedTreeId || '');
  const [diagnosis, setDiagnosis] = useState(null); const [accepted, setAccepted] = useState(false);
  const [nearby, setNearby] = useState(null); const [radius, setRadius] = useState(1);
  const [nearbyEnabled, setNearbyEnabled] = useState(false);

  /** 刷新以实际记录为准，离线时保留本地知识树。 */
  async function load() {
    try {
      const [learning, fixes] = await Promise.all([knowledgeApi('/learning'),knowledgeApi('/corrections')]);
      setData(learning); setCorrections(fixes.corrections);
    } catch(error) { toast(error.message); }
  }
  useEffect(() => { load(); }, [snapshot.profile.id]);

  /** 精确位置只在本机使用，上传约一公里粗网格且不携带身份。 */
  async function locate() {
    try {
      if (!nearbyEnabled || !selected) throw new Error('请先选择一个节点并开启邻域信号');
      const permission = await knowledgeApi('/nearby/permit', { enabled: true });
      const cell = await coarseLocation();
      const response = await fetch(`${window.unlimitedBookNative?.apiBase || ''}/api/knowledge/nearby/count`, { method:'POST', credentials:'omit', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ permit:permission.permit, cell, topic:selected, radius }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error); setNearby(result);
    } catch(error) { toast(error.message); }
  }
  return <section className="knowledge-panel" aria-label="学习足迹"><header><h2>走过的路与新的可能</h2><button onClick={onClose}>关闭</button></header>
    <section><h3>也许值得再想一想</h3><p>按上次回想安排，可以随时跳过。</p>{data?.due.length === 0 && <p>暂时没有到期的回想。</p>}<div className="neighbor-list">{data?.due.map(n => <button key={n.id} onClick={() => onOpen(n.assetKey)}>{n.asset.title}</button>)}</div></section>
    <section><h3>可能的连接，由你判断</h3><div className="suggestion-grid">{data?.suggestions.map(n => <button key={n.key} onClick={() => onOpen(n.key, n.treeId)}><strong>{n.title}</strong><small>{n.domain} · 暂定</small><span>{n.reason}</span></button>)}</div></section>
    {data && <Report report={data.report}/>}
    <section><h3>有限之书 · 主动选择一个范围</h3><p>这是同一棵个人知识树的可选视图。它不会改变你的探索方向。</p><select aria-label="诊断范围" value={treeId} onChange={e => { setTreeId(e.target.value); setAccepted(false); setDiagnosis(null); }}>{snapshot.trees.map(t => <option value={t.id} key={t.id}>{t.title}</option>)}</select>
      <label><input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)}/>我选择采纳这个外部范围</label>
      <button disabled={!accepted} onClick={async () => { try { setDiagnosis(await knowledgeApi('/diagnosis',{ treeId,accepted })); } catch(e) { toast(e.message); } }}>查看可选补</button>
      {diagnosis && <div><p>{diagnosis.curriculum || '编辑自定义范围'}</p>{diagnosis.optional.map(n => <button key={n.assetKey} onClick={() => onOpen(n.assetKey, treeId)}>可选补 · {n.title}</button>)}</div>}</section>
    <section><h3>我的核查记录</h3>{corrections.map(c => <article key={c.id} className="correction-card"><p>原文：{c.claim}</p><p>我的理由：{c.evidence}</p><p>{c.status === 'resolved' ? `核查回复：${c.resolution}` : '等待编辑核查'}</p>
      {c.status === 'resolved' && !c.acknowledged && <button onClick={async () => { try { await knowledgeApi(`/corrections/${c.id}/acknowledge`,{}); load(); } catch(e) { toast(e.message); } }}>我已阅读，并会自己判断</button>}</article>)}</section>
    <section><h3>邻域共学</h3><p>默认关闭，只提供短期匿名聚合信号。位置在本机粗化，不显示其他人的身份。少于五个信号时隐藏人数。</p>
      <label><input type="checkbox" checked={nearbyEnabled} onChange={e => { setNearbyEnabled(e.target.checked); setNearby(null); }}/>此次开启附近信号</label>
      <select aria-label="附近范围" value={radius} onChange={e => setRadius(Number(e.target.value))}>{[1,3,5].map(r => <option value={r} key={r}>约 {r} 公里</option>)}</select>
      <button disabled={!nearbyEnabled || !selected} onClick={locate}>查看当前节点附近信号</button>{nearby && <p>{nearby.message}{nearby.count ? `：约 ${nearby.count} 个信号` : ''}</p>}</section>
  </section>;
}
