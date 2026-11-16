import sharp from 'sharp';

/**
 * 校验供应商实际画幅，防止忽略 size 时缓存错误比例；保留全部图片内容。
 * @param {string} dataUrl 原始图片
 * @param {string} imageSize 请求尺寸
 * @returns {Promise<string>} MIME 正确的图片数据
 */
export async function validateImageOutput(dataUrl, imageSize) {
  const buffer = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
  const { width, height, format } = await sharp(buffer).metadata();
  if (!width || !height) throw new Error('生图服务返回的图片无法读取');
  const [targetWidth, targetHeight] = imageSize.split('x').map(Number);
  const errorRatio = Math.abs((width / height) / (targetWidth / targetHeight) - 1);
  // 默认尺寸也必须校验，只允许像素舍入带来的微小误差，不接受 3:2。
  if (errorRatio > 0.005) {
    const error = new Error(`生图服务未按请求画幅输出（请求 ${imageSize}，返回 ${width}x${height}），请重试`);
    error.code = 'IMAGE_SIZE_MISMATCH';
    throw error;
  }
  const mime = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' }[format];
  if (!mime) throw new Error('生图服务返回了不支持的图片格式');
  return `data:${mime};base64,${buffer.toString('base64')}`;
}
