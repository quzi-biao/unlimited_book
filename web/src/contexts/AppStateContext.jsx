import { createContext, useContext, useReducer, useCallback, useEffect } from 'react';

/**
 * AppStateContext — 全局 UI 状态
 * 对应 Android AppScreen 的顶层 state
 */

const AppStateContext = createContext(null);

/** localStorage keys */
const SESSION_KEY = 'flipbook_session';
const QUEUE_KEY   = 'flipbook_explore_queue_v1';  // 对应 Android PREF/KEY

/**
 * 从 localStorage 恢复上次会话（书+页）
 */
function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return {};
    const { bookId, bookTitle, pageId, imageUrl } = JSON.parse(raw);
    if (bookId && pageId && imageUrl) {
      return { currentBookId: bookId, currentBookTitle: bookTitle || '', currentPageId: pageId, currentImageUrl: imageUrl };
    }
  } catch { /* ignore */ }
  return {};
}

function saveSession(bookId, bookTitle, pageId, imageUrl) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ bookId, bookTitle, pageId, imageUrl }));
  } catch { /* ignore */ }
}

/**
 * 从 localStorage 恢复探索队列（对应 Android loadQueue()）
 * 重启时把 loading（exploring）状态改为 failed
 */
function loadQueue() {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // 刷新后保持 loading 状态，由 App 恢复执行（对应 Android 的 retry 机制）
    return parsed;
  } catch { return []; }
}

function saveQueue(queue) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch { /* ignore */ }
}

const initialState = {
  currentBookId:    null,
  currentBookTitle: '',
  currentPageId:    null,
  currentImageUrl:  null,
  bookFlat:         [],
  shelfOpen:        false,
  pageTreeOpen:     false,
  explanationOpen:  false,
  settingsOpen:     false,
  shopOpen:         false,
  isSelecting:      false,
  exploreQueue:     [],  // ← 启动时从 localStorage 恢复
  sessionRestored:  false,

};

function reducer(state, action) {
  switch (action.type) {
    case 'CLEAR_MISSING_BOOK':
      if (state.currentBookId !== action.bookId) return state;
      return { ...state, currentBookId: null, currentBookTitle: '', currentPageId: null,
        currentImageUrl: null, bookFlat: [], exploreQueue: state.exploreQueue.filter(t => t.bookId !== action.bookId) };
    case 'SET_CURRENT_PAGE':
      return {
        ...state,
        currentBookId:    action.bookId    ?? state.currentBookId,
        currentBookTitle: action.bookTitle ?? state.currentBookTitle,
        currentPageId:    action.pageId,
        currentImageUrl:  action.imageUrl,
      };
    case 'SET_BOOK_FLAT':
      return { ...state, bookFlat: action.flat };
    case 'TOGGLE_SHELF':
      return { ...state, shelfOpen: !state.shelfOpen };
    case 'SET_SHELF':
      return { ...state, shelfOpen: action.open };
    case 'TOGGLE_PAGETREE':
      return { ...state, pageTreeOpen: !state.pageTreeOpen };
    case 'SET_PAGETREE':
      return { ...state, pageTreeOpen: action.open };
    case 'TOGGLE_EXPLANATION':
      return { ...state, explanationOpen: !state.explanationOpen };
    case 'SET_EXPLANATION':
      return { ...state, explanationOpen: action.open };
    case 'SET_SETTINGS':
      return { ...state, settingsOpen: action.open };
    case 'SET_SHOP':
      return { ...state, shopOpen: action.open };
    case 'SET_SELECTING':
      return { ...state, isSelecting: action.value };
    case 'ADD_EXPLORE_TASK':
      if (state.exploreQueue.length >= 5) return state;
      return { ...state, exploreQueue: [...state.exploreQueue, action.task] };
    case 'UPDATE_EXPLORE_TASK':
      return {
        ...state,
        exploreQueue: state.exploreQueue.map((t) =>
          t.id === action.id ? { ...t, ...action.updates } : t
        ),
      };
    case 'REMOVE_EXPLORE_TASK':
      return {
        ...state,
        exploreQueue: state.exploreQueue.filter((t) => t.id !== action.id),
      };
    default:
      return state;
  }
}

export function AppStateProvider({ children, deviceShelf = true, initialShelfOpen = false, openForTreePanel = false }) {
  const [state, dispatch] = useReducer(reducer, initialState, base => ({
    ...(deviceShelf ? { ...base, ...loadSession(), exploreQueue: loadQueue() } : base),
    shelfOpen: initialShelfOpen,
  }));

  useEffect(() => {
    if (openForTreePanel) dispatch({ type: 'SET_SHELF', open: true });
  }, [openForTreePanel]);

  /** 设置当前页面，同步持久化到 localStorage */
  const setCurrentPage = useCallback((bookId, bookTitle, pageId, imageUrl) => {
    dispatch({ type: 'SET_CURRENT_PAGE', bookId, bookTitle, pageId, imageUrl });
    if (deviceShelf) saveSession(bookId, bookTitle, pageId, imageUrl);
  }, [deviceShelf]);

  /** 队列变化时持久化（对应 Android persist()） */
  useEffect(() => {
    if (deviceShelf) saveQueue(state.exploreQueue);
  }, [deviceShelf, state.exploreQueue]);

  useEffect(() => {
    if (deviceShelf && !state.currentBookId) localStorage.removeItem(SESSION_KEY);
  }, [deviceShelf, state.currentBookId]);

  const value = { state, dispatch, setCurrentPage };
  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be inside AppStateProvider');
  return ctx;
}
