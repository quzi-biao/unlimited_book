import { useState, useEffect, useCallback } from 'react';
import { useAppState } from '../../contexts/AppStateContext.jsx';
import { getPages } from '../../api/books.js';
import { deletePage } from '../../api/pages.js';
import { LoadingSpinner } from '../common/LoadingSpinner.jsx';
import styles from './PageTreePanel.module.css';

/**
 * PageTreePanel — 右侧页面层级树
 * 展示当前书本的所有页面（树形结构），点击切换图片
 */
export function PageTreePanel({ onToast }) {
  const { state, dispatch, setCurrentPage } = useAppState();
  const [pages, setPages] = useState([]);
  const [tree,  setTree]  = useState([]);
  const [loading, setLoading] = useState(false);

  const loadPages = useCallback(async () => {
    if (!state.currentBookId) return;
    setLoading(true);
    try {
      const res = await getPages(state.currentBookId);
      setPages(res.pages);
      setTree(res.tree);
    } catch {
      onToast?.({ type: 'error', message: '加载页面树失败' });
    } finally {
      setLoading(false);
    }
  }, [state.currentBookId, onToast]);

  useEffect(() => {
    if (state.pageTreeOpen) loadPages();
  }, [state.pageTreeOpen, loadPages]);

  // 当前书本或页面变更时也刷新
  useEffect(() => {
    if (state.pageTreeOpen && state.currentBookId) loadPages();
  }, [state.currentPageId]);

  if (!state.pageTreeOpen) return null;

  return (
    <>
      <div className={styles.backdrop} onClick={() => dispatch({ type: 'SET_PAGETREE', open: false })} />
      <aside className={`${styles.panel} glass`}>
        <div className={styles.header}>
          <h3 className={styles.title}>页面树</h3>
          <button
            className="btn-icon"
            onClick={loadPages}
            data-tooltip="刷新"
            style={{ fontSize: 16 }}
          >↻</button>
        </div>

        <div className={styles.content}>
          {loading && <div className={styles.center}><LoadingSpinner /></div>}
          {!loading && !tree.length && (
            <p className={styles.hint}>暂无页面</p>
          )}
          {!loading && tree.map((node) => (
            <TreeNode
              key={node.id}
              node={node}
              depth={0}
              currentPageId={state.currentPageId}
              currentBookId={state.currentBookId}
              setCurrentPage={setCurrentPage}
              onDelete={(id) => setTree((prev) => removeNode(prev, id))}
              onToast={onToast}
            />
          ))}
        </div>
      </aside>
    </>
  );
}

function TreeNode({ node, depth, currentPageId, currentBookId, setCurrentPage, onDelete, onToast }) {
  const [expanded, setExpanded] = useState(true);
  const isActive = node.id === currentPageId;

  const handleClick = () => {
    setCurrentPage(currentBookId, null, node.id, node.imageUrl);
  };

  const handleDelete = async (e) => {
    e.stopPropagation();
    try {
      await deletePage(node.id);
      onDelete(node.id);
      onToast?.({ type: 'success', message: '已删除' });
    } catch {
      onToast?.({ type: 'error', message: '删除失败' });
    }
  };

  return (
    <div className={styles.node}>
      <div
        className={`${styles.nodeRow} ${isActive ? styles.active : ''}`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
        onClick={handleClick}
      >
        {node.children?.length > 0 && (
          <button
            className={styles.expandBtn}
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          >
            {expanded ? '▾' : '▸'}
          </button>
        )}
        {!node.children?.length && <span className={styles.leaf}>·</span>}

        {node.imageUrl && (
          <img src={node.imageUrl} alt="" className={styles.thumb} />
        )}

        <span className={styles.nodeTitle} title={node.title || node.prompt}>
          {node.title || node.prompt || '未命名页面'}
        </span>

        <button
          className={`btn-icon ${styles.delBtn}`}
          onClick={handleDelete}
          aria-label="删除页面"
          style={{ fontSize: 12 }}
        >🗑</button>
      </div>

      {expanded && node.children?.map((child) => (
        <TreeNode
          key={child.id}
          node={child}
          depth={depth + 1}
          currentPageId={currentPageId}
          currentBookId={currentBookId}
          setCurrentPage={setCurrentPage}
          onDelete={onDelete}
          onToast={onToast}
        />
      ))}
    </div>
  );
}

/** 从树中删除节点 */
function removeNode(nodes, id) {
  return nodes
    .filter((n) => n.id !== id)
    .map((n) => ({ ...n, children: removeNode(n.children || [], id) }));
}
