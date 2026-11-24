import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { originalPromptStyle as style } from '../../src/services/ai/originalPromptStyle.js';
import { getDeviceAiConfig, imageStyleSignature } from '../../src/services/ai/deviceConfig.js';
import { contentIdentity } from '../../src/services/knowledge/policy.js';
import { nodeImageScope } from '../../src/services/knowledge/nodeImageScope.js';
import { withImageSizePrompt } from '../../src/services/ai/imageSize.js';

test('备份保留原版图片提示词；新版仅增加可选直接子节点要求，设备选择优先', async () => {
  const hashes = { unifiedStyle:'340b9c7df26edba4154b4b5677c29b17', topicExploration:'14931d20b0eb9fbf033526733340afa9',
    deepExploration:'c7b437e8c1e479318663de2dc17f033a', regionExploration:'adecf43c1e6d994b2a349561b4dc0a32' };
  const promptBackup = JSON.parse(await readFile(new URL('../../../docs/prompt-backups/current-topic-image-prompt-20261124.json', import.meta.url), 'utf8'));
  const currentPromptBackup = JSON.parse(await readFile(new URL('../../../docs/prompt-backups/current-topic-image-prompt-with-subtree-20261124.json', import.meta.url), 'utf8'));
  for (const [key,hash] of Object.entries(hashes)) {
    const value = key === 'topicExploration' ? promptBackup[key] : style[key];
    assert.equal(createHash('md5').update(value).digest('hex'),hash);
  }
  assert.equal(promptBackup.unifiedStyle, style.unifiedStyle);
  assert(style.topicExploration.includes('${children}'));
  assert.equal(currentPromptBackup.topicExploration, style.topicExploration);
  let selected;
  const db = { device:{findUnique:async({where})=>{assert.equal(where.id,'authenticated-device');return {promptStyle:selected};}},
    promptStyle:{findUnique:async()=>null},globalConfig:{findMany:async()=>[]} };
  assert.deepEqual((await getDeviceAiConfig(undefined,db)).promptStyle,style);
  selected={...style,unifiedStyle:'设备已经选择的风格'};
  assert.deepEqual((await getDeviceAiConfig('authenticated-device',db)).promptStyle,selected);
});

test('实际提示词、模型或路径更改会隔离缓存；相同内容跨设备仍可复用', () => {
  const query={query:'长江',action:'text',style:imageStyleSignature(style)};
  const key=contentIdentity(query).key;
  assert.equal(key,contentIdentity({...query,style:imageStyleSignature({...style,id:'another-device-style'})}).key);
  for(const field of ['topicExploration','regionExploration','deepExploration','unifiedStyle','imageModel']) {
    assert.notEqual(key,contentIdentity({...query,style:imageStyleSignature({...style,[field]:style[field]+' changed'})}).key);
  }
  assert.notEqual(key,contentIdentity({...query,style:'book'}).key);
  assert.notEqual(key,contentIdentity({...query,parentKey:'quantum'}).key);
});

test('知识树真实图片请求复用原模板与模型；独立搜索不传正文 JSON，框选沿用原图生图提示词', async () => {
  process.env.GPTIMAGE_API_KEY='local-test-key';
  const {assemble,produce}=await import('../../src/services/knowledge/engine.js');
  const data=(await sharp({create:{width:1536,height:864,channels:3,background:'#002244'}}).png().toBuffer()).toString('base64');
  const imageRequests=[],textRequests=[];
  const verdict={textSafe:true,imageSafe:true,factConsistent:true,styleConsistent:true};
  const content={safe:true,title:'长江',domain:'地理',core:'长江流向东海',explanation:'长江是一条河流。',anchors:['从哪里来？','流到哪里？']};
  const realFetch=globalThis.fetch;
  globalThis.fetch=async(url,options)=>{
    const path=new URL(url).pathname;
    if(path.endsWith('/images/generations') || path.endsWith('/images/edits')) {
      const body=options.body instanceof FormData ? Object.fromEntries(options.body.entries()) : JSON.parse(options.body);
      imageRequests.push({path,body});return Response.json({data:[{b64_json:data}]});
    }
    assert(path.endsWith('/chat/completions'));
    const body=JSON.parse(options.body);textRequests.push(body);
    const result=body.messages[0].role==='user' ? {type:'object',description:'river'}
      : body.messages[0].content.includes('独立审核者') ? verdict : content;
    return Response.json({choices:[{message:{content:JSON.stringify(result)}}]});
  };
  try {
    const profile={ageBand:'adult',preferences:{style:'watercolor'}};
    const aiConfig={promptStyle:style,configMap:{}};
    const generate=async(parent,crop,imageContext)=>produce({profile,parent,crop,aiConfig,imageContext,
      assembly:assemble({profile,parent,query:'长江',action:crop?'crop':'text'})});
    await generate();
    assert.equal(imageRequests[0].path,'/v1/images/generations');
    assert.equal(imageRequests[0].body.model,'gpt-image-2');
    assert.equal(imageRequests[0].body.prompt,withImageSizePrompt(style.topicExploration.replaceAll('${query}','长江').replaceAll('${children}','')+'\n\n'+style.unifiedStyle,'1536x864'));
    assert(!imageRequests[0].body.prompt.includes('anchors'));
    const parent={title:'中国河流',key:'river',language:'zh',explanations:{zh:'从中国的河流开始探索'},imageUrl:'https://unused.example.test'};
    await generate(parent);
    assert.equal(imageRequests[1].path,'/v1/images/generations');
    assert(imageRequests[1].body.prompt.includes('中国河流：长江'));
    await generate(parent,'data:image/png;base64,'+data);
    const cropped=imageRequests[2];
    assert.equal(cropped.path,'/v1/images/edits');assert.equal(cropped.body.model,'gpt-image-2');
    assert(cropped.body.prompt.includes(style.unifiedStyle));assert(cropped.body.prompt.includes('THREE visual layers'));
    assert(cropped.body.prompt.includes('The selected region contains: "river"'));
    assert(textRequests.some(r=>r.messages[0].content?.some?.(part=>part.text===style.regionExploration)));
    const root={id:'root',parentId:null,label:'River systems',order:0};
    const child={id:'tributary',parentId:'root',label:'Tributaries',order:0};
    const grandchild={id:'examples',parentId:'tributary',label:'Examples',order:0};
    const context=nodeImageScope(root,[root,child,grandchild]).context;
    assert.match(context,/- Tributaries/);
    assert.doesNotMatch(context,/Examples/);
    await generate(undefined,undefined,context);
    assert.equal(imageRequests[3].body.prompt,withImageSizePrompt(style.topicExploration.replaceAll('${query}','长江').replaceAll('${children}',`\n\n${context}\n\n`)+'\n\n'+style.unifiedStyle,'1536x864'));
    const review=JSON.parse(textRequests.at(-1).messages[1].content[0].text);
    assert.equal(review.imageContext,context);
    assert.match(textRequests.at(-1).messages[0].content,/逐项核对图片是否用可辨认的独立视觉内容表现全部节点/);
    assert.match(textRequests.at(-1).messages[0].content,/不要要求图片里出现框、面板或文字标签/);
    assert.match(textRequests.at(-1).messages[0].content,/互动框会由界面另行叠加/);
    assert(imageRequests.every(r=>!r.body.prompt.includes('绘本')));
  } finally {globalThis.fetch=realFetch;}
});
