import { useCallback, useRef } from 'react';
import { updateReadingViewport } from '../utils/readingViewport.js';

/**
 * 首次进入阅读区域和实际布局变化时更新尺寸，普通渲染及工具栏显隐不重新测量。
 * @returns {Function} 绑定阅读区域的 ref 回调
 */
export function useReadingViewport() {
  const cleanupRef = useRef(null);
  return useCallback(node => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    if (!node) return;
    const measure = () => updateReadingViewport(node.clientWidth, node.clientHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    cleanupRef.current = () => observer.disconnect();
  }, []);
}
