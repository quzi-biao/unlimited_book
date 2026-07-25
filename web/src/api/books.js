import { get, post, patch, del } from './client.js';

/** GET /api/books */
export const getBooks = () => get('/api/books');

/** POST /api/books */
export const createBook = (data) => post('/api/books', data);

/** GET /api/books/:id */
export const getBook = (id) => get(`/api/books/${id}`);

/** PATCH /api/books/:id */
export const updateBook = (id, data) => patch(`/api/books/${id}`, data);

/** DELETE /api/books/:id */
export const deleteBook = (id) => del(`/api/books/${id}`);

/** GET /api/books/:bookId/pages */
export const getPages = (bookId) => get(`/api/books/${bookId}/pages`);

/** GET /api/pages/:id */
export const getPage = (id) => get(`/api/pages/${id}`);
