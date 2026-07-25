import styles from './SelectionBox.module.css';

/**
 * 框选矩形叠加层
 * selection: { x1, y1, x2, y2 } — 相对于图片的像素坐标
 * imgRef: 图片元素 ref
 */
export function SelectionBox({ selection, imgRef }) {
  if (!imgRef.current) return null;
  const imgRect = imgRef.current.getBoundingClientRect();

  // 转为相对于图片的 %
  const x = Math.min(selection.x1, selection.x2);
  const y = Math.min(selection.y1, selection.y2);
  const w = Math.abs(selection.x2 - selection.x1);
  const h = Math.abs(selection.y2 - selection.y1);

  const pct = {
    left:   (x / imgRect.width)  * 100,
    top:    (y / imgRect.height) * 100,
    width:  (w / imgRect.width)  * 100,
    height: (h / imgRect.height) * 100,
  };

  return (
    <div
      className={styles.overlay}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      <div
        className={styles.box}
        style={{
          left:   `${pct.left}%`,
          top:    `${pct.top}%`,
          width:  `${pct.width}%`,
          height: `${pct.height}%`,
        }}
      />
    </div>
  );
}
