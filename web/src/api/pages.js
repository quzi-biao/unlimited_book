import { get, post, patch, del } from './client.js';

/** GET /api/pages/:id */
export const getPage = (id) => get(`/api/pages/${id}`);

/** PATCH /api/pages/:id */
export const updatePage = (id, data) => patch(`/api/pages/${id}`, data);

/** DELETE /api/pages/:id */
export const deletePage = (id) => del(`/api/pages/${id}`);

/**
 * GET /api/pages/:id/explanation
 * @param {string} id
 * @param {'zh'|'en'} lang
 */
export const getExplanation = (id, lang = 'zh') =>
  get(`/api/pages/${id}/explanation`, { lang });
