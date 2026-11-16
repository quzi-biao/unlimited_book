import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';

const LOCAL_PATHS = [
  ['/api/local-assets/', 'LOCAL_ASSET_DIR'],
  ['/api/local-uploads/', 'LOCAL_UPLOAD_DIR'],
];

/**
 * 读取远程图片或本地内容副本；本地路径仅允许已配置资源目录内的文件。
 * @param {string} imageUrl 远程 URL 或本地资源相对路径
 * @returns {Promise<Buffer>} 图片原始内容
 */
export async function readImageBuffer(imageUrl) {
  if (typeof imageUrl !== 'string' || !imageUrl) {
    throw Object.assign(new Error('图片地址不能为空'), { status: 400 });
  }
  const local = LOCAL_PATHS.find(([prefix]) => imageUrl.startsWith(prefix));
  if (local) {
    const [prefix, envName] = local;
    if (!process.env[envName]) {
      throw Object.assign(new Error('当前服务未启用本地图片目录'), { status: 400 });
    }
    let filename;
    try {
      filename = decodeURIComponent(imageUrl.slice(prefix.length).split(/[?#]/)[0]);
    } catch {
      throw Object.assign(new Error('本地图片地址无效'), { status: 400 });
    }
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(filename)) {
      throw Object.assign(new Error('本地图片地址无效'), { status: 400 });
    }
    try {
      const root = await realpath(process.env[envName]);
      const file = await realpath(path.join(root, filename));
      if (path.dirname(file) !== root) {
        throw Object.assign(new Error('本地图片地址超出资源目录'), { status: 400 });
      }
      return await readFile(file);
    } catch (err) {
      if (err.code === 'ENOENT') {
        throw Object.assign(new Error('本地图片不存在'), { status: 404 });
      }
      throw err;
    }
  }
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`图片下载失败 (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}
