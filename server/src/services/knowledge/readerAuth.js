import jwt from 'jsonwebtoken';
import prisma from '../../config/db.js';
import { fail } from './policy.js';

/** 账号 JWT 与设备 JWT 分开，绝不当作后台管理员凭证。 */
export function readerToken(profile) {
  return jwt.sign({ sub: profile.id, type: 'reader' }, process.env.JWT_SECRET || 'flipbook-jwt-secret-2024', { expiresIn: '30d' });
}

/** 一个账号一份轨迹；没有账号的设备先获得可迁移的本地身份。 */
export async function resolveReader(req, _res, next) {
  try {
    const token = req.headers['x-reader-token'];
    if (token) {
      let payload;
      try { payload = jwt.verify(token, process.env.JWT_SECRET || 'flipbook-jwt-secret-2024'); }
      catch { fail(401, '账号登录已过期，请重新登录'); }
      if (payload.type !== 'reader') fail(401, '账号凭证无效');
      req.reader = await prisma.readerProfile.findUnique({ where: { id: payload.sub } });
      if (!req.reader) fail(401, '账号不存在');
    } else {
      if (!req.deviceId) fail(401, '请先注册设备');
      req.reader = await prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`device:${req.deviceId}`}))::text`;
        const existing = await tx.readerProfile.findUnique({where:{deviceId:req.deviceId}});
        // 已注册账号必须使用账号凭证，退出后设备凭证不能重新打开该账号。
        if (existing?.username) await tx.readerProfile.update({where:{id:existing.id},data:{deviceId:null}});
        if (existing && !existing.username) return existing;
        return tx.readerProfile.create({data:{deviceId:req.deviceId}});
      });
    }
    next();
  } catch (error) { next(error); }
}

/** 只输出公开个人配置，不返回密码摘要或设备绑定信息。 */
export function publicProfile(profile) {
  const { passwordHash, deviceId, ...safe } = profile;
  return safe;
}

/** 账号操作要求注册过的独立身份。 */
export function requireAccount(profile) {
  if (!profile.username) fail(403, '请先创建或登录账号');
}

/** 为旧客户端统一执行新权限；旧生成接口不能绕过安全模式。 */
export async function guardLegacyGeneration(req, res, next) {
  await resolveReader(req, res, async error => {
    if (error) return next(error);
    try {
      const { assertGeneration } = await import('./policy.js');
      assertGeneration(req.reader);
      next();
    } catch (err) { next(err); }
  });
}
