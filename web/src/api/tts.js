import { get, post } from './client.js';

/**
 * GET /api/tts/page/:pageId — 检查缓存
 * @param {string} pageId
 * @param {'zh'|'en'} lang
 */
export const checkTtsCache = (pageId, lang = 'zh') =>
  get(`/api/tts/page/${pageId}`, { lang });

/**
 * POST /api/tts/page/:pageId — 触发合成（triggerOnly 模式）
 * 后端异步合成，不等待完成
 */
export const triggerTts = (pageId, lang = 'zh') =>
  post(`/api/tts/page/${pageId}?lang=${lang}&triggerOnly=1`, {});

/**
 * GET /api/tts/annotation/:annotationId — 检查标注语音缓存
 */
export const checkAnnotationTtsCache = (annotationId) =>
  get(`/api/tts/annotation/${annotationId}`);

/**
 * POST /api/tts/annotation/:annotationId — 触发标注语音合成
 */
export const triggerAnnotationTts = (annotationId) =>
  post(`/api/tts/annotation/${annotationId}?triggerOnly=1`, {});
