import { treeLayout } from './forestLayout.js';

/** 同一读者共享书名与树根，翻页仍限于当前真实相连的话题分枝。 */
export function personalBook(snapshot,currentNode) {
  const byKey=new Map(snapshot.nodes.map(node=>[node.assetKey,node]));
  const globalById=new Map(snapshot.nodes.filter(node=>node.globalNodeId).map(node=>[node.globalNodeId,node]));
  const layout=treeLayout(snapshot.nodes,true);
  const active=layout.nodes.find(node=>node.assetKey===currentNode?.assetKey);
  const seen=new Set();let root=currentNode;
  while(byKey.has(root?.parentKey)&&!seen.has(root.parentKey)){
    seen.add(root.parentKey);root=byKey.get(root.parentKey);
  }
  const rootKey=active?.branchKey || root?.assetKey;
  return {
    currentBookId:rootKey || `personal:${snapshot.profile.id}`,
    currentBookTitle:'无限之书',
    bookFlat:layout.nodes.filter(node=>node.branchKey===rootKey)
      .map(node=>{
        const source=byKey.get(node.assetKey);
        const childRegions=(source?.childRegions||[]).map(region=>{
          const child=globalById.get(region.childNodeId);
          return child ? {...region,childKey:child.assetKey,label:region.label||child.asset.title} : null;
        }).filter(Boolean);
        return {id:node.assetKey,title:node.asset.title,imageUrl:node.asset.imageUrl,childRegions};
      }),
  };
}
