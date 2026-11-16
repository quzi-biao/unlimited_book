import test from 'node:test';
import assert from 'node:assert/strict';
import { syncContentRevision } from '../src/utils/contentRevision.js';

/** 构造隔离存储，不读取真实浏览器数据。@returns {object} */
function fixture() {
  const values = new Map([
    ['flipbook_session', 'old-page'], ['flipbook_explore_queue_v1', 'old-results'],
    ['wuxian_token', 'keep-token'], ['wuxian_device_id', 'keep-device'], ['tts-rate', '1.5'],
  ]);
  return { values, storage: { getItem: k => values.get(k), setItem: (k,v) => values.set(k,v), removeItem: k => values.delete(k) } };
}

test('内容重置清理旧图和所有探索结果，保留登录及个人设置', async () => {
  const { values, storage } = fixture();
  const cleared = await syncContentRevision({ storage, fetcher: async () => ({ ok: true, json: async () => ({ contentRevision: 'reset-1' }) }) });
  assert.equal(cleared, true);
  assert.equal(values.has('flipbook_session'), false);
  assert.equal(values.has('flipbook_explore_queue_v1'), false);
  assert.equal(values.get('wuxian_token'), 'keep-token');
  assert.equal(values.get('wuxian_device_id'), 'keep-device');
  assert.equal(values.get('tts-rate'), '1.5');
});

test('相同版本刷新不删除刚打开的新图和新结果', async () => {
  const { values, storage } = fixture();
  values.set('flipbook_content_revision', 'reset-1');
  assert.equal(await syncContentRevision({ storage, fetcher: async () => ({ ok: true, json: async () => ({ contentRevision: 'reset-1' }) }) }), false);
  assert.equal(values.get('flipbook_session'), 'old-page');
  assert.equal(values.get('flipbook_explore_queue_v1'), 'old-results');
});

test('断网、旧服务、失败响应均不误删有效本地记录', async () => {
  for (const fetcher of [async () => { throw Error('offline'); }, async () => ({ ok: false }), async () => ({ ok: true, json: async () => ({ status: 'ok' }) })]) {
    const { values, storage } = fixture();
    assert.equal(await syncContentRevision({ storage, fetcher }), false);
    assert.equal(values.get('flipbook_session'), 'old-page');
  }
});
