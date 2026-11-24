import { randomBytes } from 'node:crypto';
import { fail } from './policy.js';

// 与认证库隔离的短期内存桶：无账号、无 IP、无持久化、无原始位置。
const permits = new Map();
const buckets = new Map();
const cooldown = new Map();
const TTL = 600000;

/** 颁发匿名单次凭证；凭证容器不存用户 ID。 */
export function nearbyPermit(profileId) {
  if (profileId && (cooldown.get(profileId) || 0) > Date.now()) fail(429, '附近信号十分钟更新一次');
  if (profileId) cooldown.set(profileId, Date.now() + TTL);
  const permit = randomBytes(24).toString('base64url');
  permits.set(permit, Date.now() + TTL);
  prune();
  return { permit, expiresIn: TTL / 1000 };
}

/** 清理已过期的匿名计数，退出或停止上报后自然消失。 */
function prune() {
  const now = Date.now();
  for (const [key, until] of permits) if (until < now) permits.delete(key);
  for (const [key, until] of cooldown) if (until < now) cooldown.delete(key);
  for (const [key, value] of buckets) {
    value.times = value.times.filter(t => t > now - TTL);
    if (!value.times.length) buckets.delete(key);
  }
}

/** 只接收端上粗化到约 1km 网格的位置；邻域距离是近似统计。 */
export function nearbyCount({ permit, cell, topic, radius }) {
  prune();
  if (!permits.has(permit)) fail(403, '邻域凭证无效或过期');
  if (!cell || !Number.isInteger(cell.x) || !Number.isInteger(cell.y) || Math.abs(cell.x) > 18000 || Math.abs(cell.y) > 9000 || ![1,3,5].includes(radius) || !/^[a-f0-9]{64}$/.test(topic || '')) fail(400, '邻域请求格式不正确');
  permits.delete(permit);
  const key = `${topic}:${cell.x}:${cell.y}`;
  const bucket = buckets.get(key) || { topic, x: cell.x, y: cell.y, times: [] };
  bucket.times.push(Date.now()); buckets.set(key, bucket);
  let count = 0;
  for (const item of buckets.values()) {
    const latitude = (item.y + cell.y) / 200;
    const distance = Math.hypot((item.x - cell.x) * Math.cos(latitude * Math.PI / 180), item.y - cell.y) * 1.1132;
    if (item.topic === topic && distance <= radius) count += item.times.length;
  }
  count = Math.max(0, count - 1);
  // 小样本隐藏，避免从单次查询确认另一个人是否存在。
  return { count: count >= 5 ? count : null, approximate: true, windowMinutes: 10, message: count >= 5 ? '附近有同行的探索者' : '附近信号较少，暂不显示人数' };
}
