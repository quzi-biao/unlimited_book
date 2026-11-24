export const NODE_WIDTH = 176;
export const ROOT_WIDTH = 224;
const SPACING = 196, GAP = 20, LEVEL = 148, PADDING = 28;

/** 按真实父关系整理话题分枝；断链和循环只在显示中容错，不改原数据。 */
function relationships(nodes) {
  const byKey = new Map(nodes.map(node => [node.assetKey,node]));
  const parents = new Map([...byKey.values()].map(node => [node.assetKey,
    node.parentKey !== node.assetKey && byKey.has(node.parentKey) ? node.parentKey : null]));
  const checked = new Set();
  for (const key of byKey.keys()) {
    const path = new Set(); let cursor = key;
    while (cursor && !checked.has(cursor)) {
      if (path.has(cursor)) { parents.set(cursor,null); break; }
      path.add(cursor); cursor = parents.get(cursor);
    }
    for (const item of path) checked.add(item);
  }
  return {byKey,parents};
}

/** 已探索路径和下一层入口可见，未打开的更深区域仍等待用户探索。 */
export function treeLayout(nodes, showAll = false) {
  const {byKey,parents} = relationships(nodes);
  const paths = new Set();
  for (const node of byKey.values()) if (node.lit) {
    let key = node.assetKey;
    while (key && !paths.has(key)) { paths.add(key); key = parents.get(key); }
  }
  const visible = [...byKey.values()].filter(node => {
    const parent = parents.get(node.assetKey);
    return showAll || paths.has(node.assetKey) || !parent || byKey.get(parent)?.lit || !parents.get(parent);
  });
  const keys = new Set(visible.map(node => node.assetKey)), children = new Map();
  for (const node of visible) {
    const parent = keys.has(parents.get(node.assetKey)) ? parents.get(node.assetKey) : null;
    children.set(parent,[...children.get(parent) || [],node]);
  }
  const roots = children.get(null) || [], branches = [], positioned = [], measured = new Map();
  let maxDepth = 0;
  for (const root of roots) {
    const stack = [{node:root,depth:0}], order = [];
    while (stack.length) {
      const item = stack.pop(); order.push(item); maxDepth = Math.max(maxDepth,item.depth);
      for (const child of [...children.get(item.node.assetKey) || []].reverse()) stack.push({node:child,depth:item.depth+1});
    }
    for (const {node} of order.reverse()) {
      const descendants = children.get(node.assetKey) || [];
      measured.set(node.assetKey,Math.max(SPACING,descendants.reduce((sum,child) => sum + measured.get(child.assetKey),0) + Math.max(0,descendants.length-1)*GAP));
    }
  }
  const rootY = Math.max(414,136+maxDepth*LEVEL);
  let left = PADDING;
  for (const root of roots) {
    const width = Math.max(280,measured.get(root.assetKey)+PADDING*2);
    const branch = {key:root.assetKey,left,width,lit:paths.has(root.assetKey)};
    const stack = [{node:root,depth:0,start:left+(width-measured.get(root.assetKey))/2}];
    while (stack.length) {
      const {node,depth,start} = stack.pop(), descendants = children.get(node.assetKey) || [];
      const item = {...node,x:start+measured.get(node.assetKey)/2,y:rootY-depth*LEVEL,
        depth,branchKey:root.assetKey,layoutParentKey:depth?parents.get(node.assetKey):null,
        childCount:descendants.length,pathLit:paths.has(node.assetKey)};
      positioned.push(item); if (!depth) branch.topic = item;
      let next = start; const pending = [];
      for (const child of descendants) {
        pending.push({node:child,depth:depth+1,start:next});
        next += measured.get(child.assetKey)+GAP;
      }
      stack.push(...pending.reverse());
    }
    branches.push(branch); left += width+GAP;
  }
  const width = Math.max(412,left-GAP+PADDING), height = rootY+274;
  // 个人根部只负责整棵树的呈现，不作为知识节点、生成父页或同步记录。
  const root = {x:width/2,y:rootY+214,jointY:rootY+111,lit:paths.size>0};
  return {nodes:positioned,branches,width,height,rootY,root};
}

/** 根据中英文占宽截断节点标题；完整标题保留在可访问名称和悬浮提示中。 */
export function forestLabel(value, limit = 11) {
  let text = '', size = 0;
  for (const char of String(value || '未命名书页')) {
    size += /[\u0000-\u00ff]/.test(char) ? .55 : 1;
    if (size > limit) return text+'…';
    text += char;
  }
  return text;
}
