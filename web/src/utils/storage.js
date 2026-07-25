const TOKEN_KEY   = 'wuxian_token';
const DEVICE_KEY  = 'wuxian_device_id';

/** @returns {string|null} */
export const getToken    = () => localStorage.getItem(TOKEN_KEY);
export const setToken    = (v) => localStorage.setItem(TOKEN_KEY, v);
export const clearToken  = () => localStorage.removeItem(TOKEN_KEY);

/** @returns {string|null} */
export const getDeviceId   = () => localStorage.getItem(DEVICE_KEY);
export const setDeviceId   = (v) => localStorage.setItem(DEVICE_KEY, v);
export const clearDeviceId = () => localStorage.removeItem(DEVICE_KEY);

/** 清除所有认证信息 */
export const clearAuth = () => {
  clearToken();
  clearDeviceId();
};
