import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import express from 'express';
import jwt from 'jsonwebtoken';
import sharp from 'sharp';
import prisma from '../../src/config/db.js';
import adminRouter from '../../src/routes/admin/knowledge.js';
import { requireAdmin } from '../../src/routes/admin/auth.js';

const enabled = process.env.KNOWLEDGE_INTEGRATION === 'true';
const suite = enabled ? test : test.skip;
const treeIds = [], assetKeys = [], profileIds = [];
let server, base, token, uploads;
const previousUploadDir = process.env.LOCAL_UPLOAD_DIR;

/** 只在独立的本机 knowledge 数据库运行，文件写入临时目录。 */
before(async () => {
  if (!enabled) return;
  const url = new URL(process.env.DATABASE_URL);
  assert(['127.0.0.1', 'localhost'].includes(url.hostname));
  assert.equal(url.pathname, '/knowledge');
  uploads = await mkdtemp(join(tmpdir(), 'knowledge-edit-'));
  process.env.LOCAL_UPLOAD_DIR = uploads;
  token = jwt.sign({ sub: 'test-editor', type: 'admin', role: 'superadmin' }, process.env.JWT_SECRET || 'flipbook-jwt-secret-2024');
  const app = express();
  app.use(express.json());
  app.use('/api/admin/knowledge', requireAdmin, adminRouter);
  app.use('/api/local-uploads', express.static(uploads));
  app.use((error, _req, res, _next) => res.status(error.status || 500).json({ error: error.message }));
  await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});

/** 仅清理此文件创建的测试记录与图片。 */
after(async () => {
  if (!enabled) return;
  if (server) await new Promise(resolve => server.close(resolve));
  await prisma.knowledgeTree.deleteMany({ where: { id: { in: treeIds } } });
  await prisma.readerProfile.deleteMany({ where: { id: { in: profileIds } } });
  await prisma.knowledgeAsset.deleteMany({ where: { key: { in: assetKeys } } });
  if (uploads) await rm(uploads, { recursive: true, force: true });
  if (previousUploadDir === undefined) delete process.env.LOCAL_UPLOAD_DIR;
  else process.env.LOCAL_UPLOAD_DIR = previousUploadDir;
  await prisma.$disconnect();
});

/** 建立两棵复用同一图文的树，用于验证编辑隔离。 */
async function fixture() {
  const key = randomUUID();
  const asset = await prisma.knowledgeAsset.create({ data: {
    key, identity: {}, action: 'curated', title: '力与运动', domain: '物理', state: 'ready', reviewStatus: 'approved',
    imageUrl: '/knowledge/original.png', explanations: { zh: '原解读', en: 'Original text' }, anchors: ['原问题'], audio: { old: '/knowledge/original.mp3' },
  } });
  assetKeys.push(key);
  const trees = await Promise.all(['A', 'B'].map(title => prisma.knowledgeTree.create({ data: { title: `edit-${key}-${title}` } })));
  treeIds.push(...trees.map(tree => tree.id));
  const nodes = await Promise.all(trees.map(tree => prisma.knowledgeNode.create({ data: { treeId: tree.id, assetKey: key, label: asset.title, domain: asset.domain } })));
  return { asset, trees, nodes };
}

/** 使用真实管理员认证发起 JSON 编辑请求。 */
async function patch(tree, node, body) {
  const response = await fetch(`${base}/api/admin/knowledge/trees/${tree.id}/nodes/${node.id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ expectedAssetKey: node.assetKey, revision: tree.revision, ...body }),
  });
  const data = await response.json();
  if (response.ok && data.node.assetKey !== node.assetKey) assetKeys.push(data.node.assetKey);
  return { status: response.status, data };
}

/** 使用打开弹窗时的资源标识与树版本重置节点图文。 */
async function reset(tree, node, overrides = {}) {
  const response = await fetch(`${base}/api/admin/knowledge/trees/${tree.id}/nodes/${node.id}/reset`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ expectedAssetKey: node.assetKey, revision: tree.revision, ...overrides }),
  });
  const data = await response.json();
  if (response.ok) assetKeys.push(data.node.assetKey);
  return { status: response.status, data };
}

suite('修改图文创建独立待审版本，保留段落、子节点、其他树及已有读者记录', async () => {
  const { asset, trees, nodes } = await fixture();
  const childAsset = await prisma.knowledgeAsset.create({ data: { key: randomUUID(), action: 'curated', identity: {}, title: '子页', domain: '物理' } });
  assetKeys.push(childAsset.key);
  const child = await prisma.knowledgeNode.create({ data: { treeId: trees[0].id, parentId: nodes[0].id, assetKey: childAsset.key, label: '子页', domain: '物理' } });
  const profile = await prisma.readerProfile.create({ data: { ageBand: 'adult' } });
  profileIds.push(profile.id);
  const readerNode = await prisma.readerNode.create({ data: { profileId: profile.id, assetKey: asset.key, globalNodeId: nodes[0].id, treeId: trees[0].id, note: '我的笔记', visits: 2 } });
  const explanation = '力是改变运动状态的原因。\n\n第二段：作用与反作用。';
  const edited = await patch(trees[0], nodes[0], { imageUrl: '/knowledge/replacement.png', explanation, anchors: ['新问题？'] });
  assert.equal(edited.status, 200, JSON.stringify(edited));
  const updated = edited.data.node;
  assert.notEqual(updated.assetKey, asset.key);
  assert.equal(updated.id, nodes[0].id);
  assert.equal(updated.asset.imageUrl, '/knowledge/replacement.png');
  assert.equal(updated.asset.explanations.zh, explanation);
  assert.deepEqual(updated.asset.explanations, { zh: explanation });
  assert.deepEqual(updated.asset.audio, {});
  assert.deepEqual(updated.asset.anchors, ['新问题？']);
  assert.equal(updated.asset.reviewStatus, 'pending');
  assert.equal(updated.asset.identity.replacementFor, asset.key);
  assert.equal((await prisma.knowledgeAsset.findUnique({ where: { key: asset.key } })).imageUrl, asset.imageUrl);
  assert.equal((await prisma.knowledgeNode.findUnique({ where: { id: nodes[1].id } })).assetKey, asset.key);
  assert.equal((await prisma.knowledgeNode.findUnique({ where: { id: child.id } })).parentId, nodes[0].id);
  assert.deepEqual(await prisma.readerNode.findUnique({ where: { id: readerNode.id } }), readerNode);
  assert.equal((await prisma.knowledgeTree.findUnique({ where: { id: trees[0].id } })).revision, trees[0].revision + 1);
  const stale = await patch(trees[0], nodes[0], { explanation: '不能覆盖新版本' });
  assert.equal(stale.status, 409);
});

suite('单独改图或改文字均可保存，已发布内容和正在生成的节点拒绝修改', async () => {
  const { asset, trees, nodes } = await fixture();
  const textOnly = await patch(trees[0], nodes[0], { explanation: '仅修改文字\n保留换行' });
  assert.equal(textOnly.status, 200);
  assert.equal(textOnly.data.node.asset.imageUrl, asset.imageUrl);
  const imageOnly = await patch(trees[1], nodes[1], { imageUrl: '/knowledge/only-image.png' });
  assert.equal(imageOnly.status, 200);
  assert.equal(imageOnly.data.node.asset.explanations.zh, asset.explanations.zh);
  const publish = () => fetch(`${base}/api/admin/knowledge/trees/${trees[0].id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status: 'published', revision: trees[0].revision + 1 }),
  });
  assert.equal((await publish()).status, 400, '修改图文后必须重新审核');
  const approved = await fetch(`${base}/api/admin/knowledge/reviews/${textOnly.data.node.assetKey}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status: 'approved', note: '已人工核对修改后的内容' }),
  });
  assert.equal(approved.status, 200);
  assert.equal((await publish()).status, 200);
  assert.equal((await patch(trees[0], nodes[0], { explanation: '禁止修改' })).status, 409);
  await prisma.knowledgeAsset.update({ where: { key: imageOnly.data.node.assetKey }, data: { leaseUntil: new Date(Date.now() + 60000) } });
  assert.equal((await patch({ ...trees[1], revision: trees[1].revision + 1 }, imageOnly.data.node, { explanation: '生成中禁止修改' })).status, 409);
});

suite('拒绝无效图文输入；未更改的图文不会重复复制资源', async () => {
  const { asset, trees, nodes } = await fixture();
  for (const body of [{ imageUrl: 'javascript:alert(1)' }, { explanation: '  ' }, { explanation: 'x'.repeat(16001) }, { anchors: ['x'.repeat(121)] }]) {
    assert.equal((await patch(trees[0], nodes[0], body)).status, 400);
  }
  const unchanged = await patch(trees[0], nodes[0], { imageUrl: asset.imageUrl, explanation: asset.explanations.zh, anchors: asset.anchors });
  assert.equal(unchanged.status, 200);
  assert.equal(unchanged.data.node.assetKey, asset.key);
});

suite('重置生成图文会清空当前节点并保留树结构、共享原资源和其他节点', async () => {
  const { asset, trees, nodes } = await fixture();
  const childAsset = await prisma.knowledgeAsset.create({ data: { key: randomUUID(), action: 'curated', identity: {}, title: '子页', domain: '物理' } });
  assetKeys.push(childAsset.key);
  const child = await prisma.knowledgeNode.create({ data: { treeId: trees[0].id, parentId: nodes[0].id, assetKey: childAsset.key, label: '子页', domain: '物理' } });

  const result = await reset(trees[0], nodes[0]);
  assert.equal(result.status, 200, JSON.stringify(result));
  const { node: resetNode } = result.data;
  assert.equal(resetNode.id, nodes[0].id);
  assert.notEqual(resetNode.assetKey, asset.key);
  assert.equal(resetNode.label, nodes[0].label);
  assert.equal(resetNode.asset.state, 'pending');
  assert.equal(resetNode.asset.reviewStatus, 'pending');
  assert.equal(resetNode.asset.imageUrl, '');
  assert.deepEqual(resetNode.asset.explanations, {});
  assert.deepEqual(resetNode.asset.anchors, []);
  assert.equal(resetNode.asset.identity.replacementFor, asset.key);
  assert.equal((await prisma.knowledgeNode.findUnique({ where: { id: child.id } })).parentId, nodes[0].id);
  assert.equal((await prisma.knowledgeNode.findUnique({ where: { id: nodes[1].id } })).assetKey, asset.key);
  assert.deepEqual(await prisma.knowledgeAsset.findUnique({ where: { key: asset.key } }), asset);
  assert.equal((await prisma.knowledgeTree.findUnique({ where: { id: trees[0].id } })).revision, trees[0].revision + 1);
  assert.equal((await reset(trees[0], nodes[0])).status, 409, '过期编辑器不能重复重置新版本');
});

suite('重置拒绝未登录、已发布、过期版本和正在生成的节点', async () => {
  const { trees, nodes } = await fixture();
  assert.equal((await fetch(`${base}/api/admin/knowledge/trees/${trees[0].id}/nodes/${nodes[0].id}/reset`, { method: 'POST' })).status, 401);
  assert.equal((await reset(trees[0], nodes[0], { revision: trees[0].revision + 1 })).status, 409);
  await prisma.knowledgeTree.update({ where: { id: trees[0].id }, data: { status: 'published' } });
  assert.equal((await reset(trees[0], nodes[0])).status, 409);
  await prisma.knowledgeTree.update({ where: { id: trees[0].id }, data: { status: 'draft' } });
  await prisma.knowledgeAsset.update({ where: { key: nodes[0].assetKey }, data: { leaseUntil: new Date(Date.now() + 60000) } });
  assert.equal((await reset(trees[0], nodes[0])).status, 409);
});

suite('管理员上传真实图片可预览并用于替换，伪装图片及未登录上传被拒绝', async () => {
  const { trees, nodes } = await fixture();
  const png = await sharp({ create: { width: 64, height: 32, channels: 3, background: '#228866' } }).png().toBuffer();
  const body = new FormData();
  body.append('file', new Blob([png], { type: 'image/png' }), 'replacement.png');
  const response = await fetch(`${base}/api/admin/knowledge/images`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body });
  assert.equal(response.status, 201);
  const { imageUrl } = await response.json();
  const downloaded = await fetch(`${base}${imageUrl}`);
  assert.equal(downloaded.status, 200);
  assert.equal((await sharp(Buffer.from(await downloaded.arrayBuffer())).metadata()).width, 64);
  assert((await readFile(join(uploads, basename(imageUrl)))).length > 0);
  assert.equal((await patch(trees[0], nodes[0], { imageUrl })).status, 200);
  const invalid = new FormData();
  invalid.append('file', new Blob(['not a png'], { type: 'image/png' }), 'fake.png');
  assert.equal((await fetch(`${base}/api/admin/knowledge/images`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: invalid })).status, 400);
  assert.equal((await fetch(`${base}/api/admin/knowledge/images`, { method: 'POST' })).status, 401);
});
