import { Router } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../../config/db.js';
import { readerToken, publicProfile } from '../../services/knowledge/readerAuth.js';
import { fail, textValue } from '../../services/knowledge/policy.js';

const router = Router();
const attempts = new Map();

/** 按设备限制登录尝试；账号名不写入访问日志。 */
function limitLogin(req) {
  const key = req.deviceId; const now = Date.now();
  const entry = attempts.get(key) || { until: now + 60000, count: 0 };
  if (entry.until < now) { entry.until = now + 60000; entry.count = 0; }
  if (++entry.count > 12) fail(429, '尝试过于频繁，请稍后重试');
  attempts.set(key, entry);
  if (attempts.size > 10000) for (const [id, item] of attempts) if (item.until < now) attempts.delete(id);
}

router.post('/register', async (req, res, next) => {
  try {
    limitLogin(req);
    if (req.reader.username) fail(409, '当前账号已经注册');
    const username = textValue(req.body.username, '账号', 64).toLowerCase();
    const password = req.body.password;
    if (!/^[a-z0-9_@.\-]{3,64}$/.test(username) || typeof password !== 'string' || password.length < 10 || password.length > 128) fail(400, '账号至少 3 个字符，密码需要 10 至 128 位');
    const ageBand = req.body.ageBand === 'adult' && !req.reader.guardianId ? 'adult' : 'minor';
    const profile = await prisma.readerProfile.update({ where: { id: req.reader.id }, data: { username, passwordHash: await bcrypt.hash(password, 12),
      displayName: textValue(req.body.displayName || '探索者', '昵称', 40), ageBand } });
    res.json({ token: readerToken(profile), profile: publicProfile(profile) });
  } catch (error) { next(error.code === 'P2002' ? Object.assign(new Error('账号已存在'), { status: 409 }) : error); }
});

router.post('/login', async (req, res, next) => {
  try {
    limitLogin(req);
    const username = textValue(req.body.username, '账号', 64).toLowerCase();
    const profile = await prisma.readerProfile.findUnique({ where: { username } });
    if (typeof req.body.password !== 'string' || !profile?.passwordHash || !await bcrypt.compare(req.body.password, profile.passwordHash)) fail(401, '账号或密码错误');
    res.json({ token: readerToken(profile), profile: publicProfile(profile) });
  } catch (error) { next(error); }
});

router.patch('/settings', async (req, res, next) => {
  try {
    const { mode, selectedTreeId, preferences, revision } = req.body;
    if (!Number.isInteger(revision)) fail(400, '缺少设置版本');
    const data = { settingsRevision: { increment: 1 } };
    if (mode !== undefined) {
      if (!['safe', 'infinite'].includes(mode)) fail(400, '无效模式');
      data.mode = mode;
    }
    if (selectedTreeId !== undefined) {
      if (!await prisma.knowledgeTree.findFirst({ where: { id: selectedTreeId, status: 'published' } })) fail(404, '这棵公共树尚未发布');
      data.selectedTreeId = selectedTreeId;
    }
    if (preferences !== undefined) {
      const allowed = ['language', 'style', 'voice', 'purpose', 'modality', 'level', 'personalization', 'adaptive'];
      if (!preferences || Array.isArray(preferences) || Object.entries(preferences).some(([k,v]) => !allowed.includes(k) || !['string','boolean'].includes(typeof v) || String(v).length > 80)) fail(400, '偏好格式不正确');
      if (preferences.language && !['zh', 'en'].includes(preferences.language)) fail(400, '暂支持中文和英文');
      if (preferences.modality && !['image', 'text'].includes(preferences.modality)) fail(400, '请选择图像或文字');
      data.preferences = { ...preferences };
      if (req.reader.guardianId && req.reader.permissions?.personalization === false) data.preferences.personalization = false;
    }
    const result = await prisma.readerProfile.updateMany({ where: { id: req.reader.id, settingsRevision: revision }, data });
    if (!Number.isInteger(revision) || result.count !== 1) fail(409, '设置已在其他设备更新，请刷新后重试');
    res.json({ profile: publicProfile(await prisma.readerProfile.findUnique({ where: { id: req.reader.id } })) });
  } catch (error) { next(error); }
});

export default router;
