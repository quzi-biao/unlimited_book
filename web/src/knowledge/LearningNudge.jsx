import { useState } from 'react';

/** 到期回想自然呈现在探索入口，用户可以跳过；不追逐点击与停留时长。 */
export function LearningNudge({snapshot,onOpen}) {
  const [dismissed,setDismissed]=useState(false);
  const due=snapshot.nodes.filter(n=>n.lit&&n.nextReviewAt&&+new Date(n.nextReviewAt)<=Date.now()).sort((a,b)=>+new Date(a.nextReviewAt)-+new Date(b.nextReviewAt)).slice(0,2);
  if(dismissed||!due.length)return null;
  return <aside className="learning-nudge"><span>似曾相识：还记得这些吗？</span>{due.map(n=><button key={n.assetKey} onClick={()=>onOpen(n)}>{n.asset.title}</button>)}<button onClick={()=>setDismissed(true)}>这次跳过</button></aside>;
}
