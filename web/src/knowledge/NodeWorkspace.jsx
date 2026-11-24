import { useEffect, useRef, useState } from 'react';
import { readLocal } from './local.js';
import { mediaUrl } from './media.js';
import { knowledgeApi } from './api.js';
import { NodeDeleteControls } from './NodeDeleteControls.jsx';
import { NodeLearning } from './NodeLearning.jsx';

/** 每次只展示用户选择的当前页任务，保留原有笔记、探索、学习和核查数据。 */
export function NodeWorkspace({node,nodes,mode,record,onExplore,toast,onDelete,onClose,view='notes',events=[]}) {
  const [image,setImage]=useState(mediaUrl(node.asset.imageUrl)),[query,setQuery]=useState('');
  const [note,setNote]=useState(node.note || ''),[selection,setSelection]=useState(null),[selecting,setSelecting]=useState(false);
  const [claim,setClaim]=useState(''),[evidence,setEvidence]=useState(''),[busy,setBusy]=useState(false);
  const picture=useRef(null),drag=useRef(null);
  const children=nodes.filter(item=>item.parentKey===node.assetKey);

  useEffect(()=>{
    let url,canceled=false;
    readLocal('media',node.asset.imageUrl).then(blob=>{if(blob&&!canceled){url=URL.createObjectURL(blob);setImage(url);}}).catch(()=>{});
    return()=>{canceled=true;if(url)URL.revokeObjectURL(url);};
  },[node.asset.imageUrl]);

  /** 截图沿用实际图片的归一化坐标，明确保留父页路径。 */
  function point(event){
    const rect=picture.current.getBoundingClientRect();
    return {x:Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width)),y:Math.max(0,Math.min(1,(event.clientY-rect.top)/rect.height))};
  }

  /** 拖动只更新框选区域。 */
  function pointerMove(event){
    if(!drag.current)return;const p=point(event),a=drag.current;
    setSelection({x:Math.min(a.x,p.x),y:Math.min(a.y,p.y),w:Math.abs(a.x-p.x),h:Math.abs(a.y-p.y)});
  }

  /** 保存笔记失败时保留编辑内容。 */
  async function saveNote(){
    setBusy(true);try{await record(node.assetKey,'note',{text:note});toast('笔记已保存在本机');}catch(error){toast(error.message);}finally{setBusy(false);}
  }

  /** 只在无限模式下发起新探索，截图和文字都携带当前父页。 */
  async function explore(event){
    event.preventDefault();if(mode!=='infinite'||!query.trim())return;
    if(selecting&&!(selection?.w>.005&&selection?.h>.005)){toast('请先框选图片区域，或取消框选后输入问题');return;}
    const crop=selecting&&selection?.w>.005&&selection?.h>.005;
    try{await onExplore({query,parentKey:node.assetKey,action:crop?'crop':'text',...(crop?{region:selection}:{})});}catch(error){toast(error.message);}
  }

  /** 内容核查使用独立表单，原文和理由都保留给编辑审核。 */
  async function sendCorrection(event){
    event.preventDefault();setBusy(true);
    try{await knowledgeApi('/corrections',{assetKey:node.assetKey,claim,evidence});toast('已提交核查，回复会显示在学习足迹中');setClaim('');setEvidence('');}
    catch(error){toast(error.message);}finally{setBusy(false);}
  }

  return <article className={`node-workspace node-workspace-${view}`} aria-label={node.asset.title}>
    <header><small>{node.asset.domain} · 当前页</small><h2>{node.asset.title}</h2></header>
    {view==='notes'&&<section className="node-note"><label>我的笔记<textarea aria-label="我的笔记" value={note} onChange={event=>setNote(event.target.value)} maxLength={8000} placeholder="一个问题、一句话，或你的理解"/></label>
      <button disabled={busy} onClick={saveNote}>{busy?'正在保存…':'保存笔记'}</button></section>}
    {view==='learning'&&<NodeLearning node={{...node,events:events.filter(event=>event.nodeId===node.id)}} nodes={nodes} record={record} toast={toast}/>}
    {view==='delete'&&<NodeDeleteControls node={node} nodes={nodes} onDelete={onDelete} initiallyConfirming onCancel={onClose}/>}
    {view==='correction'&&<form className="node-correction" onSubmit={sendCorrection}><p>指出需要核查的内容和理由，编辑回复会保存在学习足迹中。</p>
      <label>需要核查的原文<input value={claim} onChange={event=>setClaim(event.target.value)} required maxLength={2000}/></label>
      <label>你的理由或来源<textarea value={evidence} onChange={event=>setEvidence(event.target.value)} required maxLength={4000}/></label>
      <button disabled={busy} type="submit">{busy?'正在提交…':'提交核查'}</button></form>}
    {view==='explore'&&<>
      <div className={`selectable-picture ${selecting?'selecting':''}`} ref={picture}
        onPointerDown={event=>{if(!selecting)return;event.currentTarget.setPointerCapture(event.pointerId);drag.current=point(event);setSelection(null);}}
        onPointerMove={pointerMove} onPointerUp={event=>{pointerMove(event);drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}>
        <img src={image} alt={node.asset.title} draggable="false"/>
        {selecting&&selection&&<div className="crop-selection" style={{left:`${selection.x*100}%`,top:`${selection.y*100}%`,width:`${selection.w*100}%`,height:`${selection.h*100}%`}}/>}
      </div>
      {mode==='infinite'?<><div className="action-row"><button aria-pressed={selecting} onClick={()=>{setSelecting(value=>!value);setSelection(null);}}>框选图片</button></div>
        <form onSubmit={explore}><label>{selecting?'从框选处继续问':'沿着这一页继续问'}<input value={query} onChange={event=>setQuery(event.target.value)} placeholder="你还想弄明白什么？" maxLength={2000} required/></label><button type="submit">探索新枝</button></form></>:
        <p>安全模式可继续打开已发布的相邻节点。</p>}
      {!!children.length&&<section><h3>相邻的可能性</h3><div className="neighbor-list">{children.map(child=><button className={child.lit?'visited':''} key={child.assetKey} onClick={()=>onExplore({existing:child})}>{child.lit?'✦ ':'○ '}{child.asset.title}</button>)}</div></section>}
      {mode==='infinite'&&!!node.asset.anchors?.length&&<div className="neighbor-list">{node.asset.anchors.filter(q=>!children.some(child=>child.asset.title===q)).map((q,i)=><button key={i} onClick={()=>onExplore({query:q,parentKey:node.assetKey,action:'text'})}>{q}</button>)}</div>}
    </>}
  </article>;
}
