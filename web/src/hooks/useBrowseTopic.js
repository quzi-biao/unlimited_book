import { useCallback, useRef } from 'react';
import { generateImage } from '../api/ai.js';
import { findTopicBook } from '../api/books.js';

/**
 * 输入话题先打开已有书，只有没有该书时才创建探索任务。
 * @param {object} options 阅读状态、导航及提示回调
 * @returns {Function} 话题提交处理函数
 */
export function useBrowseTopic({ state, dispatch, setCurrentPage, setQueueOpen, addToast }) {
  const pending = useRef(new Set());
  return useCallback(async topicName => {
    const query = topicName.trim();
    if (!query) return;
    const key = query.replace(/\s+/g, ' ').toLowerCase();
    if (pending.current.has(key)) return;
    pending.current.add(key);
    let taskId;
    const openExisting = result => {
      setCurrentPage(result.bookId, result.bookTitle || query, result.pageId, result.imageUrl);
      dispatch({ type: 'SET_SHELF', open: false });
      dispatch({ type: 'SET_PAGETREE', open: false });
      setQueueOpen(false);
      addToast({ type: 'info', message: `已打开书架中的「${result.bookTitle || query}」，未重复生成` });
    };
    try {
      const { existing, prepared } = await findTopicBook(query);
      if (existing) { openExisting(existing); return; }
      if (prepared) {
        const result = await generateImage(query);
        setCurrentPage(result.bookId, result.bookTitle || query, result.pageId, result.imageUrl);
        dispatch({ type: 'SET_SHELF', open: false });
        dispatch({ type: 'SET_PAGETREE', open: false });
        setQueueOpen(false);
        return;
      }
      const active = state.exploreQueue.some(task => task.type === 'topic' && task.status === 'loading'
        && task.payload?.query?.trim().replace(/\s+/g, ' ').toLowerCase() === key);
      if (active) { addToast({ type: 'warning', message: '该话题正在探索中，请稍候' }); return; }
      if (state.exploreQueue.length >= 5) {
        addToast({ type: 'warning', message: '队列已满（最多5个），请等待完成后再探索' }); return;
      }
      taskId = `ex-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      dispatch({ type: 'ADD_EXPLORE_TASK', task: {
        id: taskId, type: 'topic', status: 'loading', label: query, bookTitle: query,
        sourcePageTitle: query, dedupeKey: `topic-${key}`, payload: { query }, startedAt: Date.now(),
      } });
      setQueueOpen(true);
      dispatch({ type: 'SET_SHELF', open: false });
      const result = await generateImage(query);
      if (result.reusedBook || result.fromCache) {
        // 另一标签页可能在查询后完成创建，后端兜底复用时也直接打开。
        dispatch({ type: 'REMOVE_EXPLORE_TASK', id: taskId });
        openExisting(result);
        return;
      }
      dispatch({ type: 'UPDATE_EXPLORE_TASK', id: taskId, updates: {
        status: 'done', pageId: result.pageId, imageUrl: result.imageUrl,
        bookId: result.bookId, label: result.pageTitle || query,
      } });
      addToast({ type: 'success', message: `「${result.pageTitle || query}」 已生成，可在队列中查看` });
    } catch (error) {
      if (taskId) dispatch({ type: 'UPDATE_EXPLORE_TASK', id: taskId, updates: { status: 'failed', error: error.message || '生成失败' } });
      addToast({ type: 'error', message: error.message || '话题探索失败' });
    } finally { pending.current.delete(key); }
  }, [state.exploreQueue, dispatch, setCurrentPage, setQueueOpen, addToast]);
}
