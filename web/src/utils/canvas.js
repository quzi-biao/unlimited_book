/**
 * 将归一化坐标 (0~1) 转为 Canvas 像素坐标
 * @param {number} nx - 归一化 x
 * @param {number} ny - 归一化 y
 * @param {number} w  - canvas 宽度（px）
 * @param {number} h  - canvas 高度（px）
 * @returns {{ x: number, y: number }}
 */
export function normToPixel(nx, ny, w, h) {
  return { x: nx * w, y: ny * h };
}

/**
 * 将 Canvas 像素坐标转为归一化坐标
 */
export function pixelToNorm(px, py, w, h) {
  return { x: px / w, y: py / h };
}

/**
 * 归一化选区矩形（确保 x1<=x2, y1<=y2）
 * @param {{ x1, y1, x2, y2 }} r
 * @returns {{ x1, y1, x2, y2 }}
 */
export function normalizeRect(r) {
  return {
    x1: Math.min(r.x1, r.x2),
    y1: Math.min(r.y1, r.y2),
    x2: Math.max(r.x1, r.x2),
    y2: Math.max(r.y1, r.y2),
  };
}

/**
 * 从图片元素获取图片在容器内的实际渲染位置（object-fit: contain 模式）
 * @param {HTMLImageElement} img
 * @returns {{ left, top, width, height }}
 */
export function getImageRenderBounds(img) {
  const containerW = img.clientWidth;
  const containerH = img.clientHeight;
  const naturalW   = img.naturalWidth  || containerW;
  const naturalH   = img.naturalHeight || containerH;

  const scale = Math.min(containerW / naturalW, containerH / naturalH);
  const w = naturalW * scale;
  const h = naturalH * scale;
  const left = (containerW - w) / 2;
  const top  = (containerH - h) / 2;

  return { left, top, width: w, height: h };
}
