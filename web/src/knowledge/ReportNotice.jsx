import { useEffect, useState } from 'react';
import { knowledgeApi } from './api.js';
import { Report } from './AccountPanel.jsx';

/** 周报／月报只在应用内提醒，可关闭；读者标记按账号与周期隔离。 */
export function ReportNotice({profile}) {
  const [notices,setNotices]=useState([]);const [opened,setOpened]=useState(false);
  const storageKey=`knowledge_reports_read:${profile.id}`;
  useEffect(()=>{
    let canceled=false;setOpened(false);setNotices([]);
    if(profile.username) knowledgeApi('/reports').then(data=>{
      if(canceled)return;
      let read=[];try {read=JSON.parse(localStorage.getItem(storageKey)||'[]');} catch {}
      setNotices(data.notices.filter(n=>!read.includes(n.id)));
    }).catch(()=>{});
    return()=>{canceled=true;};
  },[profile.id,profile.username]);
  if(!notices.length)return null;
  /** 用户查看或跳过之后本周期不重复提醒。 */
  function dismiss() {localStorage.setItem(storageKey,JSON.stringify(notices.map(n=>n.id)));setNotices([]);setOpened(false);}
  return <aside className="report-notice"><button onClick={()=>setOpened(!opened)}>{notices.length===1?notices[0].title:`${notices.length} 份本周探险报`} · {opened?'收起':'查看'}</button><button onClick={dismiss}>本次略过</button>{opened&&<section className="knowledge-panel">{notices.map(n=><div key={n.id}><h2>{n.title}</h2><Report report={n.report}/></div>)}<button onClick={dismiss}>我已读过</button></section>}</aside>;
}
