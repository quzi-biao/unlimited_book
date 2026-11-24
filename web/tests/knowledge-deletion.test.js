import test from 'node:test';
import assert from 'node:assert/strict';
import { pruneDeleted, pruneJobs } from '../src/knowledge/deletions.js';

test('删除快照同步到本机：清除旧节点、笔记事件、连接和核查，保留子枝',()=>{
 const data={deletedKeys:['middle'],nodes:[{id:'1',assetKey:'root',parentKey:null},{id:'2',assetKey:'middle',parentKey:'root',parentId:'1'},
   {id:'3',assetKey:'leaf',parentKey:'middle',parentId:'2',note:'留下',lit:true}],
   events:[{id:'old',nodeId:'2',type:'note'},{id:'keep',nodeId:'3',type:'note'},{id:'link',nodeId:'3',type:'connect',payload:{targetId:'middle'}}],
   corrections:[{id:'c',assetKey:'middle'}],connections:[{sourceKey:'root',targetKey:'middle'},{sourceKey:'root',targetKey:'leaf'}]};
 const next=pruneDeleted(data);
 assert.deepEqual(next.nodes.map(n=>n.assetKey),['root','leaf']);
 assert.deepEqual(next.nodes[1],{...data.nodes[2],parentKey:'root',parentId:'1'});
 assert.deepEqual(next.events.map(e=>e.id),['keep']);assert.deepEqual(next.corrections,[]);
 assert.deepEqual(next.connections,[{sourceKey:'root',targetKey:'leaf'}]);
 assert.equal(data.nodes.length,3);
});

test('整枝删除会清理完成结果、待重试任务；其他页面任务继续保留',()=>{
 const jobs=[{id:'done',assetKey:'middle',input:{}},{id:'pending',input:{parentKey:'leaf'}},{id:'keep',input:{query:'另一个话题'}}];
 assert.deepEqual(pruneJobs(jobs,['middle','leaf']),[jobs[2]]);
});
