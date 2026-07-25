import styles from './LoadingSpinner.module.css';

/**
 * @param {{ size, text }} props
 */
export function LoadingSpinner({ size = 32, text }) {
  return (
    <div className={styles.wrap}>
      <div
        className={styles.ring}
        style={{ width: size, height: size, borderWidth: Math.max(2, size / 10) }}
      />
      {text && <p className={styles.text}>{text}</p>}
    </div>
  );
}
