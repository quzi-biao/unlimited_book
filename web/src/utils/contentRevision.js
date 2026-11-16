const REVISION_KEY = 'flipbook_content_revision';

/**
 * 启动前校验内容版本；仅清理阅读位置和探索结果，不清理认证、设备或设置。
 * 网络不可用或后端未提供版本时保留离线状态。
 * @param {object} options 可注入存储及网络用于无副作用测试
 * @returns {Promise<boolean>} 是否已清理过期内容
 */
export async function syncContentRevision({ storage = localStorage, fetcher = fetch } = {}) {
  try {
    const response = await fetcher('/api/health', { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (!response.ok) return false;
    const { contentRevision } = await response.json();
    if (typeof contentRevision !== 'string' || !contentRevision || storage.getItem(REVISION_KEY) === contentRevision) return false;
    storage.removeItem('flipbook_session');
    storage.removeItem('flipbook_explore_queue_v1');
    storage.setItem(REVISION_KEY, contentRevision);
    return true;
  } catch { return false; }
}
