import { fail, monthPeriod } from './policy.js';

/** 新读者看到的默认额度与首次生成时使用同一配置。 */
export async function defaultAllowance(db) {
  const config = await db.globalConfig.findUnique({ where: { key: 'knowledge_monthly_allowance' } });
  return Math.max(0, Number.parseInt(config?.value || '0', 10) || 0);
}

/** 月度权益只对实际生成占用；缓存不收费，失败事务返还。 */
export async function reserveAllowance(tx, profile) {
  const { period, expiresAt } = monthPeriod();
  const allowance = await defaultAllowance(tx);
  await tx.readerEntitlement.upsert({ where: { profileId_period: { profileId: profile.id, period } }, create: { profileId: profile.id, period, expiresAt, allowance }, update: {} });
  const reserved = await tx.readerEntitlement.updateMany({ where: { profileId: profile.id, period, consumed: { lt: tx.readerEntitlement.fields.allowance }, expiresAt: { gt: new Date() } }, data: { consumed: { increment: 1 } } });
  if (!reserved.count) fail(402, '本月生成额度不足；仍可免费探索公共知识树和已有内容');
  return period;
}

