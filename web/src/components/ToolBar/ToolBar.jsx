import { useState, useCallback, useRef } from 'react';
import { generateImage } from '../../api/ai.js';
import { findTopicBook } from '../../api/books.js';
import { Icon } from '../common/Icons.jsx';
import styles from './ToolBar.module.css';

/**
 * ToolBar — 底部悬浮工具栏（对应 Android ToolBar 底部布局）
 *
 * 布局：
 *   [搜索区] [播放]；书架、书名、页名在左上角
 *
 * 交互：
 *   - 单击空白页面时 hidden 状态淡入淡出（由父组件控制 hidden prop）
 *   - 搜索框 focus 时展开，失焦时收起
 */
export function ToolBar({ onSearch, safe, onGenerate, onToast, hidden, playbackControl, imageWidth }) {
  const [query, setQuery]       = useState('');
  const [generating, setGenerating] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const inputRef = useRef(null);

  const handleGenerate = useCallback(async () => {
    const q = query.trim();
    if (!q || generating) return;
    setGenerating(true);
    try {
      if (onSearch) { await onSearch(q); } else {
      const { existing } = await findTopicBook(q);
      const result = existing || await generateImage(q);
      onGenerate?.(result, q);
      }
      setQuery('');
      inputRef.current?.blur();
    } catch (err) {
      onToast?.({ type: 'error', message: err.message || '生成失败，请重试' });
    } finally {
      setGenerating(false);
    }
  }, [query, generating, onGenerate, onSearch, onToast]);

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
      className={`${styles.toolbar} ${hidden ? styles.toolbarHidden : ''}`}
      style={{ '--reader-image-width': imageWidth > 0 ? `${imageWidth}px` : undefined }}
    >
      {/* ── 中间：搜索框 ──────────────────────────────────── */}
      <div className={`${styles.searchWrap} ${searchFocused ? styles.searchFocused : ''}`}>
        <Icon name="search" size={15} className={styles.searchIcon} />
        <input
          ref={inputRef}
          className={styles.search}
          type="text"
          placeholder={safe ? "搜索公共知识树…" : "探索新话题…"}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          id="input-query"
          data-dialog-return-focus
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

      {/* ── 右侧：朗读入口 ────────────────────────────────── */}
      <div className={styles.right}>
        {playbackControl}
      </div>
    </footer>
  );
}
