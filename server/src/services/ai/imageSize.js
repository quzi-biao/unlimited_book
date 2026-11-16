export const DEFAULT_IMAGE_SIZE = '1536x864';
export const LEGACY_IMAGE_SIZE = '1536x1024';

/**
 * 新生成图片固定为 16:9，兼容旧客户端但不再使用其阅读区域尺寸。
 * @param {unknown} _viewport 客户端可继续传入；后端忽略该字段
 * @returns {string} 固定的 1536x864
 */
export function resolveImageSize(_viewport) {
  return DEFAULT_IMAGE_SIZE;
}

/**
 * 为模型补充画幅构图要求，避免沿用旧提示词中的固定横竖比例。
 * @param {string} prompt 原提示词
 * @param {string} size 生图尺寸
 * @returns {string} 完整提示词
 */
export function withImageSizePrompt(prompt, size) {
  const normalized = size === DEFAULT_IMAGE_SIZE
    ? prompt.replace(/\b(?:3\s*[:：]\s*2|16\s*[:：]\s*10)\b/g, '16:9')
      .replace(/1536\s*[x×]\s*1024/g, DEFAULT_IMAGE_SIZE)
    : prompt;
  const aspect = size === DEFAULT_IMAGE_SIZE ? ' The aspect ratio must be 16:9 landscape.' : '';
  return `${normalized}\n\nOutput canvas: ${size} pixels.${aspect} Compose for this exact aspect ratio. `
    + 'Fill the entire canvas edge to edge with the illustration; no letterboxing, borders or UI. '
    + 'Keep all labels and important subjects inside the canvas. This canvas overrides earlier aspect-ratio instructions.';
}
