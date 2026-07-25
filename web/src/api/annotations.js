import { get, post, patch, del } from './client.js';

/** GET /api/pages/:pageId/annotations */
export const getAnnotations = (pageId) =>
  get(`/api/pages/${pageId}/annotations`);

/** POST /api/pages/:pageId/annotations */
export const createAnnotation = (pageId, data) =>
  post(`/api/pages/${pageId}/annotations`, data);

/** PATCH /api/pages/:pageId/annotations/:id */
export const updateAnnotation = (pageId, id, data) =>
  patch(`/api/pages/${pageId}/annotations/${id}`, data);

/** DELETE /api/annotations/:id */
export const deleteAnnotation = (id) => del(`/api/annotations/${id}`);
