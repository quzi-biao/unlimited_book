import { handleOrderPaid } from '../services/paymentSettlement.js';
import { resolveReader, requireAccount } from '../services/knowledge/readerAuth.js';
/**
 * payment.js — 设备端支付路由
 *
 * GET  /api/device/plans                   获取活跃套餐列表（DeviceToken）
 * POST /api/device/payment/create          创建订单 + 微信 Native 二维码
 * GET  /api/device/payment/order/:orderId  轮询订单状态
 * POST /api/device/payment/notify          微信支付回调（无需 Token）
 * GET  /api/device/payment/history         设备订单历史
 */

import express from 'express';
import { PrismaClient } from '@prisma/client';
import { requireDeviceToken } from './device.js';
import { createNativeOrder, verifyAndDecodeNotify, queryOrder } from '../services/wechat.js';

const router = express.Router();
const prisma = new PrismaClient();

// ── GET /api/device/plans ─────────────────────────────────────
/**
 * 获取已启用的套餐列表（设备端订阅页用）
 */
router.get('/plans', requireDeviceToken, async (req, res, next) => {
  try {
    const plans = await prisma.plan.findMany({
      where:   { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }],
      select: {
        id: true,
        name: true,
        price: true,
        points: true,
        monthlyAllowance: true,
        descriptionJson: true,
      },
    });
    res.json({ plans });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/device/wallet ────────────────────────────────────
/**
 * 获取当前设备余额
 * Response: { balance: number, pointsPerYuan: number }
 */
router.get('/wallet', requireDeviceToken, async (req, res, next) => {
  try {
    const [wallet, cfgRate, cfgMin, cfgMax] = await Promise.all([
      prisma.deviceWallet.findUnique({ where: { deviceId: req.deviceId } }),
      prisma.globalConfig.findUnique({ where: { key: 'POINTS_PER_YUAN' } }),
      prisma.globalConfig.findUnique({ where: { key: 'DIRECT_RECHARGE_MIN' } }),
      prisma.globalConfig.findUnique({ where: { key: 'DIRECT_RECHARGE_MAX' } }),
    ]);
    res.json({
      balance:       wallet?.balance ?? 0,
      pointsPerYuan: Number(cfgRate?.value ?? 100),
      minYuan:       Number(cfgMin?.value ?? 10),
      maxYuan:       Number(cfgMax?.value ?? 2000),
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/device/payment/direct ──────────────────────────
/**
 * 创建微信 Native 支付订单
 * Body: { planId: string }
 * Response: { orderId, codeUrl, amount, points }
 */
router.post('/payment/create', requireDeviceToken, resolveReader, async (req, res, next) => {
  const deviceId = req.deviceId;
  try {
    const { planId } = req.body;
    if (!planId) return res.status(400).json({ error: '缺少 planId' });

    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan || !plan.isActive) return res.status(404).json({ error: '套餐不存在或已停用' });

    if (plan.monthlyAllowance > 0) requireAccount(req.reader);

    // 创建订单记录
    const order = await prisma.order.create({
      data: {
        deviceId,
        channelId: req.deviceId ? (await prisma.device.findUnique({ where: { id: deviceId }, select: { channelId: true } }))?.channelId ?? null : null,
        planId: plan.id,
        amount: plan.price,
        points: plan.points,
        readerProfileId: plan.monthlyAllowance > 0 ? req.reader.id : null,
        monthlyAllowance: plan.monthlyAllowance,
        status: 'pending',
      },
    });

    // 调用微信支付创建 Native 订单
    const description = `${plan.name} ${plan.points}点`;
    const codeUrl = await createNativeOrder(order.id, plan.price, description);

    res.json({ orderId: order.id, codeUrl, amount: plan.price, points: plan.points });
  } catch (err) {
    console.error('[payment/create]', err.message);
    next(err);
  }
});

// ── POST /api/device/payment/direct ─────────────────────────
/**
 * 自定义金额购买点数（不绑定套餐）
 * Body: { amountYuan: number }  — 单位：元，最小 0.01
 * 点数 = Math.floor(amountYuan * pointsPerYuan)，比例从 GlobalConfig.POINTS_PER_YUAN 读取
 * Response: { orderId, codeUrl, amount, points }
 */
router.post('/payment/direct', requireDeviceToken, async (req, res, next) => {
  const deviceId = req.deviceId;
  try {
    const { amountYuan } = req.body;
    const yuan = parseFloat(amountYuan);
    if (isNaN(yuan) || yuan <= 0) return res.status(400).json({ error: '请输入有效金额' });

    // 从 GlobalConfig 读取限额与比例（批量查，减少 DB 往返）
    const cfgs = await prisma.globalConfig.findMany({
      where: { key: { in: ['POINTS_PER_YUAN', 'DIRECT_RECHARGE_MIN', 'DIRECT_RECHARGE_MAX'] } },
    });
    const cfgMap        = Object.fromEntries(cfgs.map((c) => [c.key, Number(c.value)]));
    const pointsPerYuan = cfgMap.POINTS_PER_YUAN   ?? 100;
    const minYuan       = cfgMap.DIRECT_RECHARGE_MIN ?? 10;
    const maxYuan       = cfgMap.DIRECT_RECHARGE_MAX ?? 2000;

    if (yuan < minYuan)  return res.status(400).json({ error: `充值金额最低 ${minYuan} 元` });
    if (yuan > maxYuan)  return res.status(400).json({ error: `充值金额最高 ${maxYuan} 元` });

    const amountFen = Math.round(yuan * 100);
    const points    = Math.floor(yuan * pointsPerYuan);

    if (points < 1) return res.status(400).json({ error: '充值金额过小，至少需获得 1 点' });

    const order = await prisma.order.create({
      data: {
        deviceId,
        channelId: req.deviceId ? (await prisma.device.findUnique({ where: { id: deviceId }, select: { channelId: true } }))?.channelId ?? null : null,
        planId: null,
        amount: amountFen,
        points,
        status: 'pending',
      },
    });

    const description = `自定义充值 ${points}点`;
    const codeUrl = await createNativeOrder(order.id, amountFen, description);

    res.json({ orderId: order.id, codeUrl, amount: amountFen, points });
  } catch (err) {
    console.error('[payment/direct]', err.message);
    next(err);
  }
});

// ── GET /api/device/payment/order/:orderId ────────────────────
/**
 * 前端轮询订单状态（每 2s 调用一次）
 * 若 DB 为 pending，主动向微信查单（作为兜底）
 * Response: { status: 'pending'|'paid'|'failed', balance? }
 */
router.get('/payment/order/:orderId', requireDeviceToken, async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true, deviceId: true, points: true },
    });

    if (!order) return res.status(404).json({ error: '订单不存在' });
    if (order.deviceId !== req.deviceId) return res.status(403).json({ error: '无权查看此订单' });

    if (order.status === 'paid') {
      const wallet = await prisma.deviceWallet.findUnique({ where: { deviceId: req.deviceId } });
      return res.json({ status: 'paid', balance: wallet?.balance ?? 0 });
    }

    // DB 还在 pending：主动向微信查单（将回调丢失等场景设为安全网）
    if (order.status === 'pending') {
      try {
        const wxResult = await queryOrder(orderId);
        // SDK 返回格式: { status: 200, data: { trade_state: '...' } }
        const wxData = wxResult?.data || wxResult;
        const tradeState = wxData?.trade_state;
        console.log(`[poll] 订单 ${orderId} 微信状态: ${tradeState}`);

        if (tradeState === 'SUCCESS') {
          // 微信已支付但回调未到，手动触发到账（传 wxData，含 transaction_id）
          await handleOrderPaid(orderId, wxData);
          const wallet = await prisma.deviceWallet.findUnique({ where: { deviceId: req.deviceId } });
          return res.json({ status: 'paid', balance: wallet?.balance ?? 0 });
        }
      } catch {
        // 查单失败不影响响应
      }
    }

    res.json({ status: order.status });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/device/payment/cancel/:orderId ──────────────────
/**
 * 主动取消待支付订单（设备端手动取消 or 前端倒计时超时）
 * 取消前先调微信查单，若已支付则走支付成功流程
 */
router.post('/payment/cancel/:orderId', requireDeviceToken, async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const order = await prisma.order.findUnique({
      where:  { id: orderId },
      select: { id: true, status: true, deviceId: true, points: true },
    });

    if (!order) return res.status(404).json({ error: '订单不存在' });
    if (order.deviceId !== req.deviceId) return res.status(403).json({ error: '无权操作此订单' });

    // 已终态则直接返回
    if (order.status === 'paid') return res.json({ status: 'paid', message: '订单已支付' });
    if (order.status === 'cancelled') return res.json({ status: 'cancelled', message: '订单已取消' });

    // 取消前先向微信查单（防止已付款但回调未到）
    try {
      const wxResult = await queryOrder(orderId);
      if (wxResult?.data?.trade_state === 'SUCCESS' || wxResult?.trade_state === 'SUCCESS') {
        await handleOrderPaid(orderId, wxResult?.data || wxResult);
        const wallet = await prisma.deviceWallet.findUnique({ where: { deviceId: req.deviceId } });
        return res.json({ status: 'paid', balance: wallet?.balance ?? 0, message: '检测到支付成功，已充值' });
      }
    } catch {
      // 查单失败不阻止取消
    }

    // 标记为取消
    await prisma.order.update({
      where: { id: orderId },
      data:  { status: 'cancelled' },
    });

    res.json({ status: 'cancelled', message: '订单已取消' });
  } catch (err) {
    console.error('[payment/cancel]', err.message);
    next(err);
  }
});

// ── POST /api/device/payment/reopen/:orderId ─────────────────
/**
 * 重新唤起待支付订单的二维码
 * 订单有效期固定 300s（从 createdAt 算）。
 * 若未超时：查微信状态 → 返回 remainingSeconds + codeUrl（复用原订单，不重新下单）
 * 若已超时：先查微信是否已支付，未支付则标记 cancelled
 */

const ORDER_TTL_MS = 300_000; // 5分钟

router.post('/payment/reopen/:orderId', requireDeviceToken, async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const order = await prisma.order.findUnique({
      where:   { id: orderId },
      include: { plan: true },
    });

    if (!order) return res.status(404).json({ error: '订单不存在' });
    if (order.deviceId !== req.deviceId) return res.status(403).json({ error: '无权操作此订单' });
    if (order.status !== 'pending') return res.status(400).json({ error: `订单状态为 ${order.status}，无法重新唤起` });

    // 计算剩余时间
    const ageMs     = Date.now() - new Date(order.createdAt).getTime();
    const remaining = Math.max(0, Math.floor((ORDER_TTL_MS - ageMs) / 1000));

    // 查微信是否已支付（无论超时与否都要查）
    try {
      const wxResult = await queryOrder(orderId);
      const wxData = wxResult?.data || wxResult;
      if (wxData?.trade_state === 'SUCCESS') {
        await handleOrderPaid(orderId, wxData);
        const wallet = await prisma.deviceWallet.findUnique({ where: { deviceId: req.deviceId } });
        return res.json({ status: 'paid', balance: wallet?.balance ?? 0 });
      }
    } catch { /* 查单失败继续处理 */ }

    // 已超时：标记取消
    if (remaining <= 0) {
      await prisma.order.update({ where: { id: orderId }, data: { status: 'cancelled' } });
      return res.status(400).json({ error: '订单已超时，请重新发起支付', status: 'cancelled' });
    }

    // 未超时：复用原 codeUrl（微信侧订单未过期，不需要重新下单）
    // 前端用 createdAt 计算剩余倒计时，不依赖服务端 codeUrl 刷新
    const description = order.plan
      ? `${order.plan.name} ${order.points}点`
      : `自定义充值 ${order.points}点`;

    // 重新拿一次 codeUrl（微信同一 out_trade_no 返回相同二维码）
    let codeUrl;
    try {
      codeUrl = await createNativeOrder(orderId, order.amount, description);
    } catch (e) {
      // 微信可能返回 ORDERPAID / ORDER_CLOSED 等错误，再查一次
      console.warn('[reopen] 重新下单失败，再查一次微信：', e.message);
      throw e;
    }

    res.json({
      orderId:          order.id,
      codeUrl,
      amount:           order.amount,
      points:           order.points,
      createdAt:        order.createdAt,   // 前端用于计算剩余倒计时
      remainingSeconds: remaining,
    });
  } catch (err) {
    console.error('[payment/reopen]', err.message);
    next(err);
  }
});

// ── POST /api/device/payment/notify ──────────────────────────
/**
 * 微信支付回调（公网可达，无需 DeviceToken）
 * 微信会重复推送，需幂等处理
 */
router.post('/payment/notify', express.raw({ type: 'application/json' }), async (req, res) => {
  const rawBody = req.body.toString('utf8');

  try {
    const data = await verifyAndDecodeNotify(req.headers, rawBody);

    if (data.trade_state === 'SUCCESS') {
      const outTradeNo = data.out_trade_no; // 即 Order.id
      await handleOrderPaid(outTradeNo, data);
    }

    // 微信要求返回 SUCCESS 否则会重复推送
    res.json({ code: 'SUCCESS', message: 'OK' });
  } catch (err) {
    console.error('[payment/notify] 处理失败:', err.message);
    // 返回失败让微信重试
    res.status(500).json({ code: 'FAIL', message: err.message });
  }
});

// ── GET /api/device/payment/history ──────────────────────────
/**
 * 设备历史订单（最近 20 条）
 * 返回前：服务端自动将超时的 pending 订单标记为 cancelled（兜底，防止前端关闭后遗留）
 */
router.get('/payment/history', requireDeviceToken, async (req, res, next) => {
  try {
    // 服务端超时取消：将此设备超过 5 分钟仍 pending 的订单批量标记为 cancelled
    const expireThreshold = new Date(Date.now() - ORDER_TTL_MS);
    await prisma.order.updateMany({
      where: {
        deviceId:  req.deviceId,
        status:    'pending',
        createdAt: { lt: expireThreshold },
      },
      data: { status: 'cancelled' },
    });

    const orders = await prisma.order.findMany({
      where:   { deviceId: req.deviceId },
      orderBy: { createdAt: 'desc' },
      take:    20,
      include: { plan: { select: { name: true } } },
    });
    res.json({ orders });
  } catch (err) {
    next(err);
  }
});

export default router;
