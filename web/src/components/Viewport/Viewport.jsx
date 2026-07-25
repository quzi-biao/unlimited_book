import { useState, useRef, useCallback, useEffect } from 'react';
import { useAppState } from '../../contexts/AppStateContext.jsx';
import { explainRegion, cropRegion } from '../../api/ai.js';
import { getAnnotations, createAnnotation, updateAnnotation } from '../../api/annotations.js';
import { normalizeRect } from '../../utils/canvas.js';
import { findDuplicate } from '../../utils/annotationGroup.js';
import { calcCalloutPos } from '../../utils/calloutUtils.js';
import { AnnotationLayer } from './AnnotationLayer.jsx';
import { SelectionBox } from './SelectionBox.jsx';
import { LoadingSpinner } from '../common/LoadingSpinner.jsx';
import { MarkdownRenderer } from '../common/MarkdownRenderer.jsx';
import { Icon, AppLogo } from '../common/Icons.jsx';
import styles from './Viewport.module.css';

/**
 * Viewport — 主图片画布
 * 对应 Android: components/Viewport/Viewport.kt
 *
 * 交互流程（对齐 Android）：
 * 1. 框选松手 → 立即显示 pending callout（loading 状态）
 * 2. 后台 crop + identify + createAnnotation
 * 3. 完成 → 更新 callout 为结果（若用户已关闭则不重开）
 * 4. 点击圆点 → 打开对应标注的 callout（支持多标注 tabs）
 * 5. exploredPageId 变化时 callout 同步更新
 */
export function Viewport({ onToast, onExpandRegion, onToggleToolbar, ttsState, ttsSrcId, onPlayAnnotation, onCalloutChange }) {
  const { state, dispatch, setCurrentPage } = useAppState();
  const { currentImageUrl, currentPageId, bookFlat, currentBookId, currentBookTitle } = state;

  const containerRef = useRef(null);
  const imgRef       = useRef(null);

  const [imgLoaded, setImgLoaded]   = useState(false);
  const [selection, setSelection]   = useState(null);   // { x1,y1,x2,y2 } 像素（框选中）
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef(null);
  // onClick 与 onMouseUp 都会触发 handleClick，clickHandledRef 用于去重：
  // onMouseUp 已处理时，onClick 跳过，防止两次 toggle 相互抵消。
  const clickHandledRef = useRef(false);

  /**
   * callout: {
   *   pending: bool,          // true = 加载中
   *   left: px, top: px,     // 绝对像素（相对图片）
   *   type: 'region'|'annotation',
   *   // region 类型：
   *   identification: { description, type },
   *   imageBase64, selectionRegion, normBox,
   *   // annotation 类型：
   *   annotations: [ AnnotationRecord ],
   *   activeIdx: number,
   * }
   */
  const [callout, setCallout]           = useState(null);
  const [annotations, setAnnotations]   = useState([]);
  const userClosedRef = useRef(false);  // 对应 Android userClosedCallout

  // ── 换页时重置 ───────────────────────────────────────────
  useEffect(() => {
    setImgLoaded(false);
    setSelection(null);
    setCallout(null);
    userClosedRef.current = false;
    if (!currentImageUrl) return;
    const img = new Image();
    img.onload = () => setImgLoaded(true);
    img.src = currentImageUrl;
    if (img.complete) setImgLoaded(true);
  }, [currentImageUrl]);

  // ── Callout 可见状态同步 ──────────────────────────────────
  useEffect(() => {
    onCalloutChange?.(!!callout);
  }, [!!callout, onCalloutChange]);

  // ── 加载标注列表 ─────────────────────────────────────────
  useEffect(() => {
    if (!currentPageId) { setAnnotations([]); return; }
    getAnnotations(currentPageId)
      .then((r) => setAnnotations(r.annotations || []))
      .catch(() => {});
  }, [currentPageId]);

  // ── callout 与最新 annotations 同步（对应 syncCalloutWithLatestAnnotations）──
  useEffect(() => {
    setCallout((prev) => {
      if (!prev || prev.pending || prev.type !== 'annotation') return prev;
      const merged = prev.annotations.map(
        (item) => annotations.find((a) => a.id === item.id) ?? item
      );
      const same = merged.every((a, i) => a === prev.annotations[i]);
      return same ? prev : { ...prev, annotations: merged };
    });
  }, [annotations]);

  // ── 键盘翻页 ─────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (!bookFlat.length || !currentPageId) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const idx  = bookFlat.findIndex((p) => p.id === currentPageId);
      if (idx < 0) return;
      const next = bookFlat[e.key === 'ArrowRight' ? idx + 1 : idx - 1];
      if (!next) return;
      setCurrentPage(currentBookId, currentBookTitle, next.id, next.imageUrl);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [bookFlat, currentPageId, currentBookId, currentBookTitle, setCurrentPage]);

  // ── 工具函数 ─────────────────────────────────────────────
  /** 将 clientXY 转为相对图片的像素偏移 */
  const toImgPx = useCallback((clientX, clientY) => {
    const img = imgRef.current;
    if (!img) return { x: 0, y: 0 };
    const rect = img.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  /**
   * 打开标注 callout（对应 reopenCalloutByIndex）
   * @param {Array} annList 标注列表（同组多标注时多个）
   * @param {number} activeIdx
   */
  const openAnnotationCallout = useCallback((annList, activeIdx = 0) => {
    const ann = annList[activeIdx];
    if (!ann || !imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const box  = { x: ann.x * rect.width, y: ann.y * rect.height, w: ann.w * rect.width, h: ann.h * rect.height };
    const { left, top } = calcCalloutPos(box, rect.width, rect.height);
    setCallout({
      pending: false,
      type: 'annotation',
      left,
      top,
      annotations: annList,
      activeIdx,
      // 补充 normBox 和 identification，供深入探索时使用
      normBox: { x: ann.x, y: ann.y, w: ann.w, h: ann.h },
      selectionRegion: { x: ann.x, y: ann.y, w: ann.w, h: ann.h },
      identification: { description: ann.explanation || '' },
      imageBase64: null,  // 点小圆点时无 base64，深入探索时有 fallback
    });
  }, []);

  // ── 标注圆点点击 ─────────────────────────────────────────
  const handleAnnotationDotClick = useCallback((ann) => {
    if (callout?.type === 'annotation' && callout.annotations?.some((a) => a.id === ann.id)) {
      setCallout(null);
      return;
    }
    openAnnotationCallout([ann], 0);
  }, [callout, openAnnotationCallout]);

  // ── 单击空白处 ───────────────────────────────────────────
  const handleClick = useCallback(() => {
    if (isDragging) return;
    if (callout) { setCallout(null); userClosedRef.current = false; }
    else { onToggleToolbar?.(); }
  }, [isDragging, callout, onToggleToolbar]);

  // ── 框选事件 ─────────────────────────────────────────────
  const handleMouseDown = useCallback((e) => {
    if (!currentImageUrl || e.button !== 0) return;
    const imgRect = imgRef.current?.getBoundingClientRect();
    if (!imgRect) return;
    if (e.clientX < imgRect.left || e.clientX > imgRect.right ||
        e.clientY < imgRect.top  || e.clientY > imgRect.bottom) return;
    const px = toImgPx(e.clientX, e.clientY);
    dragStart.current = px;
    setSelection(null);
    // 不在 mousedown 关闭 callout：callout 内按钮的 mousedown 会冒泡触发此处，导致弹窗立即消失
    // 改为在 mouseMove 检测到真实拖拽时再关闭
    setIsDragging(false);
    e.preventDefault();
  }, [currentImageUrl, toImgPx]);

  const handleMouseMove = useCallback((e) => {
    if (!dragStart.current) return;
    const px = toImgPx(e.clientX, e.clientY);
    const dx = Math.abs(px.x - dragStart.current.x);
    const dy = Math.abs(px.y - dragStart.current.y);
    if (dx > 5 || dy > 5) {
      // 确认是真实拖拽后才关闭 callout（而不是在 mousedown 时关闭）
      if (!isDragging) {
        setCallout(null);
        userClosedRef.current = true;
      }
      setIsDragging(true);
      setSelection({ x1: dragStart.current.x, y1: dragStart.current.y, x2: px.x, y2: px.y });
    }
  }, [toImgPx, isDragging]);

  const handleMouseUp = useCallback(async (e) => {
    if (!dragStart.current) return;
    const wasDragging = isDragging;
    dragStart.current = null;
    setIsDragging(false);

    if (!wasDragging) {
      clickHandledRef.current = true;
      handleClick();
      return;
    }
    if (!selection || !currentImageUrl) return;

    const imgRect = imgRef.current?.getBoundingClientRect();
    if (!imgRect) return;
    const normRect = {
      x1: selection.x1 / imgRect.width,  y1: selection.y1 / imgRect.height,
      x2: selection.x2 / imgRect.width,  y2: selection.y2 / imgRect.height,
    };
    const nr = normalizeRect(normRect);
    const normW = nr.x2 - nr.x1;
    const normH = nr.y2 - nr.y1;
    if (normW < 0.02 || normH < 0.02) { setSelection(null); return; }

    // ── 检查是否重复框选（findDuplicate）─────────────────
    const dup = findDuplicate({ x: nr.x1, y: nr.y1, w: normW, h: normH }, annotations);
    if (dup) {
      openAnnotationCallout([dup], 0);
      setSelection(null);
      return;
    }

    // ── 立即显示 pending callout（对应 openPendingCallout）──
    const pxBox = { x: nr.x1 * imgRect.width, y: nr.y1 * imgRect.height, w: normW * imgRect.width, h: normH * imgRect.height };
    const { left, top } = calcCalloutPos(pxBox, imgRect.width, imgRect.height);
    userClosedRef.current = false;
    setCallout({ pending: true, type: 'region', left, top, normBox: { x: nr.x1, y: nr.y1, w: normW, h: normH } });
    setSelection(null);

    // ── 后台识别（对应 Android aiApi.explainRegion）────────────────
    try {
      // 1. 先裁剪拿到 imageBase64（与 Android 一致，也供后续 expandRegion 使用）
      const { imageBase64 } = await cropRegion(currentImageUrl, nr);

      // 2. explain-region（Android: aiApi.explainRegion(imageUrl, imageBase64, region)）
      const region = { x1: nr.x1, y1: nr.y1, x2: nr.x2, y2: nr.y2 };
      const { explanation } = await explainRegion({ imageUrl: currentImageUrl, imageBase64, region });

      // 保存标注（对应 Android annotationsApi.create）
      let saved = null;
      if (currentPageId) {
        try {
          const res = await createAnnotation(currentPageId, { x: nr.x1, y: nr.y1, w: normW, h: normH, explanation });
          saved = res.annotation;
        } catch (_) { /* 本地降级 */ }
      }
      saved = saved ?? { id: `local-${Date.now()}`, x: nr.x1, y: nr.y1, w: normW, h: normH, explanation };

      // 刷新标注列表
      if (currentPageId) {
        getAnnotations(currentPageId)
          .then((r) => setAnnotations(r.annotations || []))
          .catch(() => {});
      } else {
        setAnnotations((prev) => [...prev, saved]);
      }

      // 若用户已关闭 pending callout → 不重新弹（对应 Android userClosedCallout）
      if (userClosedRef.current) return;

      // 更新 callout 为识别结果，imageBase64 存储供深入探索使用
      const box2 = { x: nr.x1 * imgRect.width, y: nr.y1 * imgRect.height, w: normW * imgRect.width, h: normH * imgRect.height };
      const pos2 = calcCalloutPos(box2, imgRect.width, imgRect.height);
      setCallout({
        pending: false,
        type: 'annotation',
        left: pos2.left,
        top:  pos2.top,
        annotations: [saved],
        activeIdx:   0,
        imageBase64,                                    // ← 存储用于深入探索
        identification:  { description: explanation },
        selectionRegion: { x: nr.x1, y: nr.y1, w: normW, h: normH },
        normBox:         { x: nr.x1, y: nr.y1, w: normW, h: normH },
      });

      // 识别完成自动播 TTS（对应 Android onPlayAnnotation?.invoke）
      if (explanation && onPlayAnnotation && !userClosedRef.current) {
        onPlayAnnotation(saved);
      }
    } catch (err) {
      if (!userClosedRef.current) {
        setCallout(null);
        onToast?.({ type: 'error', message: err.message || '识别失败' });
      }
    }
  }, [isDragging, selection, currentImageUrl, currentPageId, annotations, openAnnotationCallout, onPlayAnnotation, onToast]);

  /** 深入探索（对应 Android onDeepExplore） */
  const handleExpandRegion = useCallback(() => {
    if (!callout) return;
    const ann = callout.annotations?.[callout.activeIdx ?? 0];
    // 从标注记录兼容 normBox
    const normBox = callout.normBox
      ?? (ann ? { x: ann.x, y: ann.y, w: ann.w, h: ann.h } : null);
    onExpandRegion?.({
      selectionImageBase64: callout.imageBase64 ?? null,
      identification:       callout.identification ?? { description: ann?.explanation || '' },
      selectionRegion:      callout.selectionRegion ?? normBox,
      normBox,
      annotation:           ann ?? null,            // 传完整标注对象（包含 exploredPageId）
      annotationId:         ann?.id,
      parentPageId:         state.currentPageId,
      curImageUrl:          currentImageUrl,
      bookId:               state.currentBookId,
    });
    setCallout(null);
    userClosedRef.current = false;
  }, [callout, state.currentBookId, state.currentPageId, currentImageUrl, onExpandRegion]);

  // ── 空状态 ───────────────────────────────────────────────
  if (!currentImageUrl) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyInner}>
          <AppLogo size={72} className={styles.emptyIcon} />
          <h2 className={styles.emptyTitle}>输入主题，开启探索</h2>
          <p className={styles.emptyDesc}>
            在顶部搜索框输入任何科普话题<br />
            AI 将为你生成一幅精美的科普图册
          </p>
        </div>
      </div>
    );
  }

  const pageIdx = bookFlat.findIndex((p) => p.id === currentPageId);
  const hasPrev = pageIdx > 0;
  const hasNext = pageIdx >= 0 && pageIdx < bookFlat.length - 1;

  // 当前活跃标注 id（用于圆点高亮）
  const activeAnnotationId = callout?.type === 'annotation'
    ? callout.annotations?.[callout.activeIdx ?? 0]?.id
    : null;

  return (
    <div
      className={styles.container}
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onClick={() => {
        if (clickHandledRef.current) { clickHandledRef.current = false; return; }
        handleClick();
      }}
    >
      {/* 图片层及其附属组件容器 */}
      <div style={{ position: 'relative', display: 'flex', maxWidth: '100%', maxHeight: '100%' }}>
        {/* 图片 */}
        {!imgLoaded && (
          <div className={styles.imgLoading}>
            <LoadingSpinner size={40} text="加载中…" />
          </div>
        )}
        <img
          ref={imgRef}
          src={currentImageUrl}
          alt="AI 生成的科普图册"
          className={`${styles.img} ${imgLoaded ? styles.imgVisible : ''}`}
          onLoad={() => setImgLoaded(true)}
          draggable={false}
        />

        {/* 标注层 */}
        {imgLoaded && (
          <AnnotationLayer
            annotations={annotations}
            imgRef={imgRef}
            activeAnnotationId={activeAnnotationId}
            ttsState={ttsState || 'idle'}
            ttsSrcId={ttsSrcId}
            calloutOpen={!!callout}
            onDotClick={handleAnnotationDotClick}
          />
        )}

        {/* 框选框 */}
        {selection && imgRef.current && (
          <SelectionBox selection={selection} imgRef={imgRef} />
        )}

        {/* Callout 弹窗 */}
        {callout && imgRef.current && (
          <Callout
            callout={callout}
            imgRef={imgRef}
            onClose={() => { setCallout(null); userClosedRef.current = true; }}
            onExpand={handleExpandRegion}
            onTabChange={(idx) => setCallout((c) => c ? { ...c, activeIdx: idx } : c)}
            onPlay={onPlayAnnotation
              ? () => { const ann = callout.annotations?.[callout.activeIdx ?? 0]; if (ann) onPlayAnnotation(ann); }
              : null}
            ttsState={ttsState || 'idle'}
          />
        )}
      </div>

      {/* 翻页按钮 */}
      {imgLoaded && bookFlat.length > 1 && (
        <>
          {hasPrev && (
            <button
              className={`${styles.navBtn} ${styles.navBtnLeft}`}
              onClick={(e) => { e.stopPropagation(); const prev = bookFlat[pageIdx - 1]; setCurrentPage(currentBookId, currentBookTitle, prev.id, prev.imageUrl); }}
              aria-label="上一页"
            >
              <Icon name="chevronLeft" size={22} />
            </button>
          )}
          {hasNext && (
            <button
              className={`${styles.navBtn} ${styles.navBtnRight}`}
              onClick={(e) => { e.stopPropagation(); const next = bookFlat[pageIdx + 1]; setCurrentPage(currentBookId, currentBookTitle, next.id, next.imageUrl); }}
              aria-label="下一页"
            >
              <Icon name="chevronRight" size={22} />
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ── Callout 组件（对应 Android AnnotationCallout.kt）─────────────────────────
/**
 * @param {{ callout, imgRef, onClose, onExpand, onTabChange, onPlay, ttsState }}
 */
function Callout({ callout, imgRef, onClose, onExpand, onTabChange, onPlay, ttsState }) {
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
    : { background: 'rgba(99,102,241,0.12)', borderColor: 'rgba(99,102,241,0.4)', color: '#a5b4fc' };

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
        <Icon name="lightbulb" size={14} color="#818cf8" />
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
