/**
 * GPT-Image-2 API 调用封装（OpenLux 代理）
 * 接口：
 *   POST /v1/images/generations  文生图
 *   POST /v1/images/edits        图生图（编辑）
 */
import sharp from 'sharp';
import { DEFAULT_IMAGE_SIZE, withImageSizePrompt } from './imageSize.js';
import { validateImageOutput } from './imageOutput.js';

const BASE_URL = process.env.GPTIMAGE_BASE_URL || 'https://api.openlux.ai';
const API_KEY = process.env.GPTIMAGE_API_KEY;

const MODEL = 'gpt-image-2';
const QUALITY = 'low';
const FORMAT = 'jpeg';

/**
 * 将 base64 data URL 转换为 Blob（Node.js FormData 用）
 * @param {string} dataUrl
 * @param {string} filename
 * @returns {{ buffer: Buffer, filename: string, mimeType: string }}
 */
function dataUrlToBuffer(dataUrl, filename = 'image.jpg') {
  const commaIdx = dataUrl.indexOf(',');
  const mimeType = dataUrl.slice(0, commaIdx).replace('data:', '').replace(';base64', '') || 'image/jpeg';
  const b64 = dataUrl.slice(commaIdx + 1);
  const buffer = Buffer.from(b64, 'base64');
  return { buffer, filename, mimeType };
}

/**
 * 文生图：调用 gpt-image-2 生成科普插画
 * @param {string} prompt  用户输入的查询词（已由 gemini.js 的 buildImagePrompt 构建）
 * @param {string} [imageSize] 后端已校验的输出尺寸
 * @returns {Promise<string>}  base64 data URL（jpeg，指定画幅）
 */
export async function generateImageGPT(prompt, imageSize = DEFAULT_IMAGE_SIZE) {
  if (!API_KEY) throw new Error('GPTIMAGE_API_KEY 未配置');

  const res = await fetch(`${BASE_URL}/v1/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      prompt: withImageSizePrompt(prompt, imageSize),
      n: 1,
      size: imageSize,
      quality: QUALITY,
      format: FORMAT,
    }),
    signal: AbortSignal.timeout(600_000), // 600s 超时保护
  });

  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error?.message || `GPT-Image API HTTP ${res.status}`);
  }

  const item = data.data?.[0];
  if (!item) throw new Error('GPT-Image 返回结果为空');

  // 接口返回 b64_json 或 url
  let imageDataUrl;
  if (item.b64_json) {
    imageDataUrl = `data:image/jpeg;base64,${item.b64_json}`;
  } else if (item.url) {
    // 下载并转 base64
    const imgRes = await fetch(item.url);
    if (!imgRes.ok) throw new Error(`GPT-Image 下载失败 (${imgRes.status})`);
    const buf = Buffer.from(await imgRes.arrayBuffer());
    imageDataUrl = `data:image/jpeg;base64,${buf.toString('base64')}`;
  } else {
    throw new Error('GPT-Image 返回格式未知');
  }

  // 直接返回原图，不裁剪（gpt-image-2 生成的比例已合理，由前端 contain 完整展示）
  return validateImageOutput(imageDataUrl, imageSize);
}

/**
 * 图生图（编辑）：将框选区域图片发送给 gpt-image-2 进行扩展
 * @param {string} selectionBase64   裁剪区域图片（data URL）
 * @param {string} prompt            扩展的文字提示词（已构建好）
 * @param {string} [imageSize]        后端已校验的输出尺寸
 * @returns {Promise<string>}        扩展后图片的 base64 data URL（指定画幅）
 */
export async function expandImageGPT(selectionBase64, prompt, imageSize = DEFAULT_IMAGE_SIZE) {
  if (!API_KEY) throw new Error('GPTIMAGE_API_KEY 未配置');

  // 发送前将框选图压缩到 ≤512px / q70，减少上传体积和服务端处理时间
  let { buffer, filename, mimeType } = dataUrlToBuffer(selectionBase64, 'selection.jpg');
  try {
    const meta = await sharp(buffer).metadata();
    const maxDim = 512;
    if ((meta.width ?? 0) > maxDim || (meta.height ?? 0) > maxDim) {
      buffer = await sharp(buffer)
        .resize(maxDim, maxDim, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 70 })
        .toBuffer();
      mimeType = 'image/jpeg';
      console.log(`[expandImageGPT] 图片已压缩到 ≤${maxDim}px, 大小: ${(buffer.length / 1024).toFixed(1)}KB`);
    } else {
      console.log(`[expandImageGPT] 图片无需压缩, 大小: ${(buffer.length / 1024).toFixed(1)}KB`);
    }
  } catch (e) {
    console.warn('[expandImageGPT] 压缩失败，用原图:', e.message);
  }

  // 使用 FormData 发送 multipart
  const formData = new FormData();
  formData.append('model', MODEL);
  formData.append('prompt', withImageSizePrompt(prompt, imageSize));
  formData.append('n', '1');
  formData.append('size', imageSize);
  formData.append('quality', QUALITY);
  formData.append('format', FORMAT);
  formData.append('background', 'auto');
  formData.append('moderation', 'auto');
  // 将 Buffer 包装为 Blob 发送
  const blob = new Blob([buffer], { type: mimeType });
  formData.append('image', blob, filename);

  // 带重试的 fetch：网络失败最多重试 2 次（指数退避），超时错误不重试
  const MAX_RETRIES = 2;
  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const wait = 4000 * attempt; // 4s, 8s
      console.warn(`[expandImageGPT] 第 ${attempt}/${MAX_RETRIES} 次重试，等待 ${wait / 1000}s...`);
      await new Promise(r => setTimeout(r, wait));
    }

    try {
      const res = await fetch(`${BASE_URL}/v1/images/edits`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          // 注意：不能手动设置 Content-Type，让 fetch 自动加 boundary
        },
        body: formData,
        signal: AbortSignal.timeout(600_000), // 600s 超时保护（图生图接口较慢）
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error?.message || `GPT-Image Edit API HTTP ${res.status}`);
      }

      const item = data.data?.[0];
      if (!item) throw new Error('GPT-Image Edit 返回结果为空');

      let imageDataUrl;
      if (item.b64_json) {
        imageDataUrl = `data:image/jpeg;base64,${item.b64_json}`;
      } else if (item.url) {
        const imgRes = await fetch(item.url);
        if (!imgRes.ok) throw new Error(`GPT-Image Edit 下载失败 (${imgRes.status})`);
        const buf = Buffer.from(await imgRes.arrayBuffer());
        imageDataUrl = `data:image/jpeg;base64,${buf.toString('base64')}`;
      } else {
        throw new Error('GPT-Image Edit 返回格式未知');
      }

      // 直接返回原图，不裁剪
      return await validateImageOutput(imageDataUrl, imageSize);

    } catch (err) {
      lastError = err;
      // 画幅不匹配不自动重复计费，交由调用方显示明确错误。
      if (err.code === 'IMAGE_SIZE_MISMATCH') throw err;
      // 超时错误不重试（已等待 600s，继续重试无意义）
      if (err.name === 'TimeoutError' || err.name === 'AbortError') {
        console.error(`[expandImageGPT] 超时，不重试: ${err.message}`);
        throw err;
      }
      console.warn(`[expandImageGPT] 网络错误 (attempt ${attempt}): ${err.message}`);
    }
  }

  throw lastError;
}
