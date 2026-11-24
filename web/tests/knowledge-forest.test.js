import test from 'node:test';
import assert from 'node:assert/strict';
import { treeLayout, NODE_WIDTH, ROOT_WIDTH } from '../src/knowledge/forestLayout.js';
import { personalBook } from '../src/knowledge/personalBook.js';

/** 使用独立主题和真实父子字段构建布局输入，不涉及持久化数据。 */
function node(key,parentKey=null,lit=true){return {assetKey:key,parentKey,lit,asset:{title:key}};}

test('一棵个人树容纳多个话题分枝，各分枝按真实父关系排布且不重叠',()=>{
  const nodes=[node('量子力学'),node('长江'),node('黄河')];
  for(let i=0;i<12;i++){
    nodes.push(node('子页'+i,'量子力学'));
    for(let j=0;j<i%4;j++)nodes.push(node(`叶${i}-${j}`,'子页'+i));
  }
  const before=JSON.stringify(nodes),layout=treeLayout(nodes,true);
  assert.equal(layout.nodes.length,nodes.length);
  assert.deepEqual(layout.branches.map(branch=>branch.key),['量子力学','长江','黄河']);
  assert.equal(layout.branches.length,3);assert.equal(layout.root.x,layout.width/2);
  const byKey=new Map(layout.nodes.map(n=>[n.assetKey,n]));
  for(const n of layout.nodes){
    const width=n.depth?NODE_WIDTH:ROOT_WIDTH;
    assert(n.x-width/2>=0&&n.x+width/2<=layout.width);
    assert(n.y>0&&n.y<layout.root.y);
    if(n.layoutParentKey){const p=byKey.get(n.layoutParentKey);assert(n.y<p.y);assert.equal(n.branchKey,p.branchKey);}
    for(const other of layout.nodes)if(n.assetKey!==other.assetKey&&n.y===other.y){
      assert(Math.abs(n.x-other.x)>=(width+(other.depth?NODE_WIDTH:ROOT_WIDTH))/2);
    }
  }
  assert.equal(JSON.stringify(nodes),before);
});

test('整本书名称统一，而独立话题间不虚构阅读顺序或父子关系',()=>{
  const nodes=[node('量子力学'),node('量子叠加','量子力学'),node('长江')];
  const snapshot={profile:{id:'reader-1'},nodes};
  const first=personalBook(snapshot,nodes[0]),other=personalBook(snapshot,nodes[2]);
  assert.equal(first.currentBookTitle,'无限之书');assert.equal(other.currentBookTitle,first.currentBookTitle);
  assert.deepEqual(first.bookFlat.map(item=>item.id),['量子力学','量子叠加']);
  assert.deepEqual(other.bookFlat.map(item=>item.id),['长江']);
  assert.equal(nodes[2].parentKey,null);
});

test('只显示探索前沿，祖先路径点亮不冒充用户已打开祖先页面',()=>{
  const nodes=[node('根',null,false),node('子','根',false),node('孙','子',false),node('曾孙','孙',false)];
  assert.deepEqual(new Set(treeLayout(nodes).nodes.map(n=>n.assetKey)),new Set(['根','子']));
  nodes[2].lit=true;
  const layout=treeLayout(nodes),root=layout.nodes.find(n=>n.assetKey==='根');
  assert.equal(root.lit,false);assert.equal(root.pathLit,true);
  assert.equal(layout.nodes.length,4);
});

test('断链、自环和历史循环仍可访问，深链不会耗尽递归栈',()=>{
  const broken=[node('孤页','不存在'),node('自环','自环'),node('环一','环二'),node('环二','环一')];
  assert.equal(treeLayout(broken,true).nodes.length,broken.length);
  const deep=Array.from({length:1500},(_,i)=>node('n'+i,i?'n'+(i-1):null));
  const layout=treeLayout(deep,true);
  assert.equal(layout.nodes.length,1500);assert.equal(layout.branches.length,1);
  assert.equal(treeLayout([]).branches.length,0);
});
