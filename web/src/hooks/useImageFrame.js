import { useLayoutEffect, useState } from 'react';

/**
 * 等比适配阅读区域并同步热点容器，允许在大屏放大，完整保留图片内容。
 * @param {object} containerRef 阅读区域引用
 * @param {object} imgRef 图片引用
 * @param {string} imageUrl 当前图片
 * @param {boolean} loaded 图片加载状态
 * @returns {{width: number, height: number} | undefined} 图片容器尺寸
 */
export function useImageFrame(containerRef, imgRef, imageUrl, loaded, onFrameChange) {
  const [frame, setFrame] = useState();
  useLayoutEffect(() => {
    const container = containerRef.current;
    const image = imgRef.current;
    if (!container || !image) return;
    const fit = () => {
      if (!image.naturalWidth || !image.naturalHeight) return;
      const scale = Math.min(container.clientWidth / image.naturalWidth, container.clientHeight / image.naturalHeight);
      if (!scale) return;
      const width = image.naturalWidth * scale;
      const height = image.naturalHeight * scale;
      setFrame(previous => previous?.width === width && previous?.height === height ? previous : { width, height });
      onFrameChange?.(width);
    };
    const observer = new ResizeObserver(fit);
    observer.observe(container);
    image.addEventListener('load', fit);
    fit();
    return () => {
      observer.disconnect();
      image.removeEventListener('load', fit);
      onFrameChange?.(undefined);
    };
  }, [containerRef, imgRef, imageUrl, loaded, onFrameChange]);
  return frame;
}
