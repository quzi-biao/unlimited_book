import { useEffect, useRef, useCallback } from 'react';
import styles from './ExploreQueue.module.css';
import { Icon } from '../common/Icons.jsx';
import { useAppState } from '../../contexts/AppStateContext.jsx';

/**
 * ExploreQueueBtn — 对应 Android ExploreQueueBtn.kt
 * 胶囊形状，显示"探索任务/探索结果 (done/total)"，有呼吸光晕
 * 位置由父层（App.jsx）的 CSS 决定（右上角）
 */
export function ExploreQueueBtn({ open, onToggle }) {
  const { state } = useAppState();
  const queue = state.exploreQueue;
  if (queue.length === 0) return null;

  const total     = queue.length;
  const doneCount = queue.filter((t) => t.status === 'done').length;
  const hasActive = queue.some((t) => t.status === 'loading');
  const hasDone   = doneCount > 0;

  const label      = hasActive ? '探索任务' : '探索结果';
  const accentColor = hasDone ? '#fb923c' : '#818cf8';
  const borderColor = hasDone ? 'rgba(251,146,60,0.55)' : 'rgba(99,102,241,0.45)';
  const cardBg      = hasDone ? 'rgba(45,20,5,0.88)' : 'rgba(22,18,46,0.85)';
  const textColor   = hasDone ? '#fed7aa' : '#c7d2fe';
  const glowColor   = hasDone ? '#fb923c' : '#6366f1';

  return (
    <button
      className={`${styles.pill} ${open ? styles.pillOpen : ''}`}
      style={{ '--accent': accentColor, '--border': borderColor, '--bg': cardBg, '--text': textColor, '--glow': glowColor }}
      onClick={onToggle}
      aria-label="探索队列"
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
export function ExploreQueuePanel({ open, onClose, onNavigate, onRetry }) {
  const { state, dispatch } = useAppState();
  const queue = state.exploreQueue;

  if (!open || queue.length === 0) return null;

  const dismiss = useCallback((id) => {
    dispatch({ type: 'REMOVE_EXPLORE_TASK', id });
  }, [dispatch]);

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={`${styles.panel} glass-strong`}>
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <Icon name="sparkles" size={15} color="#818cf8" />
            探索队列
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="关闭">
            <Icon name="close" size={16} />
          </button>
        </div>

        <ul className={styles.taskList}>
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
function TaskItem({ task, onDismiss, onNavigate, onRetry }) {
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
        {failed && (
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
            aria-label="关闭"
          >
            <Icon name="close" size={12} />
          </button>
        )}
      </div>
    </li>
  );
}
