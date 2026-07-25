/**
 * calloutUtils.js — 对应 Android calcCalloutUtils.kt
 * Callout 位置计算工具
 */

const CALLOUT_W = 380;  // px，web 版 callout 宽度
const CALLOUT_H = 430;  // px，web 版 callout 高度（包含 header, max 320px body, footer）

/**
 * 根据标注框计算 callout 最佳位置（避免遮挡框选区域）
 * @param {{ x, y, w, h }} box 像素坐标（相对图片）
 * @param {number} cw 容器宽度
 * @param {number} ch 容器高度
 * @returns {{ left: number, top: number }} 像素坐标
 */
export function calcCalloutPos(box, cw, ch) {
  const offset = 14;
  // 优先放右侧，放不下就放左侧
  const rawLeft = (box.x + box.w + offset + CALLOUT_W <= cw - 8)
    ? box.x + box.w + offset
    : box.x - CALLOUT_W - offset;
  const maxLeft = Math.max(8, cw - CALLOUT_W - 8);
  const left = Math.max(8, Math.min(rawLeft, maxLeft));
  const top  = Math.max(8, Math.min(box.y, ch - CALLOUT_H - 8));
  return { left, top };
}
