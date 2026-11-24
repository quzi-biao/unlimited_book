import { useState } from 'react';

/** 回想和主动连接只显示在学习记录中，不夹在解读或笔记编辑器里。 */
export function NodeLearning({node,nodes,record,toast}) {
  const [connection,setConnection]=useState(''),[reason,setReason]=useState('');

  /** 记录显式回想或连接，失败时保留输入并提示。 */
  async function save(type,payload){
    try{await record(node.assetKey,type,payload);toast(type==='connect'?'这条连接已留下':'回想记录已保存');}
    catch(error){toast(error.message);}
  }

  const saved=(node.events || []).filter(event=>event.type==='connect');
  return <div className="node-learning">
    <section><h3>回想记录</h3><p>这片知识：{['还未走近','擦过','练过','连过','已能自己讲清'][node.mastery || 0]}。</p>
      <p>可以自愿记录这次回想的感受。</p><div className="action-row">
        {[['again','还想再看看'],['remembered','能回想起来'],['understood','能用自己的话解释']].map(([rating,label])=><button key={rating} onClick={()=>save('review',{rating})}>{label}</button>)}
      </div></section>
    <section><h3>我发现的连接</h3><p>连接由你判断，可以关联另一片已点亮的知识。</p>
      <select aria-label="连接到的节点" value={connection} onChange={event=>setConnection(event.target.value)}><option value="">选择另一片已点亮的知识</option>
        {nodes.filter(item=>item.lit&&item.assetKey!==node.assetKey).map(item=><option key={item.assetKey} value={item.assetKey}>{item.asset.title}</option>)}
      </select><input value={reason} onChange={event=>setReason(event.target.value)} placeholder="它们为什么有关？由你判断" maxLength={2000}/>
      <button disabled={!connection||!reason.trim()} onClick={()=>save('connect',{targetId:connection,reason})}>留下连接</button>
      {!!saved.length&&<ul>{saved.map(event=><li key={event.id}>{event.payload.reason}</li>)}</ul>}
    </section>
  </div>;
}
