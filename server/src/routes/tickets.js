/**
 * tickets.js — 客户端客服工单/反馈接口
 */
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireDeviceToken } from './device.js';

const router = Router();
const prisma = new PrismaClient();

// 客户端提交问题反馈
router.post('/', requireDeviceToken, async (req, res, next) => {
  try {
    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ error: '反馈内容不能为空' });
    }

    const device = await prisma.device.findUnique({
      where: { id: req.deviceId }
    });

    if (!device) {
      return res.status(404).json({ error: '设备不存在' });
    }

    // 创建工单及首条留言
    const ticket = await prisma.supportTicket.create({
      data: {
        deviceId: device.id,
        channelId: device.channelId,
        title: '',          // 客户端上报标题为空
        type: 'feedback',   // 类型为客户反馈
        status: 'open',
        priority: 'medium',
        description: '客户端反馈', // 备用描述，真实内容放在 message 中
        messages: {
          create: {
            authorType: 'customer',
            content: content
          }
        }
      }
    });

    res.json({ success: true, ticketId: ticket.id });
  } catch (err) {
    next(err);
  }
});

export default router;
