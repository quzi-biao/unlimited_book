import FingerprintJS from '@fingerprintjs/fingerprintjs';
import { getNativeDevice } from './nativeDevice.js';

/** @type {Promise<string>|null} */
let fpPromise = null;

/**
 * 获取浏览器唯一指纹（稳定 visitorId）
 * 结果会被缓存，多次调用只初始化一次
 * @returns {Promise<string>}
 */
export async function getFingerprint() {
  const nativeDevice = getNativeDevice();
  if (nativeDevice) return nativeDevice.fingerprint;
  // 本机预览共用阅读身份，让不同浏览器访问同一份导入书架。
  const localPreview = import.meta.env.DEV
    && import.meta.env.VITE_LOCAL_SHARED_READER === 'true'
    && ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
  if (localPreview) return 'flipbook-local-shared-reader';

  if (!fpPromise) {
    fpPromise = FingerprintJS.load().then((fp) => fp.get()).then((result) => result.visitorId);
  }
  return fpPromise;
}
