let viewport;

/**
 * 布局变化时更新内存快照；不保存设备原始像素密度。
 * @param {number} width 阅读区域宽度
 * @param {number} height 阅读区域高度
 * @returns {void}
 */
export function updateReadingViewport(width, height) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
  const next = { width: Math.round(width), height: Math.round(height) };
  if (next.width === viewport?.width && next.height === viewport?.height) return;
  viewport = Object.freeze(next);
}

/** 读取已记录的尺寸，不在发起生图时查询 DOM。@returns {object | undefined} */
export function getReadingViewport() {
  return viewport;
}
