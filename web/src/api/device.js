import { get, post, patch, del } from './client.js';

/** POST /api/device/register */
export const registerDevice = (fingerprint, meta = {}) =>
  post('/api/device/register', { fingerprint, ...meta });

/** POST /api/device/heartbeat */
export const heartbeat = (appVersion) =>
  post('/api/device/heartbeat', { appVersion: appVersion || 'web-1.0' });

/** GET /api/device/info */
export const getDeviceInfo = () => get('/api/device/info');

/** GET /api/device/voices */
export const getVoices = () => get('/api/device/voices');

/** PATCH /api/device/settings/voice */
export const setVoice = (voiceId) =>
  patch('/api/device/settings/voice', { voiceId });

/** GET /api/device/prompt-styles */
export const getPromptStyles = () => get('/api/device/prompt-styles');

/** PATCH /api/device/settings/prompt-style */
export const setPromptStyle = (promptStyleId) =>
  patch('/api/device/settings/prompt-style', { promptStyleId });

/** GET /api/device/topic-categories */
export const getTopicCategories = () => get('/api/device/topic-categories');

/** GET /api/device/wallet */
export const getWallet = () => get('/api/device/wallet');

/** GET /api/device/plans */
export const getPlans = () => get('/api/device/plans');

/** POST /api/device/factory-reset */
export const factoryReset = () => post('/api/device/factory-reset', {});
