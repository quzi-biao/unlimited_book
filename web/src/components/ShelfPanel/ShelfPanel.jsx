import { useCallback } from 'react';
import { useAppState } from '../../contexts/AppStateContext.jsx';
import { Icon } from '../common/Icons.jsx';
import { LearningNudge } from '../../knowledge/LearningNudge.jsx';
import { TreeMap } from '../../knowledge/TreeMap.jsx';
import styles from './ShelfPanel.module.css';

/** 目录入口直接展示个人知识树，不再呈现独立书架视图。 */
export function ShelfPanel({ knowledge, onLearning, onAccount, onClose, onToast }) {
  const { state, dispatch } = useAppState();
  const { snapshot } = knowledge;
  const profile = snapshot.profile;

  /** 选择节点后收起目录，再进入原阅读器。 */
  const selectNode = useCallback(node => {
    dispatch({ type: 'SET_SHELF', open: false });
    knowledge.openNode(node);
  }, [dispatch, knowledge.openNode]);

  if (!state.shelfOpen) return null;

  const exploredCount = snapshot.nodes.filter(node => node.lit).length;
  const selectedTree = snapshot.trees.find(tree => tree.id === profile.selectedTreeId);
  return <>
    <div className={styles.backdrop} onClick={onClose} />
    <aside className={`knowledge-app shelf-dialog shelf-integrated ${styles.panel} glass`}
      role="dialog" aria-modal="true" aria-label="知识树">
      <header className={styles.header}>
        <h2 className={styles.drawerTitle}>知识树</h2>
        <div className={styles.headerActions}>
          {onLearning && <button type="button" className={styles.utilityButton} aria-label="学习足迹" title="学习足迹" onClick={onLearning}>
            <span className={styles.utilityFullLabel}>学习足迹</span><span className={styles.utilityCompactLabel}>足迹</span>
          </button>}
          {onAccount && <button type="button" className={styles.utilityButton} aria-label="我的账号" title="我的账号" onClick={onAccount}>
            <span className={styles.utilityFullLabel}>我的账号</span><span className={styles.utilityCompactLabel}>账号</span>
          </button>}
          <button className="btn-icon" onClick={onClose} aria-label="返回阅读"><Icon name="close" size={16} /></button>
        </div>
      </header>

      <section className={styles.treePane} aria-label="个人知识树">
        <div className={styles.treeHeading}>
          <div className={styles.treeTitle}>
            {selectedTree && <h2>{selectedTree.title}</h2>}
            <span>{exploredCount} 个节点已点亮</span>
          </div>
          <div className={styles.treeControls}>
            <label>选择知识树
              <select aria-label="选择公共知识树" value={profile.selectedTreeId || ''}
                disabled={!snapshot.trees.length}
                onChange={event => knowledge.settings({ selectedTreeId: event.target.value }).catch(error => onToast?.({ type: 'error', message: error.message }))}>
                {!snapshot.trees.length && <option value="">暂无已发布知识树</option>}
                {snapshot.trees.map(tree => <option value={tree.id} key={tree.id}>{tree.title}</option>)}
              </select>
            </label>
            <label>模式
              <select aria-label="探索模式" value={profile.mode}
                onChange={event => knowledge.settings({ mode: event.target.value }).catch(error => onToast?.({ type: 'error', message: error.message }))}>
                <option value="infinite">无限模式</option><option value="safe">安全模式</option>
              </select>
            </label>
          </div>
        </div>
        <LearningNudge snapshot={snapshot} onOpen={selectNode} />
        <div className={styles.mapWrap}>
          <TreeMap nodes={snapshot.nodes} connections={snapshot.connections}
            selected={knowledge.node?.assetKey} onSelect={selectNode} />
        </div>
        <footer className={styles.syncStatus}>
          <span>{knowledge.pending ? `${knowledge.pending} 条记录等待同步` : knowledge.status} · {knowledge.mediaStatus}</span>
          <button type="button" onClick={knowledge.sync}>立即同步</button>
        </footer>
      </section>
    </aside>
  </>;
}
