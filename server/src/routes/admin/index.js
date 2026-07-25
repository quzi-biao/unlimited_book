/**
 * admin/index.js — Admin 路由统一入口
 * 挂载到 /api/admin
 */

import { Router } from 'express';
import authRouter    from './auth.js';
import devicesRouter from './devices.js';
import topicsRouter  from './topics.js';
import versionsRouter from './versions.js';
import configRouter  from './config.js';
import voicesRouter  from './voices.js';
import plansRouter   from './plans.js';
import promptStylesRouter from './promptStyles.js';
import topicCategoriesRouter from './topicCategories.js';
import channelsRouter from './channels.js';
import ticketsRouter from './tickets.js';
import settlementsRouter from './settlements.js';
import ordersRouter from './orders.js';
import agreementsRouter from './agreements.js';
import usersRouter from './users.js';
import { requireAdmin } from './auth.js';
import { getAdminMetrics } from '../../services/adminMetrics.js';
import { validateContentMiddleware } from '../../middleware/riskControl.js';

const router = Router();

router.use('/auth',     authRouter);

router.use(requireAdmin);
router.use(validateContentMiddleware);

router.use('/devices',  devicesRouter);
router.use('/topics',   topicsRouter);
router.use('/versions', versionsRouter);
router.use('/config',   configRouter);
router.use('/voices',   voicesRouter);
router.use('/plans',    plansRouter);
router.use('/prompt-styles', promptStylesRouter);
router.use('/topic-categories', topicCategoriesRouter);
router.use('/channels', channelsRouter);
router.use('/tickets', ticketsRouter);
router.use('/settlements', settlementsRouter);
router.use('/orders', ordersRouter);
router.use('/agreements', agreementsRouter);
router.use('/users', usersRouter);

router.get('/dashboard', async (_req, res, next) => {
  try {
    const metrics = await getAdminMetrics();
    res.json({ metrics });
  } catch (err) {
    next(err);
  }
});

export default router;
