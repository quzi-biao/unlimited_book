import { useState } from 'react';

/** 个人节点删除有明确范围和二次确认，公共节点不显示该操作。 */
export function NodeDeleteControls({ node, nodes, onDelete, initiallyConfirming=false, onCancel }) {
  const [confirming,setConfirming]=useState(initiallyConfirming),[scope,setScope]=useState('node');
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  if (!node.deletable) return null;
  const selected=new Set([node.assetKey]),queue=[node.assetKey];
  for(let i=0;i<queue.length;i++) for(const child of nodes) if(child.parentKey===queue[i]&&!selected.has(child.assetKey)) {
    selected.add(child.assetKey);queue.push(child.assetKey);
  }
  /** 等待服务器和本地持久化完成；失败保留确认区供重试。 */
  async function remove() {
    setBusy(true);setError('');
    try {await onDelete(node.assetKey,scope);setConfirming(false);}
    catch(e){setError(e.message);}
    finally{setBusy(false);}
  }
  return <>
    {!initiallyConfirming&&<button className="delete-node-button" onClick={()=>{setError('');setScope('node');setConfirming(true);}}>删除节点</button>}
    {confirming&&<section className="node-delete-confirm" role="alertdialog" aria-label="删除知识节点">
      <h3>删除「{node.asset.title}」？</h3>
      <p>将从你的知识树移除所选页面及其笔记、探索记录。</p>
      {selected.size>1&&<fieldset disabled={busy}><legend>删除范围</legend>
        <label><input type="radio" name="delete-scope" value="node" checked={scope==='node'} onChange={()=>setScope('node')}/>只删这一页，保留下级分枝并上移一层</label>
        <label><input type="radio" name="delete-scope" value="branch" checked={scope==='branch'} onChange={()=>setScope('branch')}/>删除整条分枝（含 {selected.size-1} 个下级节点）</label>
      </fieldset>}
      {error&&<p role="alert">{error}</p>}
      <div className="action-row"><button disabled={busy} onClick={()=>{setConfirming(false);onCancel?.();}}>取消</button>
        <button className="delete-node-button" disabled={busy} onClick={remove}>{busy?'正在删除…':'确认删除'}</button></div>
    </section>}
  </>;
}
