import test from 'node:test';
import assert from 'node:assert/strict';
import { getNativeDevice } from '../src/utils/nativeDevice.js';

test('普通浏览器保持原设备识别方式', () => {
  assert.equal(getNativeDevice({}), null);
  assert.equal(getNativeDevice({ unlimitedBookNative: { platform: 'ios', fingerprint: 'shared' } }), null);
});

test('iOS 读取独立安装标识和版本', () => {
  const device = { platform: 'ios', fingerprint: 'ios-12345678-1234-4234-8234-123456789abc', appVersion: 'ios-1.0.0(1)' };
  assert.equal(getNativeDevice({ unlimitedBookNative: device }), device);
});
