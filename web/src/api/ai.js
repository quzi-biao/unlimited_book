import { get, post } from './client.js';
import { getReadingViewport } from '../utils/readingViewport.js';

/**
 * POST /api/ai/generate-image
 * 文生图（可选挂载到已有 book）
 * @param {string} query
 * @param {string} [bookId]
 * @param {string} [parentPageId]
 */
export const generateImage = (query, bookId, parentPageId) =>
  post('/api/ai/generate-image', { query, bookId, parentPageId, viewport: getReadingViewport() });

/**
 * POST /api/ai/identify-region
 * 识别框选区域内容
 * @param {string} imageBase64 - 裁剪后的 base64
 */
export const identifyRegion = (imageBase64) =>
  post('/api/ai/identify-region', { imageBase64 });

/**
 * POST /api/ai/expand-region
 * 深入探索（图生图）
 */
export const expandRegion = (params) =>
  post('/api/ai/expand-region', { ...params, viewport: getReadingViewport() });

/**
 * POST /api/ai/explain-spot
 * 点击坐标解释
 * @param {string} imageUrl
 * @param {number} x - 归一化坐标 0~1
 * @param {number} y - 归一化坐标 0~1
 */
export const explainSpot = (imageUrl, x, y) =>
  post('/api/ai/explain-spot', { imageUrl, x, y });

/**
 * POST /api/ai/explain-region
 * 框选区域解读（支持 base64 或 url+region 两种模式）
 */
export const explainRegion = (params) =>
  post('/api/ai/explain-region', params);

/**
 * POST /api/ai/crop-region
 * 后端裁剪图像（避免前端 tainted-canvas 问题）
 * @param {string} imageUrl
 * @param {{ x1, y1, x2, y2 }} region - 归一化坐标
 */
export const cropRegion = (imageUrl, region) =>
  post('/api/ai/crop-region', { imageUrl, region });

/**
 * GET /api/ai/random-topics
 * 随机科普话题
 */
export const getRandomTopics = () => get('/api/ai/random-topics');
