import styles from './AnnotationLayer.module.css';

/**
 * AnnotationLayer — 标注圆点 + 区域高亮覆盖层
 * 对应 Android: AnnotationDots.kt + RegionHighlight.kt
 */
export function AnnotationLayer({ annotations, imgRef, activeAnnotationId, ttsState, ttsSrcId, calloutOpen, onDotClick }) {
  if (!imgRef.current || !annotations.length) return null;

  const imgRect = imgRef.current.getBoundingClientRect();

  // 当前激活/TTS 播放中的标注，用于矩形高亮
  const activeAnn = annotations.find((a) => a.id === activeAnnotationId);
  const ttsAnn    = !calloutOpen && ttsSrcId ? annotations.find((a) => a.id === ttsSrcId) : null;
  const highlightAnn = activeAnn || ttsAnn;

  const isPlaying = ttsState === 'playing';
  const isPaused  = ttsState === 'paused';

  return (
    <div
      className={styles.layer}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      {/* 区域高亮矩形框 — 对应 Android RegionHighlight.kt */}
      {highlightAnn && (
        <div
          className={`${styles.highlight} ${isPlaying ? styles.highlightPlaying : isPaused ? styles.highlightPaused : ''}`}
          style={{
            left:   `${highlightAnn.x * 100}%`,
            top:    `${highlightAnn.y * 100}%`,
            width:  `${(highlightAnn.w || 0.08) * 100}%`,
            height: `${(highlightAnn.h || 0.08) * 100}%`,
          }}
        />
      )}

      {/* 标注圆点 */}
      {annotations.map((ann) => {
        const cx = (ann.x + (ann.w || 0) / 2) * imgRect.width;
        const cy = (ann.y + (ann.h || 0) / 2) * imgRect.height;
        const isActive   = ann.id === activeAnnotationId;
        const isTtsPlay  = !calloutOpen && ann.id === ttsSrcId && ttsState === 'playing';
        const isTtsPause = !calloutOpen && ann.id === ttsSrcId && ttsState === 'paused';

        return (
          <button
            key={ann.id}
            className={`${styles.dot} ${isActive ? styles.dotActive : ''} ${isTtsPlay ? styles.dotPlaying : ''} ${isTtsPause ? styles.dotPaused : ''}`}
            style={{ left: cx, top: cy }}
            onClick={(e) => { e.stopPropagation(); onDotClick?.(ann); }}
            aria-label="查看标注"
          />
        );
      })}
    </div>
  );
}
