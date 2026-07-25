/**
 * annotationGroup.js — 对应 Android annotationGroup.kt
 * 标注分组工具：合并中心点相近的标注、检测重复框选
 */

const CENTER_DIST = 0.05;  // 归一化距离阈值
const SIZE_RATIO  = 0.30;  // 尺寸比例阈值

/**
 * 检测新框选是否与已有标注重叠
 * @param {{ x, y, w, h }} newBox 归一化坐标
 * @param {Array<{ id, x, y, w, h }>} annotations
 * @returns {{ id, x, y, w, h } | null}
 */
export function findDuplicate(newBox, annotations) {
  return annotations.find((ann) => {
    return centerDist(newBox, ann) < CENTER_DIST && sizeClose(newBox, ann);
  }) ?? null;
}

/**
 * 按中心点分组标注
 * 距离 < CENTER_DIST 的归为同一组
 * @param {Array<{ id, x, y, w, h, exploredPageId? }>} annotations
 * @returns {Array<{ cx, cy, items }>}
 */
export function groupByCenter(annotations) {
  if (!annotations.length) return [];
  const groups = [];
  for (const ann of annotations) {
    const cx = ann.x + ann.w / 2;
    const cy = ann.y + ann.h / 2;
    let placed = false;
    for (const g of groups) {
      const dist = Math.hypot(cx - g.cx, cy - g.cy);
      if (dist < CENTER_DIST) {
        g.items.push(ann);
        const n = g.items.length;
        g.cx = g.items.reduce((s, a) => s + a.x + a.w / 2, 0) / n;
        g.cy = g.items.reduce((s, a) => s + a.y + a.h / 2, 0) / n;
        placed = true;
        break;
      }
    }
    if (!placed) groups.push({ cx, cy, items: [ann] });
  }
  return groups;
}

function centerDist(a, b) {
  const acx = a.x + a.w / 2, acy = a.y + a.h / 2;
  const bcx = b.x + b.w / 2, bcy = b.y + b.h / 2;
  return Math.hypot(acx - bcx, acy - bcy);
}

function sizeClose(a, b) {
  const dw = Math.abs(a.w - b.w) / Math.max(Math.max(a.w, b.w), 0.001);
  const dh = Math.abs(a.h - b.h) / Math.max(Math.max(a.h, b.h), 0.001);
  return dw < SIZE_RATIO && dh < SIZE_RATIO;
}
