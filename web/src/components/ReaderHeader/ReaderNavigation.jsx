import { useAppState } from '../../contexts/AppStateContext.jsx';
import { Icon } from '../common/Icons.jsx';
import styles from './ReaderNavigation.module.css';

/** 左上角阅读导航，保留目录、书页面树及当前页解读入口。 */
export function ReaderNavigation({ treePage, onTree, onNavigate, children }) {
  const { state, dispatch } = useAppState();
  const reading = treePage || state;
  const page = reading.bookFlat?.find(item => item.id === reading.currentPageId);
  const pageTitle = page?.title || (state.currentPageId ? '当前探索' : '');
  const toggle = type => { onNavigate?.(); dispatch({ type }); };
  return (
    <nav className={styles.navigation} aria-label="阅读导航" id="reader-navigation">
      <button className={`${styles.directoryButton} ${state.shelfOpen ? styles.active : ''}`}
        aria-pressed={state.shelfOpen}
        onClick={() => toggle('TOGGLE_SHELF')} aria-label="知识树" title="知识树" id="btn-shelf" data-dialog-return-focus>
        <Icon name="tree" size={18} />
      </button>
      {reading.currentBookTitle && (
        <button className={styles.titleButton} id="btn-book-title"
          title={treePage ? `${reading.currentBookTitle} · ${pageTitle}` : reading.currentBookTitle}
          aria-label={treePage ? '我的知识树' : '书页面树'} onClick={() => treePage ? onTree() : toggle('TOGGLE_PAGETREE')}>
          <span className={styles.titleText}>{reading.currentBookTitle}</span>
        </button>
      )}
      {pageTitle && <>
        <button className={`${styles.explanationButton} ${state.explanationOpen ? styles.active : ''}`} id="btn-explanation"
          title={`${pageTitle} · AI 解读`} aria-label="AI 解读" aria-expanded={state.explanationOpen}
          aria-controls="ai-explanation-panel" onClick={() => toggle('TOGGLE_EXPLANATION')}>
          <Icon name="lightbulb" size={16} /><span>AI 解读</span>
        </button>
        {children}
      </>}
    </nav>
  );
}
