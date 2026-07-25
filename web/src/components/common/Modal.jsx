import { useEffect, useRef } from 'react';
import { Icon } from './Icons.jsx';
import styles from './Modal.module.css';

/**
 * 通用 Modal 弹窗
 * @param {{ open, onClose, title, children, width }} props
 */
export function Modal({ open, onClose, title, children, width = 480 }) {
  const dialogRef = useRef(null);

  // ESC 关闭
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className={`${styles.dialog} glass-strong`} style={{ maxWidth: width }} ref={dialogRef}>
        {title && (
          <div className={styles.header}>
            <h2 className={styles.title}>{title}</h2>
            <button className="btn-icon" onClick={onClose} aria-label="关闭"><Icon name="close" size={18} /></button>
          </div>
        )}
        <div className={styles.body}>{children}</div>
      </div>
    </div>
  );
}
