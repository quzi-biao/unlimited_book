import { useAppState } from '../../contexts/AppStateContext.jsx';
import { Icon } from '../common/Icons.jsx';
import styles from './ReaderNavigation.module.css';

/** 左上角阅读导航，保留目录、书页面树及当前页解读入口。 */
export function ReaderNavigation({ onNavigate }) {
  const { state, dispatch } = useAppState();
  const page = state.bookFlat?.find(item => item.id === state.currentPageId);
  const pageTitle = page?.title || (state.currentPageId ? '当前探索' : '');
  const toggle = type => { onNavigate?.(); dispatch({ type }); };
  return (
    <nav className={styles.navigation} aria-label="阅读导航" id="reader-navigation">
      <button className={`${styles.directoryButton} ${state.shelfOpen ? styles.active : ''}`}
        aria-pressed={state.shelfOpen}
        onClick={() => toggle('TOGGLE_SHELF')} aria-label="目录" title="目录" id="btn-shelf">
        <Icon name="bookshelf" size={18} />
      </button>
      {state.currentBookTitle && (
        <button className={styles.titleButton} id="btn-book-title"
          title={state.currentBookTitle} aria-label="书页面树" onClick={() => toggle('TOGGLE_PAGETREE')}>
          <span className={styles.titleText}>{state.currentBookTitle}</span>
        </button>
      )}
      {pageTitle && (
        <button className={styles.titleButton} id="btn-page-title"
          title={pageTitle} aria-label="AI 解读" onClick={() => toggle('TOGGLE_EXPLANATION')}>
          <span className={styles.titleText}>{pageTitle}</span>
        </button>
      )}
    </nav>
  );
}
