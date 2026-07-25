import { useState, useCallback, useRef, useEffect } from 'react';
import { useAppState } from '../../contexts/AppStateContext.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { generateImage } from '../../api/ai.js';
import { Icon, AppLogo } from '../common/Icons.jsx';
import styles from './ToolBar.module.css';

/**
 * ToolBar — 底部悬浮工具栏（对应 Android ToolBar 底部布局）
 *
 * 布局：
 *   [书架圆形按钮] [书名药丸] [页名药丸]   [搜索区]   [页面树][解读][TTS][余额][充值][设置]
 *
 * 交互：
 *   - 单击空白页面时 hidden 状态淡入淡出（由父组件控制 hidden prop）
 *   - 搜索框 focus 时展开，失焦时收起
 */
export function ToolBar({ onGenerate, onToast, hidden }) {
  const { state, dispatch } = useAppState();
  const { balance } = useAuth();
  const [query, setQuery]       = useState('');
  const [generating, setGenerating] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const inputRef = useRef(null);

  const hasPage  = !!state.currentPageId;
  const bookTitle = state.currentBookTitle;
  const currentPage = state.bookFlat?.find((p) => p.id === state.currentPageId);
  const pageTitle = currentPage?.title || (hasPage ? '当前探索' : '');

  const handleGenerate = useCallback(async () => {
    const q = query.trim();
    if (!q || generating) return;
    setGenerating(true);
    try {
      const result = await generateImage(q, state.currentBookId, null);
      onGenerate?.(result, q);
      setQuery('');
      inputRef.current?.blur();
    } catch (err) {
      onToast?.({ type: 'error', message: err.message || '生成失败，请重试' });
    } finally {
      setGenerating(false);
    }
  }, [query, generating, state.currentBookId, onGenerate, onToast]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
    if (e.key === 'Escape') {
      inputRef.current?.blur();
    }
  };

  return (
    <footer
      className={`${styles.toolbar} ${hidden ? styles.toolbarHidden : ''} glass`}
    >
      {/* ── 左侧：书架 + 药丸 ─────────────────────────────── */}
      <div className={styles.left}>
        {/* 书架圆形按钮 */}
        <button
          className={`${styles.circleBtn} ${state.shelfOpen ? styles.circleBtnActive : ''}`}
          onClick={() => dispatch({ type: 'TOGGLE_SHELF' })}
          aria-label="书架"
          id="btn-shelf"
        >
          <Icon name="bookshelf" size={18} />
        </button>

        {/* 书名药丸 */}
        {bookTitle && (
          <button
            className={`${styles.pill} ${styles.pillBook}`}
            onClick={() => dispatch({ type: 'TOGGLE_PAGETREE' })}
            aria-label="书页面树"
            id="btn-book-title"
          >
            <span className={styles.pillText}>{bookTitle}</span>
          </button>
        )}

        {/* 页面名药丸 */}
        {pageTitle && (
          <button
            className={`${styles.pill} ${styles.pillPage}`}
            onClick={() => hasPage && dispatch({ type: 'TOGGLE_EXPLANATION' })}
            aria-label="AI 解读"
            id="btn-page-title"
          >
            <span className={styles.pillText}>{pageTitle}</span>
          </button>
        )}
      </div>

      {/* ── 中间：搜索框 ──────────────────────────────────── */}
      <div className={`${styles.searchWrap} ${searchFocused ? styles.searchFocused : ''}`}>
        <Icon name="search" size={15} className={styles.searchIcon} />
        <input
          ref={inputRef}
          className={styles.search}
          type="text"
          placeholder="探索新话题…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          id="input-query"
          disabled={generating}
        />
        {(query || searchFocused) && (
          <button
            className={`${styles.generateBtn} ${generating ? styles.generating : ''}`}
            onClick={handleGenerate}
            disabled={generating || !query.trim()}
            id="btn-generate"
          >
            {generating
              ? <Icon name="refresh" size={14} className={styles.spinIcon} />
              : <Icon name="sparkles" size={14} />
            }
            <span>{generating ? '生成中' : '探索'}</span>
          </button>
        )}
      </div>

      {/* ── 右侧：工具图标 ────────────────────────────────── */}
      <div className={styles.right}>
        {/* 余额 */}
        <div className={styles.balance} id="display-balance">
          <Icon name="coin" size={14} className={styles.coinIcon} />
          <span className={styles.balanceNum}>{balance}</span>
        </div>

        {/* 充值 */}
        <button
          className={`${styles.pill} ${styles.pillTopup}`}
          onClick={() => dispatch({ type: 'SET_SHOP', open: true })}
          id="btn-shop"
        >
          <Icon name="topup" size={13} />
          <span>充值</span>
        </button>

        {/* 设置 */}
        <button
          className={styles.iconBtn}
          onClick={() => dispatch({ type: 'SET_SETTINGS', open: true })}
          aria-label="设置"
          id="btn-settings"
        >
          <Icon name="settings" size={18} />
        </button>
      </div>
    </footer>
  );
}
