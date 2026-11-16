import { readFile } from 'node:fs/promises';
import path from 'node:path';

/** 读取本地内容重置标识，用于让各浏览器清理已失效的阅读记录。@returns {Promise<string|null>} */
export async function getContentRevision() {
  if (!process.env.LOCAL_UPLOAD_DIR) return null;
  try {
    const value = (await readFile(path.join(process.env.LOCAL_UPLOAD_DIR, '.content-revision'), 'utf8')).trim();
    return /^[a-zA-Z0-9:._-]{1,100}$/.test(value) ? value : null;
  } catch (error) {
    if (error.code !== 'ENOENT') console.warn('[content-revision] 读取失败:', error.message);
    return null;
  }
}
