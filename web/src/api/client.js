/**
 * API client — fetch 封装
 * 自动注入 Authorization Token，统一错误处理
 */

const BASE = window.unlimitedBookNative?.apiBase || '';

/**
 * 获取存储的 Token
 * @returns {string|null}
 */
function getToken() {
  return localStorage.getItem('wuxian_token');
}

/**
 * 核心 fetch 封装
 * @param {string} path - API 路径（如 /api/books）
 * @param {RequestInit} [options]
 * @returns {Promise<any>}
 */
async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(localStorage.getItem('knowledge_reader_token') ? { 'X-Reader-Token':localStorage.getItem('knowledge_reader_token') } : {}),
    ...options.headers,
  };

  const res = await fetch(BASE + path, { ...options, headers });

  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      errMsg = body.error || body.message || errMsg;
    } catch {}
    const err = new Error(errMsg);
    err.status = res.status;
    throw err;
  }

  // 204 No Content
  if (res.status === 204) return null;

  return res.json();
}

/**
 * 带流式响应的 POST（用于 TTS）
 * @returns {Promise<Response>}
 */
async function requestStream(path, body) {
  const token = getToken();
  return fetch(BASE + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(localStorage.getItem('knowledge_reader_token') ? { 'X-Reader-Token':localStorage.getItem('knowledge_reader_token') } : {}),
    },
    body: JSON.stringify(body),
  });
}

export const get  = (path, params) => {
  const url = params
    ? `${path}?${new URLSearchParams(params)}`
    : path;
  return request(url);
};

export const post   = (path, body)       => request(path, { method: 'POST',   body: JSON.stringify(body) });
export const patch  = (path, body)       => request(path, { method: 'PATCH',  body: JSON.stringify(body) });
export const del    = (path)             => request(path, { method: 'DELETE' });
export const stream = (path, body)       => requestStream(path, body);
