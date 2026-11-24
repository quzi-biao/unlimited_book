import { Router } from 'express';
import prisma from '../../config/db.js';
import { requireAdmin } from './auth.js';
import { requestRefund } from '../../services/paymentRefund.js';

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

/** 申请或查询退款；仅渠道确认成功后原子撤回点数与月额度。 */
router.post('/:id/refund', async (req, res, next) => {
  try { res.json(await requestRefund(req.params.id)); }
  catch (error) { next(error); }
});

export default router;
