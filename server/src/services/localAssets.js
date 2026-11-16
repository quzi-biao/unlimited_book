import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

/**
 * 将本地测试生成的资源写入独立目录，不修改导入的线上内容副本。
 * @param {Buffer} buffer 资源内容
 * @param {string} ext 文件扩展名
 * @returns {Promise<string>} 可同源访问的资源路径
 */
export async function saveLocalAsset(buffer, ext) {
  if (!process.env.LOCAL_UPLOAD_DIR) throw new Error('本地资源写入目录未配置');
  const root = path.resolve(process.env.LOCAL_UPLOAD_DIR);
  const suffix = /^[a-z0-9]{1,10}$/i.test(ext) ? ext.toLowerCase() : 'bin';
  const filename = `${randomUUID()}.${suffix}`;
  await mkdir(root, { recursive: true });
  await writeFile(path.join(root, filename), buffer, { flag: 'wx' });
  return `/api/local-uploads/${filename}`;
}
