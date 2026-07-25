import { useEffect } from 'react';
import { Icon } from './Icons.jsx';
import styles from './Toast.module.css';

/** 单条 Toast */
function ToastItem({ toast, onRemove }) {
  useEffect(() => {
    const t = setTimeout(() => onRemove(toast.id), toast.duration ?? 3000);
    return () => clearTimeout(t);
  }, [toast.id, toast.duration, onRemove]);

  return (
    <div className={`${styles.item} ${styles[toast.type ?? 'info']}`}>
      <span className={styles.icon}>{getIcon(toast.type)}</span>
      <span className={styles.msg}>{toast.message}</span>
    </div>
  );
}

function getIcon(type) {
  switch (type) {
    case 'success': return <Icon name="success" size={16} />;
    case 'error':   return <Icon name="warning" size={16} />;
    case 'warning': return <Icon name="warning" size={16} />;
    default:        return <Icon name="info" size={16} />;
  }
}

export function ToastContainer({ toasts, onRemove }) {
  return (
    <div className={styles.container}>
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onRemove={onRemove} />
      ))}
    </div>
  );
}
