import { Router } from 'express';
import prisma from '../../config/db.js';
import { requireAdmin } from './auth.js';
import { refundOrder } from '../../services/wechat.js';

const router = Router();
router.use(requireAdmin);

// 获取所有订单列表
router.get('/', async (req, res, next) => {
  const page   = Math.max(1, parseInt(req.query.page  || '1'));
  const limit  = Math.min(100, parseInt(req.query.limit || '20'));
  const search = req.query.search || '';
  const status = req.query.status;
  const channelId = req.query.channelId;
  const channelSettlementStatus = req.query.channelSettlementStatus;
  const skip   = (page - 1) * limit;

  const where = {
    ...(search ? {
      OR: [
        { id: { contains: search, mode: 'insensitive' } },
        { device: { deviceCode: { contains: search, mode: 'insensitive' } } },
      ],
    } : {}),
    ...(status ? { status } : {}),
    ...(channelId ? { channelId } : {}),
    ...(channelSettlementStatus ? { channelSettlementStatus } : {}),
  };

  try {
    const [total, orders] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          device: { select: { deviceCode: true } },
          channel: { select: { id: true, name: true } },
          plan: { select: { name: true } },
          payment: true,
        },
      }),
    ]);
    res.json({ total, page, limit, orders });
  } catch (err) {
    next(err);
  }
});

// 手动修改订单归属渠道
router.patch('/:id', async (req, res, next) => {
  const { channelId } = req.body;
  try {
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { channelId: channelId || null },
    });
    res.json({ order });
  } catch (err) {
    next(err);
  }
});

// 退款
router.post('/:id/refund', async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { payment: true },
    });
    if (!order) return res.status(404).json({ error: '订单不存在' });
    if (order.status !== 'paid') return res.status(400).json({ error: '只能对已支付的订单发起退款' });
    if (!order.payment || order.payment.channel !== 'wechat') {
      // 非微信订单也允许改状态，因为可能是后台手动或者兜底测试
      await prisma.order.update({
        where: { id: order.id },
        data: { status: 'refunded' },
      });
      return res.json({ success: true, message: '系统直接变更为退款状态（非微信订单）' });
    }

    const outRefundNo = `REFUND_${order.id}`;
    
    // 调用微信退款
    await refundOrder(
      order.id,
      outRefundNo,
      order.amount,
      order.amount,
      '管理员后台发起退款'
    );

    // 修改状态
    await prisma.order.update({
      where: { id: order.id },
      data: { status: 'refunded' },
    });

    res.json({ success: true, message: '退款成功' });
  } catch (err) {
    console.error('[refund]', err);
    res.status(500).json({ error: err.message || '退款失败' });
  }
});

export default router;
