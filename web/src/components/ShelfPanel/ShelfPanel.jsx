import { useState, useEffect, useCallback } from 'react';
import { useAppState } from '../../contexts/AppStateContext.jsx';
import { getBooks, deleteBook } from '../../api/books.js';
import { getTopicCategories } from '../../api/device.js';
import { getPages } from '../../api/books.js';
import { LoadingSpinner } from '../common/LoadingSpinner.jsx';
import { Icon } from '../common/Icons.jsx';
import styles from './ShelfPanel.module.css';

/**
 * ShelfPanel — 左侧书架抽屉（对应 Android ShelfPanel.kt）
 *
 * 话题探索交互：
 *   点击 Header 的「话题分类」按钮 → 面板横向扩展，右侧出现
 *   「分类列 | 话题列」双栏，与 Android 完全一致。
 */
export function ShelfPanel({ onToast, onSelectTopic }) {
  const { state, dispatch, setCurrentPage } = useAppState();

  // 书单
  const [books, setBooks]     = useState([]);
  const [loading, setLoading] = useState(false);

  // 话题探索（右侧展开栏）
  const [topicsOpen, setTopicsOpen]         = useState(false);
  const [categories, setCategories]         = useState([]);
  const [loadingCats, setLoadingCats]       = useState(false);
  const [activeCategoryId, setActiveCatId]  = useState(null);

  /* ── 数据加载 ─────────────────────────────────────── */
  const loadBooks = useCallback(async () => {
    setLoading(true);
    try {
      const { books: list } = await getBooks();
      setBooks(list);
    } catch {
      onToast?.({ type: 'error', message: '加载书架失败' });
    } finally {
      setLoading(false);
    }
  }, [onToast]);

  const loadCategories = useCallback(async () => {
    if (categories.length || loadingCats) return;
    setLoadingCats(true);
    try {
      const { categories: cats } = await getTopicCategories();
      setCategories(cats);
      if (cats.length) setActiveCatId(cats[0].id);
    } catch {}
    setLoadingCats(false);
  }, [categories.length, loadingCats]);

  useEffect(() => {
    if (state.shelfOpen) {
      loadBooks();
      setTopicsOpen(false);   // 每次打开书架重置话题栏
    }
  }, [state.shelfOpen, loadBooks]);

  /* ── 书本操作 ─────────────────────────────────────── */
  /** 点击书本 — 加载第一页 */
  const openBook = useCallback(async (book) => {
    try {
      const { pages } = await getPages(book.id);
      if (!pages.length) { onToast?.({ type: 'info', message: '该书暂无页面' }); return; }
      const first = pages[0];
      setCurrentPage(book.id, book.title, first.id, first.imageUrl);
      dispatch({ type: 'SET_SHELF', open: false });
    } catch {
      onToast?.({ type: 'error', message: '加载失败' });
    }
  }, [setCurrentPage, dispatch, onToast]);

  /** 删除书本 */
  const handleDelete = useCallback(async (e, bookId) => {
    e.stopPropagation();
    try {
      await deleteBook(bookId);
      setBooks((prev) => prev.filter((b) => b.id !== bookId));
      onToast?.({ type: 'success', message: '已删除' });
    } catch {
      onToast?.({ type: 'error', message: '删除失败' });
    }
  }, [onToast]);

  /* ── 话题操作 ─────────────────────────────────────── */
  /** 切换话题栏 */
  const toggleTopics = useCallback(() => {
    setTopicsOpen((v) => {
      if (!v) loadCategories();   // 首次展开时加载
      return !v;
    });
  }, [loadCategories]);

  if (!state.shelfOpen) return null;

  const activeCategory = categories.find((c) => c.id === activeCategoryId);

  return (
    <>
      {/* 背景遮罩 */}
      <div className={styles.backdrop} onClick={() => dispatch({ type: 'SET_SHELF', open: false })} />

      {/* 面板外壳：横向扩展 */}
      <aside className={`${styles.panel} ${topicsOpen ? styles.panelExpanded : ''} glass`}>

        {/* ── 左侧书单栏 ── */}
        <div className={styles.leftPane}>
          {/* Header */}
          <div className={styles.header}>
            {/* 话题分类切换按钮（对应 Android 话题分类按钮）*/}
            <button
              className={`${styles.topicsToggleBtn} ${topicsOpen ? styles.topicsToggleBtnActive : ''}`}
              onClick={toggleTopics}
            >
              <Icon name="sparkles" size={14} />
              话题分类
            </button>

            {/* 右侧工具按钮 */}
            <div className={styles.headerActions}>
              <button
                className="btn-icon"
                onClick={() => dispatch({ type: 'SET_SHELF', open: false })}
                aria-label="关闭"
              >
                <Icon name="close" size={16} />
              </button>
            </div>
          </div>

          {/* 书单列表 */}
          <div className={styles.listPane}>
            {loading && (
              <div className={styles.center}>
                <LoadingSpinner text="加载中…" />
              </div>
            )}
            {!loading && !books.length && (
              <div className={styles.center}>
                <p className={styles.hint}>还没有书本</p>
                <p className={styles.hint2}>点击右侧话题，探索感兴趣的内容</p>
              </div>
            )}
            {!loading && books.map((book) => (
              <div
                key={book.id}
                className={`${styles.bookItem} ${book.id === state.currentBookId ? styles.bookItemActive : ''}`}
                onClick={() => openBook(book)}
              >
                {book.coverUrl
                  ? <img src={book.coverUrl} alt={book.title} className={styles.bookCover} />
                  : <div className={styles.bookCoverPlaceholder}><Icon name="bookshelf" size={14} /></div>
                }
                <div className={styles.bookInfo}>
                  <p className={styles.bookTitle}>{book.title || '未命名'}</p>
                  <p className={styles.bookMeta}>{book._count?.pages ?? 0} 页</p>
                </div>
                <button
                  className={`btn-icon ${styles.deleteBtn}`}
                  onClick={(e) => handleDelete(e, book.id)}
                  aria-label="删除"
                >
                  <Icon name="close" size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ── 右侧话题栏（对应 Android rightPane：分类列 | 话题列）── */}
        {topicsOpen && (
          <div className={styles.rightPane}>
            {/* 分类列（左，120px）*/}
            <div className={styles.categoriesCol}>
              {loadingCats && <p className={styles.loadingText}>加载中…</p>}
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className={`${styles.categoryItem} ${cat.id === activeCategoryId ? styles.categoryActive : ''}`}
                  onClick={() => setActiveCatId(cat.id)}
                >
                  {cat.name}
                </div>
              ))}
            </div>

            {/* 话题列（右，撑满）*/}
            <div className={styles.topicsCol}>
              {!activeCategory && !loadingCats && (
                <p className={styles.emptyText}>暂无话题</p>
              )}
              {activeCategory?.topics.map((topic) => (
                <TopicItem
                  key={topic.id}
                  topic={topic}
                  onSelect={() => onSelectTopic?.(topic.name)}
                />
              ))}
            </div>
          </div>
        )}
      </aside>
    </>
  );
}

/** 单个话题行（对应 Android .topicItem）*/
function TopicItem({ topic, onSelect }) {
  return (
    <div className={styles.topicItem} onClick={onSelect}>
      <span>{topic.name}</span>
      <span className={styles.topicArrow}>›</span>
    </div>
  );
}
