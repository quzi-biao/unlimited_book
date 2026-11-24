import { forestLabel, NODE_WIDTH, ROOT_WIDTH } from './forestLayout.js';

/** 叶片只装饰真实枝条，不代表额外的可探索节点。 */
function Leaf({x,y,flip=false,lit=false,small=false}) {
  return <path className={`forest-leaf ${lit?'lit':''}`} transform={`translate(${x},${y}) scale(${flip?-1:1},1)${small?' scale(.72)':''}`}
    d="M0 0C-25-1-35-15-42-32C-17-36 4-20 0 0ZM0 0L-25-22"/>;
}

/** 节点末端保留嫩枝，表达同一棵知识树仍会继续生长。 */
function Twig({node}) {
  const top=node.y-(node.depth?23:33),lit=node.pathLit;
  return <g aria-hidden="true">
    <path className={`forest-twig ${lit?'lit':''}`} d={`M${node.x} ${top}C${node.x+8} ${top-28} ${node.x-9} ${top-52} ${node.x} ${top-77}`}/>
    <Leaf x={node.x+1} y={top-29} lit={lit}/><Leaf x={node.x-1} y={top-49} flip lit={lit} small/>
  </g>;
}

/** 共同树干在父页上方分枝，线条随深度变细，并点亮已探索路径。 */
function Branches({node,children}) {
  if (!children.length) return <Twig node={node}/>;
  const top=node.y-(node.depth?23:33),joint=top-(node.depth?30:44);
  const thickness=Math.max(2.2,10-node.depth*2.2);
  return <g aria-hidden="true">
    <path className={`forest-branch ${node.pathLit?'lit':''}`} strokeWidth={thickness}
      d={`M${node.x} ${top}Q${node.x+4} ${(top+joint)/2} ${node.x} ${joint}`}/>
    {children.map(child=>{
      const end=child.y+23,dx=child.x-node.x,leafY=joint+(end-joint)*.42,leafX=node.x+dx*.35;
      return <g key={child.assetKey}>
        <path className={`forest-branch ${child.pathLit?'lit':''}`} strokeWidth={Math.max(2,thickness-1.5)}
          d={`M${node.x} ${joint}C${node.x+dx*.22} ${joint-25} ${child.x-dx*.1} ${end+35} ${child.x} ${end}`}/>
        <Leaf x={leafX} y={leafY} flip={dx>0} lit={child.pathLit} small={node.depth>0}/>
      </g>;
    })}
  </g>;
}

/** 书页卡片支持鼠标、触摸、键盘和完整标题提示；亮暗仍由真实探索记录决定。 */
function ForestNode({node,selected,onSelect}) {
  const root=!node.depth,width=root?ROOT_WIDTH:NODE_WIDTH,height=root?62:44;
  return <g transform={`translate(${node.x},${node.y})`} role="button" tabIndex="0"
    aria-label={`${node.asset.title}，${node.lit?'已探索':'未探索'}`} aria-pressed={selected===node.assetKey}
    className={`tree-node forest-node ${root?'forest-topic':''} ${node.lit?'lit':''} ${selected===node.assetKey?'selected':''}`}
    onClick={()=>onSelect(node)} onKeyDown={event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();onSelect(node);}}}
    onFocus={event=>event.currentTarget.scrollIntoView({block:'nearest',inline:'nearest'})}>
    <title>{node.asset.title}{node.relation==='temporary'?' · 暂定连接':''}</title>
    <rect className="forest-focus" x={-width/2-4} y={-height/2-4} width={width+8} height={height+8} rx="16"/>
    <rect className="forest-card" x={-width/2} y={-height/2} width={width} height={height} rx="12"/>
    <g transform={`translate(${-width/2+13},${root?-14:-10})`} className="forest-node-icon">
      <svg width={root?25:20} height={root?25:20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M4 20C1 7 9 3 21 3C21 15 17 22 4 20ZM4 20L16 8"/></svg>
    </g>
    <text className="forest-title" x={-width/2+(root?49:40)} y={root?-3:5}>{forestLabel(node.asset.title,root?11:9)}</text>
    {root&&<text className="forest-domain" x={-width/2+49} y="17">{forestLabel(node.asset.domain || '知识探索',13)}</text>}
    {node.lit&&<circle className="forest-opened" cx={width/2-8} cy={-height/2+8} r="2.8"/>}
  </g>;
}

/** 所有话题从同一主干分出；显示根部不冒充真实知识页，跨页连接仍以虚线呈现。 */
export function ForestDrawing({layout,connections,selected,onSelect}) {
  const byKey=new Map(layout.nodes.map(node=>[node.assetKey,node])),children=new Map();
  for(const node of layout.nodes) if(node.layoutParentKey)children.set(node.layoutParentKey,[...children.get(node.layoutParentKey)||[],node]);
  const root=layout.root;
  return <>
    <g aria-hidden="true">
      <path className={`personal-tree-trunk ${root.lit?'lit':''}`} d={`M${root.x} ${root.y-32}C${root.x-10} ${root.y-65} ${root.x+7} ${root.jointY+24} ${root.x} ${root.jointY}`}/>
      {layout.branches.map(branch=>{
        const topic=branch.topic,dx=topic.x-root.x;
        return <path key={branch.key} className={`personal-tree-limb ${branch.lit?'lit':''}`} data-topic={branch.key}
          d={`M${root.x} ${root.jointY+18}C${root.x+dx*.14} ${root.jointY-20} ${topic.x} ${topic.y+114} ${topic.x} ${topic.y+33}`}/>;
      })}
      <path className="personal-tree-roots" d={`M${root.x} ${root.y+30}q-32 14-78 18m78-18q32 14 78 18m-78-18v23`}/>
    </g>
    {layout.nodes.map(node=><Branches key={node.assetKey} node={node} children={children.get(node.assetKey)||[]}/>)}
    {connections.map(link=>{const from=byKey.get(link.sourceKey),to=byKey.get(link.targetKey);return from&&to&&<path key={link.id}
      className="forest-connection" d={`M${from.x} ${from.y-32}Q${(from.x+to.x)/2} ${Math.max(20,Math.min(from.y,to.y)-100)} ${to.x} ${to.y-32}`}><title>{link.reason}</title></path>;})}
    {layout.nodes.map(node=><ForestNode key={node.assetKey} node={node} selected={selected} onSelect={onSelect}/>)}
    <g transform={`translate(${root.x},${root.y})`} role="img" aria-label="我的知识树" className="personal-tree-root">
      <title>你的全部话题与探索汇聚于此</title>
      <rect x="-102" y="-32" width="204" height="64" rx="18"/>
      <text textAnchor="middle" y="-2">我的知识树</text>
      <text textAnchor="middle" y="18" className="personal-tree-caption">{layout.branches.length} 个话题分枝 · 无限生长</text>
    </g>
  </>;
}
