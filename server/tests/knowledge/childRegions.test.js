import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeChildRegions, normalizeChildRegionIdentification } from '../../src/services/knowledge/childRegions.js';
import { identifyChildRegion } from '../../src/services/knowledge/childRegionSuggestions.js';
import { personalBook } from '../../../web/src/knowledge/personalBook.js';

test('人工标注保存归一化区域，并且只可关联直接子节点', () => {
  const input = [{ childNodeId: 'child-a', x: 0.12, y: 0.2, w: 0.35, h: 0.4 }];
  assert.deepEqual(normalizeChildRegions(input, ['child-a']), input);
  assert.throws(() => normalizeChildRegions([{ ...input[0], childNodeId: 'grandchild' }], ['child-a']), { status: 400 });
  assert.throws(() => normalizeChildRegions([input[0], input[0]], ['child-a']), { status: 400 });
  assert.throws(() => normalizeChildRegions([{ ...input[0], x: 0.8 }], ['child-a']), { status: 400 });
  assert.throws(() => normalizeChildRegions([{ ...input[0], w: 0 }], ['child-a']), { status: 400 });
  assert.throws(() => normalizeChildRegions({}, ['child-a']), { status: 400 });
  assert.deepEqual(normalizeChildRegions([{ ...input[0], label: '自定义名称' }], ['child-a']), [{ ...input[0], label: '自定义名称' }]);
  assert.throws(() => normalizeChildRegions([{ ...input[0], label: 'x'.repeat(101) }], ['child-a']), { status: 400 });
});

test('阅读器把人工框映射到公共子节点，并保留其跳转资源键', () => {
  const root = { id: 'reader-root', assetKey: 'root-key', globalNodeId: 'global-root', treeId: 'tree', parentKey: null,
    childRegions: [{ childNodeId: 'global-child', x: 0.1, y: 0.2, w: 0.3, h: 0.4 }], asset: { title: '根节点', imageUrl: '/root.png' }, lit: true };
  const child = { id: 'reader-child', assetKey: 'child-key', globalNodeId: 'global-child', treeId: 'tree', parentKey: 'root-key',
    childRegions: [], asset: { title: '下一节点', imageUrl: '/child.png' }, lit: false };
  const page = personalBook({ profile: { id: 'profile' }, nodes: [root, child] }, root);
  assert.deepEqual(page.bookFlat[0].childRegions, [{ childNodeId: 'global-child', x: 0.1, y: 0.2, w: 0.3, h: 0.4, childKey: 'child-key', label: '下一节点' }]);
});

test('阅读器优先展示标注框的自定义名称', () => {
  const root = { id: 'reader-root', assetKey: 'root-key', globalNodeId: 'global-root', treeId: 'tree', parentKey: null,
    childRegions: [{ childNodeId: 'global-child', label: '自定义热点名称', x: 0.1, y: 0.2, w: 0.3, h: 0.4 }], asset: { title: '根节点', imageUrl: '/root.png' }, lit: true };
  const child = { id: 'reader-child', assetKey: 'child-key', globalNodeId: 'global-child', treeId: 'tree', parentKey: 'root-key',
    childRegions: [], asset: { title: '下一节点', imageUrl: '/child.png' }, lit: false };
  const page = personalBook({ profile: { id: 'profile' }, nodes: [root, child] }, root);
  assert.equal(page.bookFlat[0].childRegions[0].label, '自定义热点名称');
  assert.equal(page.bookFlat[0].childRegions[0].childKey, 'child-key');
});

test('手绘框识别结果只映射到直接子节点，低置信度交由人工确认', () => {
  const children = [{ id: 'child-a' }, { id: 'child-b' }];
  assert.deepEqual(normalizeChildRegionIdentification({ childIndex: 1, confidence: 0.86 }, children), { childNodeId: 'child-b', confidence: 0.86 });
  assert.deepEqual(normalizeChildRegionIdentification({ childIndex: 0, confidence: 0.3 }, children), { childNodeId: null, confidence: 0.3 });
  assert.throws(() => normalizeChildRegionIdentification({ childIndex: 2, confidence: 0.9 }, children), { status: 502 });
});

test('手绘框识别会把完整图片和指定裁剪区域交给视觉模型', async () => {
  const originalFetch = global.fetch;
  const previousKey = process.env.GPTIMAGE_API_KEY;
  const previousBase = process.env.GPTIMAGE_BASE_URL;
  process.env.GPTIMAGE_API_KEY = 'test-key';
  process.env.GPTIMAGE_BASE_URL = 'https://vision.test';
  global.fetch = async (url, options) => {
    assert.equal(url, 'https://vision.test/v1/chat/completions');
    assert.equal(options.headers.Authorization, 'Bearer test-key');
    const body = JSON.parse(options.body);
    const images = body.messages[1].content.filter(item => item.type === 'image_url');
    assert.equal(images.length, 2);
    assert(body.messages[1].content.at(-1).text.includes('childIndex'));
    return new Response(JSON.stringify({ choices: [{ message: { content: '{"childIndex":0,"confidence":0.91}' } }] }), { status: 200 });
  };
  try {
    const result = await identifyChildRegion('/knowledge/starter-primary-2-water.svg', { x: 0.1, y: 0.1, w: 0.4, h: 0.4 }, [{ id: 'water', label: '水的旅行' }]);
    assert.deepEqual(result, { childNodeId: 'water', confidence: 0.91 });
  } finally {
    global.fetch = originalFetch;
    if (previousKey === undefined) delete process.env.GPTIMAGE_API_KEY;
    else process.env.GPTIMAGE_API_KEY = previousKey;
    if (previousBase === undefined) delete process.env.GPTIMAGE_BASE_URL;
    else process.env.GPTIMAGE_BASE_URL = previousBase;
  }
});

