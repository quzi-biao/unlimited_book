import FingerprintJS from '@fingerprintjs/fingerprintjs';

/** @type {Promise<string>|null} */
let fpPromise = null;

/**
 * 获取浏览器唯一指纹（稳定 visitorId）
 * 结果会被缓存，多次调用只初始化一次
 * @returns {Promise<string>}
 */
export async function getFingerprint() {
  if (!fpPromise) {
    fpPromise = FingerprintJS.load().then((fp) => fp.get()).then((result) => result.visitorId);
  }
  return fpPromise;
}
