import { useState, useEffect, useRef } from 'react';
import styles from './TtsPlayer.module.css';
import { Icon } from '../common/Icons.jsx';

/**
 * TtsPlayer — 对应 Android TtsPlayer.kt
 *
 * Props:
 *   pageVisible   : boolean  — toolbar 可见时才渲染（对应 Android pageVisible）
 *   uiState       : TtsPlayerUiState
 *   onRoundClick  : () => void
 *   onPlayPause   : () => void
 *   onSeek        : (sec: number) => void
 *   onRateToggle  : () => void
 *   onGoToPage    : (pageId: string) => void | null
 */
export function TtsPlayer({
  pageVisible,
  uiState,
  onRoundClick,
  onPlayPause,
  onSeek,
  onRateToggle,
  onGoToPage,
}) {
  if (!pageVisible) return null;

  const { playbackState, rate, currentTimeSec, durationSec, title, annotationMode, sourcePageId } = uiState;
  const isLoading = playbackState === 'loading';
  const isPlaying = playbackState === 'playing';
  const isPaused  = playbackState === 'paused';
  const isError   = playbackState === 'error';
  const isIdle    = playbackState === 'idle';

  // 对应 Android：idle/paused/error → 圆形按钮；loading/playing → 胶囊弹窗
  const showPill   = isLoading || isPlaying;
  const showRound  = !showPill;

  // 胶囊弹窗展开/收起动画
  const [pillVisible, setPillVisible] = useState(false);
  const [pillEntered, setPillEntered] = useState(false);
  const collapseTimer = useRef(null);

  useEffect(() => {
    clearTimeout(collapseTimer.current);
    if (showPill) {
      setPillVisible(true);
      // 下一帧触发 enter 动画（对应 Android withFrameNanos）
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setPillEntered(true));
      });
    } else {
      setPillEntered(false);
      collapseTimer.current = setTimeout(() => setPillVisible(false), 280);
    }
    return () => clearTimeout(collapseTimer.current);
  }, [showPill]);

  const sliderMax   = durationSec > 0 ? durationSec : 100;
  const sliderValue = Math.max(0, Math.min(currentTimeSec, sliderMax));
  const canSeek     = durationSec > 0 && !isLoading;
  const goToEnabled = !!onGoToPage && !!sourcePageId;

  return (
    <div className={styles.wrapper}>
      {/* ── 圆形按钮（idle / paused / error）─────────────── */}
      {showRound && (
        <button
          className={`${styles.roundBtn} ${isPaused ? styles.roundBtnPaused : isError ? styles.roundBtnError : styles.roundBtnIdle}`}
          onClick={onRoundClick}
          aria-label={isPaused ? '继续播放' : isError ? '播放失败' : '语音播报'}
        >
          {isError  && <Icon name="soundOff" size={20} />}
          {isPaused && <Icon name="play"     size={20} />}
          {isIdle   && <Icon name="soundOn"  size={20} />}
        </button>
      )}

      {/* ── 胶囊弹窗（loading / playing）───────────────── */}
      {pillVisible && (
        <div
          className={`${styles.pill} ${pillEntered ? styles.pillEntered : ''}`}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* 左侧内容列 */}
          <div className={styles.pillContent}>
            {/* 标题行 */}
            <div
              className={`${styles.titleRow} ${goToEnabled ? styles.titleRowClickable : ''}`}
              onClick={goToEnabled ? () => onGoToPage(sourcePageId) : undefined}
            >
              {annotationMode && (
                <span className={styles.annBadge}>区域解读</span>
              )}
              <span className={styles.titleText}>{title}</span>
            </div>

            {/* 进度条 */}
            <ProgressLine
              value={sliderValue}
              max={sliderMax}
              canSeek={canSeek}
              onSeek={onSeek}
            />

            {/* 底部：倍速 + 时间 */}
            <div className={styles.metaRow}>
              <button
                className={styles.rateBtn}
                onClick={onRateToggle}
                aria-label="切换倍速"
              >
                {rate}x
              </button>
              <span className={styles.timeText}>
                {durationSec > 0
                  ? `${fmt(sliderValue)} / ${fmt(durationSec)}`
                  : fmt(sliderValue)}
              </span>
            </div>
          </div>

          {/* 播放/暂停按钮（右侧） */}
          <button
            className={`${styles.pillPlayBtn} ${isLoading ? styles.pillPlayBtnLoading : isPlaying ? styles.pillPlayBtnPlaying : styles.pillPlayBtnPaused}`}
            onClick={isLoading ? undefined : onPlayPause}
            aria-label={isPlaying ? '暂停' : '播放'}
          >
            {isLoading && <span className={styles.pillSpinner} />}
            {isPlaying  && <Icon name="pause"     size={22} />}
            {!isLoading && !isPlaying && <Icon name="play" size={22} />}
          </button>
        </div>
      )}
    </div>
  );
}

// ── 进度条（对应 Android ProgressLine）──────────────────────

function ProgressLine({ value, max, canSeek, onSeek }) {
  const trackRef = useRef(null);
  const ratio = canSeek && max > 0 ? Math.min(value / max, 1) : 0;

  function handleClick(e) {
    if (!canSeek || !trackRef.current) return;
    const rect  = trackRef.current.getBoundingClientRect();
    const pct   = Math.max(0, Math.min((e.clientX - rect.left) / rect.width, 1));
    onSeek?.(pct * max);
  }

  return (
    <div
      ref={trackRef}
      className={`${styles.progressTrack} ${canSeek ? styles.progressTrackSeekable : ''}`}
      onClick={handleClick}
    >
      <div className={styles.progressBg} />
      <div className={styles.progressFill} style={{ width: `${ratio * 100}%` }} />
      <div className={styles.progressThumb} style={{ left: `${ratio * 100}%` }} />
    </div>
  );
}

// ── 时间格式化 ────────────────────────────────────────────────

function fmt(sec) {
  if (!isFinite(sec) || sec < 0) return '--:--';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
