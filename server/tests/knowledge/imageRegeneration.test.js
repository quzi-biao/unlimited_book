import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';
import jwt from 'jsonwebtoken';
import sharp from 'sharp';
import prisma from '../../src/config/db.js';
import { requireAdmin } from '../../src/routes/admin/auth.js';
import { getDeviceAiConfig } from '../../src/services/ai/deviceConfig.js';
import { withImageSizePrompt } from '../../src/services/ai/imageSize.js';
import { nodeImageScope } from '../../src/services/knowledge/nodeImageScope.js';

const enabled = process.env.KNOWLEDGE_INTEGRATION === 'true';
const suite = enabled ? test : test.skip;
const treeIds = [], assetKeys = [], requests = [];
const realFetch = globalThis.fetch;
const envKeys = ['LOCAL_UPLOAD_DIR', 'GPTIMAGE_API_KEY', 'GPTIMAGE_BASE_URL'];
const previousEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
let server, base, token, uploads, png, providerFailure = false, duringGeneration;

/** 使用隔离的本机数据库与真实路由，图片提供商在进程内模拟，不发出外网请求。 */
before(async () => {
  if (!enabled) return;
  const url = new URL(process.env.DATABASE_URL);
  assert(['127.0.0.1', 'localhost'].includes(url.hostname));
  assert.equal(url.pathname, '/knowledge');
  uploads = await mkdtemp(join(tmpdir(), 'knowledge-regenerate-'));
  process.env.LOCAL_UPLOAD_DIR = uploads;
  process.env.GPTIMAGE_API_KEY = 'local-test-key';
  process.env.GPTIMAGE_BASE_URL = 'https://knowledge-image.test';
  const { default: adminRouter } = await import('../../src/routes/admin/knowledge.js');
  png = await sharp({ create: { width: 1536, height: 864, channels: 3, background: '#113366' } }).png().toBuffer();
  token = jwt.sign({ sub: 'test-image-editor', type: 'admin', role: 'superadmin' }, process.env.JWT_SECRET || 'flipbook-jwt-secret-2024');
  const app = express();
  app.use(express.json());
  app.use('/api/admin/knowledge', requireAdmin, adminRouter);
  app.use('/api/local-uploads', express.static(uploads));
  app.use((error, _req, res, _next) => res.status(error.status || 500).json({ error: error.message }));
  await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
  globalThis.fetch = async (url, options) => {
    if (String(url).startsWith(base)) return realFetch(url, options);
    const path = new URL(url).pathname;
    if (path.endsWith('/chat/completions')) {
      const body = JSON.parse(options.body);
      const review = body.messages[0].content.includes('独立审核者');
      return Response.json({ choices: [{ message: { content: JSON.stringify(review
        ? { textSafe: true, imageSafe: true, factConsistent: true, styleConsistent: true, reason: '' }
        : { safe: true, title: '力与运动', domain: '物理', core: '运动变化与力有关。', explanation: '这是本节点的解读。', anchors: ['力如何改变运动？', '如何测量加速度？'] }) } }] });
    }
    assert.equal(path, '/v1/images/generations', '不得请求其他外部服务');
    requests.push(JSON.parse(options.body));
    if (duringGeneration) await duringGeneration();
    if (providerFailure) return Response.json({ error: { message: '测试生图失败，可重试' } }, { status: 502 });
    return Response.json({ data: [{ b64_json: png.toString('base64') }] });
  };
});

/** 仅删除此测试创建的数据和临时图片。 */
after(async () => {
  if (!enabled) return;
  globalThis.fetch = realFetch;
  if (server) await new Promise(resolve => server.close(resolve));
  await prisma.knowledgeTree.deleteMany({ where: { id: { in: treeIds } } });
  await prisma.knowledgeAsset.deleteMany({ where: { key: { in: assetKeys } } });
  if (uploads) await rm(uploads, { recursive: true, force: true });
  for (const key of envKeys) {
    if (previousEnv[key] === undefined) delete process.env[key];
    else process.env[key] = previousEnv[key];
  }
  await prisma.$disconnect();
});

/** 创建含已有图文或待生成内容的草稿节点。 */
async function fixture({ state = 'ready' } = {}) {
  const key = randomUUID();
  const asset = await prisma.knowledgeAsset.create({ data: {
    key, identity: {}, action: 'curated', title: '力与运动', domain: '物理', state: 'ready', reviewStatus: 'approved',
    imageUrl: state === 'ready' ? '/knowledge/original.png' : '',
    explanations: state === 'ready' ? { zh: '原解读\n\n第二段' } : {}, anchors: ['原问题？'], audio: { zh: '/knowledge/original.mp3' }, state,
  } });
  assetKeys.push(key);
  const tree = await prisma.knowledgeTree.create({ data: { title: `regenerate-${key}` } });
  treeIds.push(tree.id);
  const node = await prisma.knowledgeNode.create({ data: { treeId: tree.id, assetKey: key, label: asset.title, domain: asset.domain } });
  return { tree, node, asset };
}

/** 发起编辑器使用的预览请求。 */
async function regenerate(tree, node, overrides = {}, auth = token) {
  const response = await fetch(`${base}/api/admin/knowledge/images/regenerate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
    body: JSON.stringify({ treeId: tree.id, nodeId: node.id, revision: tree.revision, expectedAssetKey: node.assetKey, ...overrides }),
  });
  return { status: response.status, data: await response.json() };
}

/** 调用后台已有图文生成流程，覆盖初次生图场景。 */
async function generate(tree, node) {
  const response = await fetch(`${base}/api/admin/knowledge/trees/${tree.id}/nodes/${node.id}/generate`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}` },
  });
  return { status: response.status, data: await response.json() };
}

/** 在测试树中按序添加含可审核资源的节点。 */
async function addChild(tree, parentId, label, order) {
  const key = randomUUID();
  await prisma.knowledgeAsset.create({ data: {
    key, identity: {}, action: 'curated', title: label, domain: '物理', state: 'ready', reviewStatus: 'approved',
    imageUrl: '/knowledge/child.png', explanations: { zh: `${label}解读` }, anchors: [],
  } });
  assetKeys.push(key);
  return prisma.knowledgeNode.create({ data: { treeId: tree.id, parentId, assetKey: key, label, domain: '物理', order } });
}

/** 确认预览、失败和取消均不影响原有图文、审核状态及树版本。 */
async function assertUnchanged({ tree, node, asset }) {
  assert.deepEqual(await prisma.knowledgeTree.findUnique({ where: { id: tree.id } }), tree);
  assert.deepEqual(await prisma.knowledgeNode.findUnique({ where: { id: node.id } }), node);
  assert.deepEqual(await prisma.knowledgeAsset.findUnique({ where: { key: asset.key } }), asset);
}

suite('根节点与子节点使用原模型及模板生成新图，仅关联直接子节点', async () => {
  const data = await fixture();
  const { tree, node } = data;
  const { promptStyle } = await getDeviceAiConfig(undefined, prisma);
  const response = await regenerate(tree, node);
  assert.equal(response.status, 201, JSON.stringify(response));
  assert.notEqual(response.data.imageUrl, data.asset.imageUrl);
  assert.deepEqual(Object.keys(response.data), ['imageUrl']);
  const preview = await fetch(base + response.data.imageUrl);
  assert.equal(preview.status, 200);
  assert.equal((await sharp(Buffer.from(await preview.arrayBuffer())).metadata()).width, 1536);
  assert.equal(requests.at(-1).model, 'gpt-image-2');
  const expectedPrompt = (query, context = '') => {
    const hasContextSlot = promptStyle.topicExploration.includes('${children}');
    let template = promptStyle.topicExploration.replaceAll('${query}', query).replaceAll('${children}', hasContextSlot && context ? `\n\n${context}\n\n` : '');
    if (!hasContextSlot && context) template += `\n\n${context}\n\n`;
    return withImageSizePrompt(template + '\n\n' + promptStyle.unifiedStyle, '1536x864');
  };
  assert.equal(requests.at(-1).prompt, expectedPrompt(node.label));
  await assertUnchanged(data);
  const child = await addChild(tree, node.id, '牛顿第二定律', 1);
  const grandchild = await addChild(tree, child.id, '作用力与反作用力', 0);
  assert.equal((await regenerate(tree, child)).status, 201);
  const childScope = nodeImageScope(child, [node, child, grandchild], node.label);
  assert.equal(requests.at(-1).prompt, expectedPrompt(childScope.query, childScope.context));
  assert.match(childScope.context, /- 作用力与反作用力/);
  assert.doesNotMatch(childScope.context, /牛顿第二定律|力与运动/);
  await assertUnchanged(data);
});

suite('第一次生成父节点图片时只纳入直接子节点，解读仍以当前节点为中心', async () => {
  const data = await fixture({ state: 'pending' });
  const first = await addChild(data.tree, data.node.id, '运动学', 1);
  const grandchild = await addChild(data.tree, first.id, '速度与加速度', 0);
  const second = await addChild(data.tree, data.node.id, '牛顿运动定律', 2);
  const { promptStyle } = await getDeviceAiConfig(undefined, prisma);
  const response = await generate(data.tree, data.node);
  assert.equal(response.status, 200, JSON.stringify(response));
  assert.equal(response.data.asset.title, '力与运动');
  assert.match(response.data.asset.imageUrl, /^\/api\/local-uploads\//);
  assert.equal(response.data.asset.explanations.zh, '运动变化与力有关。\n\n这是本节点的解读。');
  const scope = nodeImageScope(data.node, [data.node, first, grandchild, second]);
  assert.match(scope.context, /- 运动学/);
  assert.match(scope.context, /- 牛顿运动定律/);
  assert.doesNotMatch(scope.context, /速度与加速度/);
  assert.equal(requests.at(-1).model, 'gpt-image-2');
  const hasContextSlot = promptStyle.topicExploration.includes('${children}');
  let template = promptStyle.topicExploration.replaceAll('${query}', scope.query).replaceAll('${children}', hasContextSlot ? `\n\n${scope.context}\n\n` : '');
  if (!hasContextSlot) template += `\n\n${scope.context}\n\n`;
  assert.equal(requests.at(-1).prompt, withImageSizePrompt(template + '\n\n' + promptStyle.unifiedStyle, '1536x864'));
  assert.equal((await prisma.knowledgeTree.findUnique({ where: { id: data.tree.id } })).revision, data.tree.revision);
});

suite('生图失败保留原图文并允许重试', async () => {
  const data = await fixture();
  providerFailure = true;
  try {
    const failed = await regenerate(data.tree, data.node);
    assert.equal(failed.status, 500);
    assert.match(failed.data.error, /测试生图失败/);
    await assertUnchanged(data);
  } finally { providerFailure = false; }
  assert.equal((await regenerate(data.tree, data.node)).status, 201);
  await assertUnchanged(data);
});

suite('未登录、非超级管理员、无效节点、过期快照、已发布及正在生成时不调用模型', async () => {
  const { tree, node, asset } = await fixture();
  const count = requests.length;
  assert.equal((await regenerate(tree, node, {}, null)).status, 401);
  const limitedToken = jwt.sign({ sub: 'limited-admin', type: 'admin', role: 'admin' }, process.env.JWT_SECRET || 'flipbook-jwt-secret-2024');
  assert.equal((await regenerate(tree, node, {}, limitedToken)).status, 403);
  assert.equal((await regenerate(tree, node, { nodeId: '' })).status, 400);
  assert.equal((await regenerate(tree, node, { nodeId: 'missing' })).status, 404);
  assert.equal((await regenerate(tree, node, { treeId: 'another-tree' })).status, 404);
  assert.equal((await regenerate(tree, node, { revision: tree.revision + 1 })).status, 409);
  assert.equal((await regenerate(tree, node, { expectedAssetKey: 'old' })).status, 409);
  await prisma.knowledgeTree.update({ where: { id: tree.id }, data: { status: 'published' } });
  assert.equal((await regenerate(tree, node)).status, 409);
  await prisma.knowledgeTree.update({ where: { id: tree.id }, data: { status: 'draft' } });
  await prisma.knowledgeAsset.update({ where: { key: asset.key }, data: { leaseUntil: new Date(Date.now() + 60000) } });
  assert.equal((await regenerate(tree, node)).status, 409);
  assert.equal(requests.length, count);
});

suite('生成过程中草稿版本改变时拒绝过期图片，保留节点图文', async () => {
  const { tree, node, asset } = await fixture();
  duringGeneration = () => prisma.knowledgeTree.update({ where: { id: tree.id }, data: { revision: { increment: 1 } } });
  try {
    const response = await regenerate(tree, node);
    assert.equal(response.status, 409);
    assert.match(response.data.error, /节点内容已变更/);
    assert.deepEqual(await prisma.knowledgeAsset.findUnique({ where: { key: asset.key } }), asset);
    assert.deepEqual(await prisma.knowledgeNode.findUnique({ where: { id: node.id } }), node);
  } finally { duringGeneration = undefined; }
});
