import { isMinor } from './policy.js';

/** 字词重合只用于当下相关性，不使用点击率、停留时长或画像广告分数。 */
function words(asset) {
  const text=[asset?.title,...asset?.anchors || []].join(' ').toLowerCase();
  return new Set([...text.matchAll(/[a-z]{3,}|[\u4e00-\u9fff]{2}/gu)].map(m=>m[0]));
}

/** 无向图最短距离包括父子边与用户确认的连接；未连通节点视为远域候选。 */
function distances(source, candidates, graph) {
  const adjacency=new Map();
  const pairs=[...graph,...candidates.filter(n=>n.parentKey).map(n=>[n.key,n.parentKey])];
  for (const [a,b] of pairs) {
    adjacency.set(a,[...adjacency.get(a)||[],b]);adjacency.set(b,[...adjacency.get(b)||[],a]);
  }
  const result=new Map(source ? [[source,0]] : []);const queue=source?[source]:[];
  for(let i=0;i<queue.length;i++) for(const next of adjacency.get(queue[i])||[]) if(!result.has(next)) {result.set(next,result.get(queue[i])+1);queue.push(next);}
  return result;
}

/** 跨域优先、图距离、领域稀有度与当下相关共同排序；只提出待判断的连接。 */
export function connectionSuggestions(profile, visited, candidates, limit = 6, graph = []) {
  const counts=new Map();for(const n of visited)counts.set(n.domain,(counts.get(n.domain)||0)+1);
  const recent=visited.slice(-12);const distribution=new Map();
  for(const n of recent)distribution.set(n.domain,(distribution.get(n.domain)||0)+1);
  const entropy=recent.length ? -[...distribution.values()].reduce((sum,n)=>sum+n/recent.length*Math.log2(n/recent.length),0) : 0;
  const narrow=recent.length>=6&&entropy<1.2;
  const preferred=new Set([...counts].sort((a,b)=>b[1]-a[1]).slice(0,2).map(([domain])=>domain));
  const known=new Set(visited.map(n=>n.key));const current=visited.at(-1);const context=words(current);
  const hops=distances(current?.key,[...visited,...candidates],graph);
  const unique=[...new Map(candidates.filter(n=>!known.has(n.key)).map(n=>[n.key,n])).values()];
  const score=n=>{
    const related=[...words(n)].filter(w=>context.has(w)).length;
    const distance=Math.min(8,hops.get(n.key)??8);
    return (!preferred.has(n.domain)?10:0)+distance+4/(1+(counts.get(n.domain)||0))+Math.min(related,4);
  };
  const pool=unique.sort((a,b)=>score(b)-score(a)||a.key.localeCompare(b.key));
  const outside=pool.filter(n=>!preferred.has(n.domain));
  const quota=isMinor(profile)?Math.ceil(limit*(narrow?.5:1/3)):0;
  const reserved=outside.slice(0,quota);const selected=new Set(reserved.map(n=>n.key));
  return [...reserved,...pool.filter(n=>!selected.has(n.key))].slice(0,limit).map(n=>({...n,suggestion:true,relation:'temporary',
    reason:current?`你有没有想过「${current.title || current.domain}」与「${n.title || n.domain}」可能相连？`:'换一个领域，看看是否存在意外的连接'}));
}
