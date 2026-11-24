import { MarkdownRenderer } from '../common/MarkdownRenderer.jsx';
import { Icon } from '../common/Icons.jsx';
import styles from './Viewport.module.css';

// ── Callout 组件（对应 Android AnnotationCallout.kt）─────────────────────────
/**
 * @param {{ callout, imgRef, onClose, onExpand, onTabChange, onPlay, ttsState }}
 */
export function Callout({ callout, imgRef, onClose, onExpand, onTabChange, onPlay, ttsState }) {
  const imgRect = imgRef.current?.getBoundingClientRect() ?? { width: 1, height: 1 };

  // 使用 calcCalloutPos 的结果（已是像素，转 %）
  const leftPct = (callout.left / imgRect.width)  * 100;
  const topPct  = (callout.top  / imgRect.height) * 100;

  const active     = callout.annotations?.[callout.activeIdx ?? 0];
  const isMulti    = (callout.annotations?.length ?? 0) > 1;
  const isPending  = callout.pending;
  const text       = active?.explanation || callout.identification?.description || '';
  const alreadyExplored = !!active?.exploredPageId;

  const isPlaying    = ttsState === 'playing';
  const isPaused     = ttsState === 'paused';
  const isTtsLoading = ttsState === 'loading';
  const isTtsError   = ttsState === 'error';

  // 深入探索按钮样式（对应 Android deepBtn / deepBtnLoaded）
  const deepStyle = alreadyExplored
    ? { background: 'rgba(34,211,238,0.1)', borderColor: 'rgba(34,211,238,0.45)', color: '#67e8f9' }
    : { background: 'var(--color-gold-glow)', borderColor: 'var(--color-border-hover)', color: 'var(--color-gold)' };

  // 播放按钮样式（对应 Android playBtn）
  const playBg     = isPlaying ? 'rgba(16,185,129,0.2)' : isPaused ? 'rgba(245,158,11,0.2)' : isTtsError ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.06)';
  const playBorder = isPlaying ? 'rgba(16,185,129,0.6)' : isPaused ? 'rgba(245,158,11,0.6)' : isTtsError ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.15)';
  const playColor  = isPlaying ? '#34d399' : isPaused ? '#fbbf24' : isTtsError ? '#f87171' : 'rgba(255,255,255,0.5)';

  return (
    <div
      className={`${styles.callout} glass-strong`}
      style={{ left: `${Math.min(leftPct, 72)}%`, top: `${Math.max(topPct, 2)}%` }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}  /* 防止 mousedown 冒泡触发框选/关闭 callout */
    >
      {/* Header */}
      <div className={styles.calloutHeader}>
        <Icon name="lightbulb" size={14} color="var(--color-gold)" />
        {isMulti && !isPending ? (
          <div className={styles.calloutTabs}>
            {callout.annotations.map((_, idx) => (
              <button
                key={idx}
                className={`${styles.calloutTab} ${idx === callout.activeIdx ? styles.calloutTabActive : ''}`}
                onClick={() => onTabChange(idx)}
              >
                知识点 {idx + 1}
              </button>
            ))}
          </div>
        ) : (
          <span className={styles.calloutType}>区域解读</span>
        )}
        <button className="btn-icon" style={{ width: 26, height: 26, flexShrink: 0 }} onClick={onClose} aria-label="关闭">
          <Icon name="close" size={14} />
        </button>
      </div>

      {/* Divider */}
      <div className={styles.calloutDivider} />

      {/* Body */}
      <div className={styles.calloutBody}>
        {isPending ? (
          <div className={styles.calloutLoading}>
            <div className={styles.calloutSpinner} />
            <span>AI 正在深度解读，请稍候…</span>
          </div>
        ) : (
          <MarkdownRenderer content={text || '未识别到内容'} className={styles.calloutMarkdown} />
        )}
      </div>

      {/* Footer */}
      {!isPending && (
        <>
          <div className={styles.calloutDividerLight} />
          <div className={styles.calloutFooter}>
            {/* 深入探索按钮 */}
            <button
              className={styles.calloutDeepBtn}
              style={deepStyle}
              onClick={onExpand}
              aria-label="深入探索"
            >
              <Icon name="expand" size={13} />
              {alreadyExplored ? '已探索' : '深入探索'}
            </button>

            {/* TTS 播放按钮 */}
            {onPlay && (
              <button
                style={{ width: 28, height: 28, borderRadius: '50%', border: `1px solid ${playBorder}`, background: playBg, color: playColor, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isTtsLoading ? 'default' : 'pointer', flexShrink: 0, padding: 0 }}
                disabled={isTtsLoading}
                onClick={onPlay}
                aria-label={isPlaying ? '暂停朗读' : '朗读'}
              >
                {isTtsLoading
                  ? <div className={styles.calloutSpinnerSm} />
                  : isPlaying
                  ? <Icon name="pause" size={12} />
                  : <Icon name="volume" size={12} />}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
