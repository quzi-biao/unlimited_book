import { fail } from './policy.js';

export const EVENT_TYPES = ['open', 'dwell', 'review', 'connect', 'note'];
const REVIEW_DAYS = [1, 3, 7, 14, 30, 60];

/** 轨迹只描述行为；掌握自评由用户发起，不以停留时长判断思想。 */
export function applyEvent(node, event, now = new Date()) {
  const when = new Date(event.occurredAt);
  if (!EVENT_TYPES.includes(event.type) || !Number.isFinite(+when) || +when > +now + 300000) fail(400, '学习事件格式不正确');
  const payload = event.payload || {};
  const data = {};
  if (event.type === 'open') {
    data.visits = node.visits + 1;
    data.openedAt = node.openedAt && node.openedAt < when ? node.openedAt : when;
    data.lastSeenAt = !node.lastSeenAt || node.lastSeenAt < when ? when : node.lastSeenAt;
    data.mastery = Math.max(node.mastery, 1);
    if (!node.nextReviewAt) data.nextReviewAt = new Date(+when + 86400000);
  }
  if (event.type === 'dwell') {
    if (!Number.isInteger(payload.seconds) || payload.seconds < 0 || payload.seconds > 300) fail(400, '停留时间必须在 0 到 300 秒之间');
    data.dwellSeconds = node.dwellSeconds + payload.seconds;
  }
  if (event.type === 'review') {
    if (!['again', 'remembered', 'understood'].includes(payload.rating)) fail(400, '请选择回想状态');
    const step = payload.rating === 'again' ? 0 : Math.min(node.reviewStep + 1, REVIEW_DAYS.length - 1);
    data.reviewStep = step;
    data.mastery = payload.rating === 'again' ? 1 : Math.max(node.mastery, payload.rating === 'understood' ? 4 : 2);
    data.nextReviewAt = new Date(+when + REVIEW_DAYS[step] * 86400000);
  }
  if (event.type === 'connect') {
    if (typeof payload.targetId !== 'string' || typeof payload.reason !== 'string' || !payload.reason.trim() || payload.reason.length > 2000) fail(400, '请写下你看到的连接');
    data.mastery = Math.max(node.mastery, 3);
  }
  if (event.type === 'note') {
    if (typeof payload.text !== 'string' || payload.text.length > 8000) fail(400, '笔记过长');
    // 笔记事件永久保留；显示值由时间戳／事件 ID 在同步服务中确定。
    data.note = payload.text;
  }
  return data;
}

/** 离线自评可能乱序到达，掌握与复习状态按原始发生顺序确定性重放。 */
export function replayProgress(events) {
  let state={mastery:0,reviewStep:0,nextReviewAt:null,visits:0,openedAt:null,lastSeenAt:null};
  for (const event of events) state={...state,...applyEvent(state,event)};
  return {mastery:state.mastery,reviewStep:state.reviewStep,nextReviewAt:state.nextReviewAt};
}

export { connectionSuggestions } from './recommendations.js';

/** 观察报告只呈现事实、表达与对话入口，没有覆盖率、排名或人格判断。 */
export function observationReport(nodes, events, days, now = new Date()) {
  const since = +now - days * 86400000;
  const recent = events.filter(e => +new Date(e.occurredAt) >= since);
  const branches = nodes.filter(n => n.openedAt && +new Date(n.openedAt) >= since).map(n => ({ title: n.asset.title, domain: n.asset.domain }));
  return { days, branches, opened: recent.filter(e => e.type === 'open').length,
    revisits: nodes.filter(n => n.visits > 1 && n.lastSeenAt && +new Date(n.lastSeenAt) >= since).map(n => n.asset.title),
    expressions: recent.filter(e => ['note', 'connect'].includes(e.type)).map(e => ({ type: e.type, text: e.payload.text || e.payload.reason })),
    conversation: branches.length ? `关于「${branches[0].title}」，你发现了什么想和我分享的事？` : '最近有什么让你好奇的问题？' };
}
