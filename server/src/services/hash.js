import { createHash } from 'crypto';
import { DEFAULT_IMAGE_SIZE, LEGACY_IMAGE_SIZE } from './ai/imageSize.js';

/**
 * 生成页的 promptHash：SHA256(prompt + selectionImageBase64)
 * 用于缓存命中检查，避免重复调用 AI
 * @param {string} prompt
 * @param {string} [selectionImageBase64]  data URL 或纯 base64
 * @param {string} [imageSize] 输出画幅；仅显式旧尺寸沿用历史缓存键
 * @returns {string} hex hash
 */
export function buildPromptHash(prompt, selectionImageBase64 = '', imageSize = DEFAULT_IMAGE_SIZE) {
  const fingerprint = imageSize === LEGACY_IMAGE_SIZE
    ? prompt + selectionImageBase64
    : JSON.stringify(['image-size-v2', imageSize, prompt, selectionImageBase64]);
  return createHash('sha256')
    .update(fingerprint)
    .digest('hex');
}

/**
 * 生成内容 hash：SHA256(imageBase64)
 * 用于标记页图片内容的唯一性
 * @param {string} imageBase64
 * @returns {string} hex hash
 */
export function buildContentHash(imageBase64) {
  return createHash('sha256')
    .update(imageBase64)
    .digest('hex');
}

/**
 * 生成 MD5：用于 TopicCache 保存 prompt 指纹
 * MD5 比 SHA256 短（32 字节），适合快速比对
 * @param {string} text
 * @returns {string} hex md5
 */
export function buildMd5(text) {
  return createHash('md5').update(text).digest('hex');
}
