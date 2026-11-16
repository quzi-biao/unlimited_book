import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { resolveImageSize, DEFAULT_IMAGE_SIZE, LEGACY_IMAGE_SIZE, withImageSizePrompt } from '../src/services/ai/imageSize.js';
import { validateImageOutput } from '../src/services/ai/imageOutput.js';
import { buildPromptHash } from '../src/services/hash.js';
import { createPageWithImageCache } from '../src/services/pageImageCache.js';

test('旧客户端也请求新 16:9 画幅，历史 3:2 缓存键明确隔离', () => {
  assert.equal(resolveImageSize(undefined), DEFAULT_IMAGE_SIZE);
  assert.equal(resolveImageSize(null), DEFAULT_IMAGE_SIZE);
  assert.equal(resolveImageSize({ width: 1536, height: 1024 }), DEFAULT_IMAGE_SIZE);
  assert.equal(DEFAULT_IMAGE_SIZE, '1536x864');
  assert.equal(buildPromptHash('森林', '选区', LEGACY_IMAGE_SIZE), createHash('sha256').update('森林选区').digest('hex'));
  assert.notEqual(buildPromptHash('森林', '选区'), buildPromptHash('森林', '选区', LEGACY_IMAGE_SIZE));
});

test('手机横屏、竖屏、平板和窗口调整一律使用 1536x864', () => {
  for (const [width, height] of [[2460,1080], [844,390], [667,375], [1920,1080], [1280,800], [1024,768], [390,844], [1000,1000]]) {
    assert.equal(resolveImageSize({ width, height }), DEFAULT_IMAGE_SIZE);
    assert.equal(resolveImageSize({ width: width * 2, height: height * 2 }), DEFAULT_IMAGE_SIZE);
  }
});

test('兼容已发布客户端，忽略无效或多余的 viewport，不影响固定尺寸生成', () => {
  for (const viewport of [undefined, null, {}, [], 'ignored', { width: 0, height: 900 }, { width: '900', height: 900 }, { width: Infinity, height: 900 }, { width: 32769, height: 900 }]) {
    assert.equal(resolveImageSize(viewport), DEFAULT_IMAGE_SIZE);
  }
});

test('窗口尺寸不拆分缓存，16:9 选区缓存不混入旧画幅缓存', () => {
  const size = resolveImageSize({ width: 844, height: 390 });
  assert.equal(buildPromptHash('森林'), buildPromptHash('森林', '', size));
  assert.notEqual(buildPromptHash('森林', 'a', size), buildPromptHash('森林', 'b', size));
  assert.notEqual(buildPromptHash('森林', 'a', size), buildPromptHash('森林', 'a', '1920x816'));
  assert.notEqual(buildPromptHash('森林', 'a', size), createHash('sha256')
    .update(JSON.stringify(['image-size-v1', size, '森林', 'a'])).digest('hex'));
});

test('主图与深入探索提示词统一 16:9，不保留旧 3:2 或 16:10 指令', () => {
  const prompt = withImageSizePrompt('Full-bleed 3:2 landscape. 16:10. Canvas 1536x1024.', DEFAULT_IMAGE_SIZE);
  assert(!/3:2|16:10|1536x1024/.test(prompt));
  assert.match(prompt, /16:9/);
  assert.match(prompt, /1536x864/);
});

test('默认 16:9 也严格校验，旧 3:2 不得作为成功图返回', async () => {
  const old = await sharp({ create: { width: 1536, height: 1024, channels: 3, background: '#123456' } }).png().toBuffer();
  await assert.rejects(validateImageOutput(`data:image/png;base64,${old.toString('base64')}`, DEFAULT_IMAGE_SIZE), { code: 'IMAGE_SIZE_MISMATCH' });
  const rounded = await sharp({ create: { width: 1672, height: 941, channels: 3, background: '#123456' } }).png().toBuffer();
  const accepted = await validateImageOutput(`data:image/jpeg;base64,${rounded.toString('base64')}`, DEFAULT_IMAGE_SIZE);
  assert(accepted.startsWith('data:image/png;base64,'));
  assert.equal(accepted.slice(accepted.indexOf(',')+1), rounded.toString('base64'));
});

test('并发命中唯一缓存键时仍创建当前书的页面', async () => {
  const attempts = [];
  const prisma = { page: { async create({ data }) {
    attempts.push(data);
    if (attempts.length === 1) throw Object.assign(new Error('duplicate'), { code: 'P2002', meta: { target: ['promptHash'] } });
    return { id: 'new-page', ...data };
  } } };
  const page = await createPageWithImageCache(prisma, { bookId: 'book', parentPageId: 'parent', promptHash: 'hash', imageUrl: 'image' });
  assert.equal(page.bookId, 'book'); assert.equal(page.parentPageId, 'parent');
  assert.equal(page.promptHash, null); assert.equal(attempts.length, 2);
  await assert.rejects(createPageWithImageCache({ page: { create: async () => { throw Object.assign(new Error('other'), { code: 'P2002', meta: { target: ['id'] } }); } } }, { promptHash: 'hash' }));
});

test('供应商忽略尺寸时拒绝缓存；小幅舍入允许且 MIME 正确', async () => {
  const png = await sharp({ create: { width: 1922, height: 818, channels: 3, background: '#123456' } }).png().toBuffer();
  const input = `data:image/jpeg;base64,${png.toString('base64')}`;
  const output = await validateImageOutput(input, '1920x816');
  assert(output.startsWith('data:image/png;base64,'));
  await assert.rejects(validateImageOutput(input, '1024x1024'), { code: 'IMAGE_SIZE_MISMATCH' });
});

test('文生图和区域编辑发往供应商的尺寸均固定，已发布客户端也兼容', async () => {
  process.env.GPTIMAGE_API_KEY = 'unit-test-no-network';
  const { generateImageGPT, expandImageGPT } = await import('../src/services/ai/gptimage.js');
  const wide = await sharp({ create: { width: 1920, height: 816, channels: 3, background: '#123456' } }).png().toBuffer();
  const expected = await sharp({ create: { width: 1536, height: 864, channels: 3, background: '#123456' } }).png().toBuffer();
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options) => {
    const body = options.body instanceof FormData ? Object.fromEntries(options.body) : JSON.parse(options.body);
    requests.push({ url, body });
    return { ok: true, json: async () => ({ data: [{ b64_json: (body.size === DEFAULT_IMAGE_SIZE ? expected : wide).toString('base64') }] }) };
  };
  try {
    await generateImageGPT('森林', resolveImageSize({ width: 2460, height: 1080 }));
    await expandImageGPT(`data:image/png;base64,${wide.toString('base64')}`, '深入探索', resolveImageSize({ width: 390, height: 844 }));
    await generateImageGPT('旧客户端');
    assert.equal(requests[0].body.size, DEFAULT_IMAGE_SIZE);
    assert.equal(requests[1].body.size, DEFAULT_IMAGE_SIZE);
    assert.equal(requests[2].body.size, DEFAULT_IMAGE_SIZE);
    assert.equal(requests[0].body.prompt, withImageSizePrompt('森林', DEFAULT_IMAGE_SIZE));
    assert.equal(requests[1].body.prompt, withImageSizePrompt('深入探索', DEFAULT_IMAGE_SIZE));
  } finally { globalThis.fetch = originalFetch; }
});

test('Gemini 备用通道同样要求 16:9，返回图片不再被裁成 16:10', async () => {
  const { generateImage, expandWithKnowledge } = await import('../src/services/ai/gemini.js');
  const png = await sharp({ create: { width: 1600, height: 900, channels: 3, background: '#123456' } }).png().toBuffer();
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (_url, options) => {
    requests.push(JSON.parse(options.body));
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: png.toString('base64') } }] } }] }) };
  };
  try {
    const style = { imageModel: 'gemini', topicExploration: '3:2 ${query}', deepExploration: '16:10 landscape' };
    const root = await generateImage('山川', style, {}, DEFAULT_IMAGE_SIZE);
    const child = await expandWithKnowledge(`data:image/png;base64,${png.toString('base64')}`, { description: '岩层' }, style, {}, DEFAULT_IMAGE_SIZE);
    for (const request of requests) {
      assert.equal(request.generationConfig.imageConfig.aspectRatio, '16:9');
      const text = request.contents[0].parts.filter(p => p.text).map(p => p.text).join(' ');
      assert.match(text, /16:9/); assert(!/3:2|16:10/.test(text));
    }
    for (const result of [root, child]) assert.equal(result.slice(result.indexOf(',') + 1), png.toString('base64'));
  } finally { globalThis.fetch = originalFetch; }
});
