import { get, post } from './client.js';

/** GET /api/device/plans — 获取套餐列表 */
export const getPlans = () => get('/api/device/plans');

/** GET /api/device/wallet — 余额 */
export const getWallet = () => get('/api/device/wallet');

/**
 * POST /api/device/payment/create — 创建微信 Native 订单
 * @param {string} planId
 * @returns {{ codeUrl, orderId, amount }}
 */
export const createOrder = (planId) =>
  post('/api/device/payment/create', { planId });

/**
 * GET /api/device/payment/order/:orderId — 轮询订单状态
 * @param {string} orderId
 * @returns {{ status: 'pending'|'paid'|'failed', balance?: number }}
 */
export const getOrderStatus = (orderId) =>
  get(`/api/device/payment/order/${orderId}`);

/** GET /api/device/payment/history — 订单历史 */
export const getPaymentHistory = () => get('/api/device/payment/history');
