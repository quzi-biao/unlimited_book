import prisma from '../config/db.js';

/**
 * 获取后台核心指标汇总
 * @returns {Promise<object>}
 */
export async function getAdminMetrics() {
  const [deviceCount, onlineCount, orders, paidOrders, refundedOrders, tickets, openTickets, channels] = await Promise.all([
    prisma.device.count(),
    prisma.deviceSession.count({ where: { endAt: null } }),
    prisma.order.count(),
    prisma.order.count({ where: { status: 'paid' } }),
    prisma.order.count({ where: { status: 'refunded' } }),
    prisma.supportTicket.count(),
    prisma.supportTicket.count({ where: { status: { in: ['open', 'processing', 'waiting'] } } }),
    prisma.channel.count({ where: { isActive: true } }),
  ]);

  const [totalRevenueRaw, avgOrderRaw, recentOrders, recentTickets] = await Promise.all([
    prisma.$queryRaw`
      SELECT COALESCE(SUM(amount), 0) AS val
      FROM orders
      WHERE status = 'paid'
    `,
    prisma.$queryRaw`
      SELECT COALESCE(AVG(amount), 0) AS val
      FROM orders
      WHERE status = 'paid'
    `,
    prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { 
        id: true, amount: true, status: true, createdAt: true, deviceId: true, channelId: true,
        device: { select: { deviceCode: true } }, 
        channel: { select: { name: true } } 
      },
    }),
    prisma.supportTicket.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { 
        id: true, title: true, type: true, status: true, createdAt: true, deviceId: true, channelId: true,
        device: { select: { deviceCode: true } }, 
        channel: { select: { name: true } } 
      },
    }),
  ]);

  return {
    deviceCount,
    onlineCount,
    channels,
    orders,
    paidOrders,
    refundedOrders,
    tickets,
    openTickets,
    revenueFen: Number(totalRevenueRaw[0]?.val ?? 0),
    avgOrderFen: Number(avgOrderRaw[0]?.val ?? 0),
    recentOrders,
    recentTickets,
  };
}
