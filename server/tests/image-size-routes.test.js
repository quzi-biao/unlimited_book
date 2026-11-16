import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import * as imageSize from '../src/services/ai/imageSize.js';
import * as hash from '../src/services/hash.js';
import * as pageCache from '../src/services/pageImageCache.js';
import * as topicBooks from '../src/services/topicBooks.js';
import { sharedTopicImagesEnabled } from '../src/services/topicImagePolicy.js';

/** 构建无网络、无真实数据库的路由测试环境。@returns {Promise<object>} */
async function setupRoutes({ sharedImages = true } = {}) {
  const handlers = new Map();
  const pages = [];
  const books = [];
  const generations = [];
  const expansions = [];
  const pointCalls = [];
  const titleCalls = [];
  let generationFailure = null;
  let cacheReads = 0;
  const router = { use() {}, post(path, handler) { handlers.set(path, handler); },
    get(path, handler) { handlers.set(`GET ${path}`, handler); }, patch() {}, delete() {} };
  const prisma = {
    topic: { findMany: async () => [{ name: '森林' }] },
    device: { findUnique: async () => null },
    promptStyle: { findFirst: async () => null },
    globalConfig: { findMany: async () => [] },
    topicCache: {
      findUnique: async ({ where }) => { cacheReads++; return where.topicName === '森林' ? { id: 'legacy-topic', imageUrl: 'legacy-image', hitCount: 0 } : null; },
      update: async () => ({}),
    },
    $queryRaw: async () => [],
    $transaction: async action => action(prisma),
    book: {
      findFirst: async ({ where }) => books.find(book => book.id === where.id) || { id: where.id },
      findMany: async ({ where }) => books.filter(book => Object.entries(where).every(([key,value]) => book[key] === value))
        .map(book => ({ ...book, _count: { pages: pages.filter(page => page.bookId === book.id).length } }))
        .sort((a,b) => b._count.pages-a._count.pages || a.id.localeCompare(b.id)),
      create: async ({ data }) => { const book={ id: 'book-'+books.length, ...data }; books.push(book); return book; },
      update: async ({ where, data }) => Object.assign(books.find(book => book.id===where.id),data),
    },
    page: {
      findFirst: async ({ where }) => pages.find(page => page.bookId === where.bookId),
      findUnique: async ({ where }) => pages.find(page => page.promptHash === where.promptHash),
      create: async ({ data }) => { const page = { id: `page-${pages.length}`, ...data }; pages.push(page); return page; },
      update: async ({ where, data }) => Object.assign(pages.find(page => page.id===where.id), data),
    },
  };
  const stubs = {
    express: { Router: () => router },
    sharp: { default: () => { throw new Error('Unexpected image operation'); } },
    '../middleware/auth.js': { requireAuth() {} },
    '../services/ai/gemini.js': {
      generateImage: async (...args) => { generations.push(args); if (generationFailure) { const error = generationFailure; generationFailure = null; throw error; } return `generated-${args[3]}`; },
      expandWithKnowledge: async (...args) => { expansions.push(args); return `expanded-${args[4]}`; },
    },
    '../services/ai/gemini-vision.js': { identifyRegion() {}, explainSpot() {}, explainRegionFromUrl() {}, explainRegionFromBase64() {} },
    '../services/ai/gemini-text.js': { generateTitle() {}, generateTitleFromText: async query => { titleCalls.push(query); return ''; }, generateRandomTopics() {} },
    '../services/ai/imageSize.js': imageSize,
    '../services/pageImageCache.js': pageCache,
    '../services/topicBooks.js': topicBooks,
    '../services/topicImagePolicy.js': { sharedTopicImagesEnabled: () => sharedImages },
    '../services/oss.js': { uploadBase64: async data => `local://${data}` },
    '../services/imageSource.js': { readImageBuffer() {} },
    '../services/hash.js': hash,
    '../config/db.js': { default: prisma },
    '../services/points.js': { requirePoints: async () => { pointCalls.push('check'); return true; }, deductPoints() { pointCalls.push('charge'); }, getPointCost: async () => 10 },
    '../services/wechatSecurity.js': { checkText: async () => ({ isSafe: true }) },
  };
  const source = await readFile(new URL('../src/routes/ai.js', import.meta.url), 'utf8');
  const module = new vm.SourceTextModule(source);
  await module.link(specifier => {
    const exports = stubs[specifier];
    assert(exports, `Unmocked dependency ${specifier}`);
    return new vm.SyntheticModule(Object.keys(exports), function () {
      for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
    });
  });
  await module.evaluate();
  await module.namespace.reloadTopicSet();
  const bookModule = new vm.SourceTextModule(await readFile(new URL('../src/routes/books.js', import.meta.url), 'utf8'));
  await bookModule.link(specifier => {
    const exports = stubs[specifier];
    assert(exports, `Unmocked books dependency ${specifier}`);
    return new vm.SyntheticModule(Object.keys(exports), function () {
      for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
    });
  });
  await bookModule.evaluate();
  return { books, pages, generations, expansions, pointCalls, titleCalls, get cacheReads() { return cacheReads; }, failNextGeneration() { generationFailure = new Error('provider failed'); }, async request(path, body, userId = 'test-user', deviceId = null) {
    let result, failure, status = 200;
    const res = { status(code) { status = code; return this; }, json(data) { result = data; } };
    await handlers.get(path)({ body, query: body, user: { id: userId }, deviceId }, res, error => { failure = error; });
    return { result, failure, status };
  } };
}

test('不同屏幕均使用原百科缓存，保留独立书架和书页层级', async () => {
  const app = await setupRoutes();
  const legacy = await app.request('/generate-image', { query: '森林' });
  const wide = await app.request('/generate-image', { query: '森林', viewport: { width: 844, height: 390 } }, 'wide-reader');
  const portrait = await app.request('/generate-image', { query: '森林', viewport: { width: 390, height: 844 } }, 'portrait-reader');
  for (const response of [legacy, wide, portrait]) {
    assert.equal(response.failure, undefined);
    assert.equal(response.result.imageUrl, 'legacy-image');
  }
  assert.equal(app.generations.length, 0);
  assert.equal(app.books.length, 3);
  const child = await app.request('/generate-image', { query: '森林', viewport: { width: 844, height: 390 }, bookId: 'other-book', parentPageId: 'parent' });
  assert.equal(child.failure, undefined);
  assert.equal(app.pages.at(-1).parentPageId, 'parent');
  assert.equal(app.pages.at(-1).bookId, 'other-book');
});

test('不同屏幕的全新话题均以固定尺寸传给模型', async () => {
  const app = await setupRoutes();
  for (const [i, viewport] of [undefined, { width: 844, height: 390 }, { width: 390, height: 844 }, { width: -1, height: 900 }].entries()) {
    const response = await app.request('/generate-image', { query: '新话题' + i, viewport });
    assert.equal(response.failure, undefined);
    assert.equal(app.generations.at(-1)[3], '1536x864');
  }
  assert.equal(app.generations.length, 4);
});

test('区域探索固定尺寸且跨窗口复用缓存，另一父页仍有独立层级', async () => {
  const app = await setupRoutes();
  const body = { selectionImageBase64: 'selected-image', identification: { description: '树木' }, bookId: 'book', parentPageId: 'parent', selectionRegion: { x: 0.1, y: 0.2, w: 0.3, h: 0.4 }, viewport: { width: 844, height: 390 } };
  const first = await app.request('/expand-region', body);
  assert.equal(first.failure, undefined);
  assert.equal(app.expansions[0][4], '1536x864');
  const repeated = await app.request('/expand-region', { ...body, parentPageId: 'other-parent', viewport: { width: 390, height: 844 } });
  assert.equal(repeated.result.fromCache, true);
  assert.equal(repeated.result.imageUrl, first.result.imageUrl);
  assert.notEqual(repeated.result.pageId, first.result.pageId);
  assert.equal(app.pages.at(-1).parentPageId, 'other-parent');
  assert.deepEqual(app.pages.at(-1).selectionRegion, body.selectionRegion);
  assert.equal(app.expansions.length, 1);
  const another = await app.request('/expand-region', { ...body, selectionImageBase64: 'another-selection', viewport: { width: 1024, height: 768 } });
  assert.equal(another.failure, undefined);
  assert.equal(app.expansions.length, 2);
  assert.equal(app.expansions[1][4], '1536x864');
});

test('已有同名话题忽略新的窗口尺寸，直接复用且不检查或扣除点数', async () => {
  const app = await setupRoutes();
  const first = await app.request('/generate-image', { query: '珊瑚礁', viewport: { width: 844, height: 390 } }, null, 'device-a');
  const beforePoints = [...app.pointCalls];
  const repeated = await app.request('/generate-image', { query: ' 珊瑚礁 ', viewport: { width: 390, height: 844 } }, null, 'device-a');
  assert.equal(repeated.failure, undefined);
  assert.equal(repeated.result.reusedBook, true);
  assert.equal(repeated.result.bookId, first.result.bookId);
  assert.equal(repeated.result.pageId, first.result.pageId);
  assert.deepEqual(app.pointCalls, beforePoints);
  assert.equal(app.books.length, 1); assert.equal(app.pages.length, 1);
  assert.equal(app.generations.length, 1);
});

test('同一书架并发重复提交只生成一次，不同书架仍各自创建', async () => {
  const app = await setupRoutes();
  const body = { query: '群山', viewport: { width: 844, height: 390 } };
  const results = await Promise.all(Array.from({ length: 8 }, () => app.request('/generate-image', body)));
  assert(results.every(result => !result.failure));
  assert.equal(new Set(results.map(result => result.result.bookId)).size, 1);
  assert.equal(app.books.length, 1); assert.equal(app.pages.length, 1);
  assert.equal(app.generations.length, 1);
  await app.request('/generate-image', body, 'another-user');
  assert.equal(app.books.length, 2);
});

test('历史同名书优先打开内容最多的记录，空书补首页而不再建书', async () => {
  const app = await setupRoutes();
  app.books.push({ id: 'short', userId: 'test-user', mode: 'book', title: '森林' }, { id: 'long', userId: 'test-user', mode: 'book', title: '森林' });
  app.pages.push({ id: 'a', bookId: 'short', imageUrl: 'short-image' }, { id: 'b', bookId: 'long', imageUrl: 'long-image' }, { id: 'c', bookId: 'long', imageUrl: 'child' });
  const reused = await app.request('/generate-image', { query: '森林' });
  assert.equal(reused.result.bookId, 'long');
  assert.equal(app.books.length, 2); assert.equal(app.pages.length, 3);
  app.books.push({ id: 'empty', userId: 'test-user', mode: 'book', title: '湖泊' });
  const filled = await app.request('/generate-image', { query: '湖泊' });
  assert.equal(filled.failure, undefined);
  assert.equal(filled.result.bookId, 'empty');
  assert.equal(app.books.length, 3); assert.equal(app.pages.length, 4);
});

test('供应商失败后释放同名锁，用户可以重试', async () => {
  const app = await setupRoutes();
  app.failNextGeneration();
  const failed = await app.request('/generate-image', { query: '珊瑚礁', viewport: { width: 844, height: 390 } });
  assert.equal(failed.failure.message, 'provider failed');
  assert.equal(app.books.length, 0);
  const retry = await app.request('/generate-image', { query: '珊瑚礁' });
  assert.equal(retry.failure, undefined);
  assert.equal(app.books.length, 1);
});

test('旧版输入附带当前 bookId 时，同名查询仍复用而不追加重复首页', async () => {
  const app = await setupRoutes();
  const first = await app.request('/generate-image', { query: 'Mountains' });
  const second = await app.request('/generate-image', { query: '  mountains  ', bookId: first.result.bookId });
  assert.equal(second.result.reusedBook, true);
  assert.equal(second.result.pageId, first.result.pageId);
  assert.equal(app.pages.length, 1); assert.equal(app.generations.length, 1);
});

test('预生成话题使用话题名作标题，首次打开不调用任何 AI', async () => {
  const app = await setupRoutes();
  const response = await app.request('/generate-image', { query: '森林' });
  assert.equal(response.failure, undefined);
  assert.equal(response.result.fromCache, true);
  assert.equal(response.result.pageTitle, '森林');
  assert.equal(app.pages[0].title, '森林');
  assert.equal(app.generations.length, 0);
  assert.equal(app.titleCalls.length, 0);
});

test('共享图片策略默认保持线上行为，仅显式关闭时按需生成', () => {
  assert.equal(sharedTopicImagesEnabled({}), true);
  assert.equal(sharedTopicImagesEnabled({ SHARED_TOPIC_IMAGES_ENABLED: 'true' }), true);
  assert.equal(sharedTopicImagesEnabled({ SHARED_TOPIC_IMAGES_ENABLED: 'false' }), false);
});

test('本地关闭预生成直开后，查询不宣告已准备且首次点击真正调用生图', async () => {
  const app = await setupRoutes({ sharedImages: false });
  const lookup = await app.request('GET /topic', { query: '森林' });
  assert.equal(lookup.failure, undefined);
  assert.equal(lookup.result.prepared, false);
  assert.equal(lookup.result.existing, null);
  assert.equal(app.cacheReads, 0);
  assert.equal(app.generations.length, 0);
  const first = await app.request('/generate-image', { query: '森林' }, null, 'device-a');
  assert.equal(first.failure, undefined);
  assert.equal(first.result.fromCache, false);
  assert.notEqual(first.result.imageUrl, 'legacy-image');
  assert.equal(app.generations.length, 1);
  assert.equal(app.cacheReads, 0);
  assert.equal(app.pages[0].promptHash, null);
  assert.deepEqual(app.pointCalls, ['check', 'charge']);
  const again = await app.request('GET /topic', { query: '森林' }, null, 'device-a');
  assert.equal(again.result.prepared, false);
  assert.equal(again.result.existing.pageId, first.result.pageId);
});

test('本地按需生成仍去重同一用户并发请求，不复用其他用户的页面缓存', async () => {
  const app = await setupRoutes({ sharedImages: false });
  app.pages.push({ id: 'other-page', bookId: 'other-book', imageUrl: 'other-image', promptHash: hash.buildPromptHash('自由主题') });
  const results = await Promise.all(Array.from({ length: 4 }, () => app.request('/generate-image', { query: '自由主题' })));
  assert(results.every(item => !item.failure));
  assert.equal(app.generations.length, 1);
  assert.equal(new Set(results.map(item => item.result.pageId)).size, 1);
  assert.notEqual(results[0].result.imageUrl, 'other-image');
  const other = await app.request('/generate-image', { query: '自由主题' }, 'another-user');
  assert.equal(other.failure, undefined);
  assert.equal(other.result.fromCache, false);
  assert.equal(app.generations.length, 2);
  assert.equal(app.pages[0].imageUrl, 'other-image');
});

test('本地按需模式再次打开自己的同名书不生成、不扣点', async () => {
  const app = await setupRoutes({ sharedImages: false });
  const first = await app.request('/generate-image', { query: '森林' }, null, 'device-a');
  const beforePoints = [...app.pointCalls];
  const again = await app.request('/generate-image', { query: ' 森林 ' }, null, 'device-a');
  assert.equal(again.result.reusedBook, true);
  assert.equal(again.result.pageId, first.result.pageId);
  assert.deepEqual(app.pointCalls, beforePoints);
  assert.equal(app.generations.length, 1);
});

test('本地生成失败时不降级读取预生成图，重试仍调用 AI', async () => {
  const app = await setupRoutes({ sharedImages: false });
  app.failNextGeneration();
  const failed = await app.request('/generate-image', { query: '森林' });
  assert.equal(failed.failure.message, 'provider failed');
  assert.equal(app.pages.length, 0);
  assert.equal(app.cacheReads, 0);
  const retry = await app.request('/generate-image', { query: '森林' });
  assert.equal(retry.failure, undefined);
  assert.equal(retry.result.fromCache, false);
  assert.equal(app.generations.length, 2);
});

test('新的 16:9 区域探索不复用历史 3:2 图片', async () => {
  const app = await setupRoutes({ sharedImages: false });
  const identification = { description: '山脉' };
  app.pages.push({ id: 'old-square', bookId: 'book', imageUrl: 'old-3-to-2',
    promptHash: hash.buildPromptHash(JSON.stringify(identification), 'selection', '1536x1024') });
  const response = await app.request('/expand-region', {
    selectionImageBase64: 'selection', identification, bookId: 'book', parentPageId: 'parent',
  });
  assert.equal(response.failure, undefined);
  assert.equal(response.result.fromCache, false);
  assert.notEqual(response.result.imageUrl, 'old-3-to-2');
  assert.equal(app.expansions.length, 1);
  assert.equal(app.expansions[0][4], '1536x864');
  assert.equal(app.pages[0].imageUrl, 'old-3-to-2');
});
