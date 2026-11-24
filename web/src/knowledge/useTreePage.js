import { useEffect, useMemo, useState } from 'react';
import { mediaUrl } from './media.js';
import { readLocal } from './local.js';
import { personalBook } from './personalBook.js';

/** 将知识节点适配给原来的大图画布，翻页也记入同一座知识树。 */
export function useTreePage(knowledge) {
  const { node, snapshot, openNode, record } = knowledge;
  const source = node?.asset.imageUrl;
  const [cached, setCached] = useState(null);
  const book = useMemo(()=>personalBook(snapshot,node),[snapshot.profile.id,snapshot.nodes,node?.assetKey]);
  useEffect(() => {
    setCached(null);
    if (!source) return;
    let active = true;
    let url;
    readLocal('media', source).then(blob => {
      if (active && blob) {
        url = URL.createObjectURL(blob);
        setCached({source, url});
      }
    }).catch(() => {});
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [source]);
  useEffect(() => {
    if (!node) return;
    let start = Date.now();
    let visible = !document.hidden;
    function flush() {
      const now = Date.now();
      const seconds = Math.min(30, Math.floor((now - start) / 1000));
      if (visible && seconds > 0) record(node.assetKey, 'dwell', {seconds}).catch(() => {});
      start = now;
      visible = !document.hidden;
    }
    const timer = setInterval(flush, 30000);
    document.addEventListener('visibilitychange', flush);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', flush); flush(); };
  }, [node?.assetKey, record]);
  if (!node) return null;
  const byKey = new Map(snapshot.nodes.map(n => [n.assetKey, n]));
  return {
    ...book, currentPageId:node.assetKey,
    currentImageUrl:cached?.source === source ? cached.url : mediaUrl(source),
    select:(_bookId, _title, key) => openNode(byKey.get(key)),
  };
}
