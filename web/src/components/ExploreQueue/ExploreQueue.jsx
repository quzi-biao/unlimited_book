import { useEffect, useRef, useCallback } from 'react';
import styles from './ExploreQueue.module.css';
import { Icon } from '../common/Icons.jsx';
import { useAppState } from '../../contexts/AppStateContext.jsx';

/**
 * ExploreQueueBtn — 对应 Android ExploreQueueBtn.kt
 * 胶囊形状，显示"探索任务/探索结果 (done/total)"，有呼吸光晕
 * 位置由父层（App.jsx）的 CSS 决定（右上角）
 */
export function ExploreQueueBtn({ jobs, open, onToggle }) {
  const { state } = useAppState();
  const queue = [...state.exploreQueue, ...jobs];
  if (queue.length === 0) return null;

  const total     = queue.length;
  const doneCount = queue.filter((t) => t.status === 'done').length;
  const hasActive = queue.some((t) => !['done','failed'].includes(t.status));
  const hasFailed = queue.some((t) => t.status === 'failed');

  const label      = hasActive ? '探索任务' : '探索结果';
  const accentColor = hasActive ? '#f0c060' : hasFailed ? '#f87171' : '#4ade80';
  const borderColor = hasActive ? 'rgba(240,192,96,0.4)' : hasFailed ? 'rgba(248,113,113,0.4)' : 'rgba(74,222,128,0.4)';
  const cardBg      = hasActive ? 'rgba(35,29,16,0.92)' : hasFailed ? 'rgba(38,18,23,0.92)' : 'rgba(15,31,25,0.92)';
  const textColor   = hasActive ? '#f1deb3' : hasFailed ? '#fecaca' : '#d1fae5';
  const glowColor   = accentColor;

  return (
    <button
      className={`${styles.pill} ${open ? styles.pillOpen : ''}`}
      style={{ '--accent': accentColor, '--border': borderColor, '--bg': cardBg, '--text': textColor, '--glow': glowColor }}
      onClick={onToggle}
      aria-label="探索队列"
      aria-expanded={open}
      aria-controls="explore-queue-panel"
      id="btn-explore-queue"
    >
      {/* 呼吸光晕 */}
      <span className={styles.pillGlow} />

      {/* 旋转图标 or 静态圆点 */}
      {hasActive
        ? <span className={styles.pillSpinner} style={{ borderTopColor: accentColor, borderLeftColor: accentColor }} />
        : <span className={styles.pillDot} style={{ background: accentColor }} />}

      <span className={styles.pillLabel}>{label}</span>
      <span className={styles.pillCount} style={{ color: accentColor }}>({doneCount}/{total})</span>
    </button>
  );
}

/**
 * ExploreQueuePanel — 对应 Android ExploreQueuePanel.kt
 */
export function ExploreQueuePanel({ knowledge, open, onClose, onNavigate, onRetry }) {
  const { state, dispatch } = useAppState();
  const queue = state.exploreQueue;
  const panel = useRef(null);
  const total = queue.length + knowledge.jobs.length;
  useEffect(() => {
    if (!open) return;
    if (!total) { onClose(); return; }
    const outside = e => {
      if (!panel.current?.contains(e.target) && !e.target.closest?.('#btn-explore-queue')) onClose();
    };
    const escape = e => { if (e.key === 'Escape') { onClose(); document.getElementById('btn-explore-queue')?.focus(); } };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open, total, onClose]);

  const dismiss = useCallback((id) => {
    dispatch({ type: 'REMOVE_EXPLORE_TASK', id });
  }, [dispatch]);

  if (!open || !total) return null;

  return (
    <>
      <div ref={panel} role="region" aria-label="探索队列" className={`${styles.panel} glass-strong`} id="explore-queue-panel">
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <Icon name="sparkles" size={15} color="#f0c060" />
            探索队列
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="关闭">
            <Icon name="close" size={16} />
          </button>
        </div>

        <ul className={styles.taskList}>
          {knowledge.jobs.map(job => {
            const waiting = job.status === 'paused' && job.error && !knowledge.safe;
            const loading = job.status === 'running';
            const task = {id:job.id, bookTitle:job.input.query, pageId:job.assetKey,
              status: loading ? 'loading' : job.status,
              sourcePageTitle:loading ? '正在生成' : job.status === 'done' ? '已完成' : job.error || '待执行'};
            return <TaskItem key={job.id} task={task} progress={loading || waiting}
              canRetry={!knowledge.safe && !loading && job.status !== 'done'}
              onRetry={()=>knowledge.retryJob(job)} onDismiss={knowledge.removeJob}
              onNavigate={()=>knowledge.openJob(job.assetKey)} />;
          })}
          {queue.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              onDismiss={dismiss}
              onRetry={onRetry}
              onNavigate={(pageId, imageUrl, bookId) => {
                onNavigate?.(pageId, imageUrl, bookId);
                onClose();
              }}
            />
          ))}
        </ul>
      </div>
    </>
  );
}

/** 单条任务行 */
function TaskItem({ task, onDismiss, onNavigate, onRetry, canRetry = task.status === 'failed', progress = task.status === 'loading' }) {
  const done    = task.status === 'done';
  const failed  = task.status === 'failed';
  const loading = task.status === 'loading';

  return (
    <li className={`${styles.taskItem} ${done ? styles.done : failed ? styles.failed : ''}`}>
      <div className={styles.taskIcon}>
        {loading && <span className={styles.spinner} />}
        {done    && <Icon name="check"   size={14} color="#34d399" />}
        {failed  && <Icon name="warning" size={14} color="#f87171" />}
      </div>

      <div className={styles.taskBody}>
        <p className={styles.taskLabel}>{task.bookTitle || '未命名'}</p>
        <p className={styles.taskSub}>
          {task.sourcePageTitle || '—'}
        </p>
        {progress && <span className={styles.progress} role="progressbar" aria-label={`${task.bookTitle || task.label}：正在生成`} />}
      </div>

      <div className={styles.taskActions}>
        {done && task.pageId && (
          <button
            className={styles.taskViewBtn}
            onClick={() => onNavigate(task.pageId, task.imageUrl, task.bookId)}
          >
            查看
          </button>
        )}
        {canRetry && (
          <button
            className={styles.taskRetryBtn}
            onClick={() => onRetry?.(task.id)}
          >
            重试
          </button>
        )}
        {!loading && (
          <button
            className="btn-icon"
            style={{ width: 26, height: 26 }}
            onClick={() => onDismiss(task.id)}
            aria-label="移除任务"
          >
            <Icon name="close" size={12} />
          </button>
        )}
      </div>
    </li>
  );
}
