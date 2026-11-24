import { Router } from 'express';
import { randomBytes, createHash } from 'node:crypto';
import prisma from '../../config/db.js';
import { fail, isMinor } from '../../services/knowledge/policy.js';
import { requireAccount, publicProfile } from '../../services/knowledge/readerAuth.js';
import { readerReport } from '../../services/knowledge/reports.js';

const router = Router();
/** 一次性邀请码只存摘要，有效期十分钟，儿童提供给监护人绑定。 */
router.post('/invite', async (req, res, next) => {
  try {
    requireAccount(req.reader);
    if (!isMinor(req.reader) || req.reader.guardianId) fail(409, '仅未绑定监护人的儿童账号可创建邀请');
    const code = randomBytes(18).toString('base64url');
    const expiresAt = new Date(Date.now() + 600000);
    await prisma.guardianInvite.create({ data: { tokenHash: createHash('sha256').update(code).digest('hex'), childId: req.reader.id, expiresAt } });
    res.json({ code, expiresAt });
  } catch (error) { next(error); }
});

router.post('/accept', async (req, res, next) => {
  try {
    requireAccount(req.reader);
    if (isMinor(req.reader) || typeof req.body.code !== 'string') fail(403, '请使用监护人的成人账号');
    const tokenHash = createHash('sha256').update(req.body.code.trim()).digest('hex');
    await prisma.$transaction(async tx => {
      const invite = await tx.guardianInvite.findUnique({ where: { tokenHash } });
      if (!invite || invite.usedAt || invite.expiresAt < new Date() || invite.childId === req.reader.id) fail(400, '邀请码无效或已过期');
      const used = await tx.guardianInvite.updateMany({ where: { tokenHash, usedAt: null }, data: { usedAt: new Date() } });
      if (!used.count) fail(409, '邀请码已使用');
      const linked = await tx.readerProfile.updateMany({ where: { id: invite.childId, guardianId: null }, data: { guardianId: req.reader.id, settingsRevision: { increment: 1 } } });
      if (!linked.count) fail(409, '该账号已有监护人');
    });
    res.json({ linked: true });
  } catch (error) { next(error); }
});

router.get('/children', async (req, res, next) => {
  try {
    requireAccount(req.reader);
    const children = await prisma.readerProfile.findMany({ where: { guardianId: req.reader.id } });
    res.json({ children: children.map(publicProfile) });
  } catch (error) { next(error); }
});

router.patch('/children/:id', async (req, res, next) => {
  try {
    const child = await prisma.readerProfile.findFirst({ where: { id: req.params.id, guardianId: req.reader.id } });
    if (!child) fail(404, '未找到绑定的儿童账号');
    if (!Number.isInteger(req.body.revision)) fail(400, '缺少设置版本');
    const permissions = { ...child.permissions };
    for (const key of ['generation', 'diagnosis', 'nearby']) {
      if (key in (req.body.permissions || {})) {
        if (typeof req.body.permissions[key] !== 'boolean') fail(400, '许可值必须为布尔值');
        permissions[key] = req.body.permissions[key];
      }
    }
    if (req.body.disabledPreferences !== undefined) {
      const allowed=['language','style','voice','purpose','modality','level','adaptive'];
      if (!req.body.disabledPreferences || Object.entries(req.body.disabledPreferences).some(([key,value])=>!allowed.includes(key)||typeof value!=='boolean')) fail(400,'偏好控制格式错误');
      permissions.disabledPreferences={...permissions.disabledPreferences,...req.body.disabledPreferences};
    }
    const data = { permissions, settingsRevision: { increment: 1 } };
    if (req.body.resetPreferences) data.preferences = permissions.personalization === false ? {personalization:false} : {};
    if (req.body.personalization !== undefined) {
      if (typeof req.body.personalization !== 'boolean') fail(400, '偏好开关格式错误');
      permissions.personalization = req.body.personalization;
      data.preferences = { ...(data.preferences || child.preferences), personalization: req.body.personalization };
    }
    const result = await prisma.readerProfile.updateMany({ where: { id: child.id, guardianId: req.reader.id, settingsRevision: req.body.revision }, data });
    if (!result.count) fail(409, '设置已更新，请刷新');
    res.json({ saved: true });
  } catch (error) { next(error); }
});

router.get('/children/:id/report', async (req, res, next) => {
  try {
    const child = await prisma.readerProfile.findFirst({ where: { id: req.params.id, guardianId: req.reader.id } });
    if (!child) fail(404, '未找到绑定的儿童账号');
    res.json({ report: await readerReport(child.id,7), preferences: child.preferences });
  } catch (error) { next(error); }
});

export default router;
