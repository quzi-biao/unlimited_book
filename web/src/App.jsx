import { useState, useCallback, useEffect } from 'react';
import { useAppState } from './contexts/AppStateContext.jsx';
import { useAuth } from './contexts/AuthContext.jsx';
import { ReaderToolBar } from './components/ToolBar/ReaderToolBar.jsx';
import { Viewport } from './components/Viewport/Viewport.jsx';
import { ShelfPanel } from './components/ShelfPanel/ShelfPanel.jsx';
import { PageTreePanel } from './components/PageTreePanel/PageTreePanel.jsx';
import { ExplanationPanel } from './components/ExplanationPanel/ExplanationPanel.jsx';
import { SettingsPage } from './components/SettingsPage/SettingsPage.jsx';
import { ShopPage } from './components/ShopPage/ShopPage.jsx';
import { ToastContainer } from './components/common/Toast.jsx';
import { ExploreQueuePanel } from './components/ExploreQueue/ExploreQueue.jsx';
import { ReaderHeader } from './components/ReaderHeader/ReaderHeader.jsx';
import { expandRegion, cropRegion } from './api/ai.js';
import { getBooks, getPages, getPage, getBook } from './api/books.js';
import { updateAnnotation, getAnnotations } from './api/annotations.js';
import { AppLogo } from './components/common/Icons.jsx';
import { LoadingSpinner } from './components/common/LoadingSpinner.jsx';
import { useTtsPlayback } from './hooks/useTtsPlayback.js';
import { useReadingViewport } from './hooks/useReadingViewport.js';
import { useBrowseTopic } from './hooks/useBrowseTopic.js';
import styles from './App.module.css';

let toastIdSeq = 0;

export default function App() {
  const readingViewportRef = useReadingViewport();
  const { state, dispatch, setCurrentPage } = useAppState();
  const { loading: authLoading, error: authError, initAuth } = useAuth();

  // 托盘状态
  const [toasts, setToasts] = useState([]);

  // TTS 播放状态（对应 Android rememberTtsPlaybackState）
  const tts = useTtsPlayback();
  const ttsActive = tts.uiState.playbackState !== 'idle';

  // 探索队列面板
  const [queueOpen, setQueueOpen] = useState(false);

  // Toolbar 隐藏状态（单击页面时切换）
  const [toolbarHidden, setToolbarHidden] = useState(false);
  const [readerImageWidth, setReaderImageWidth] = useState();

  // 阅读控件收起时一并关闭探索面板，再次点屏幕只恢复入口。
  useEffect(() => {
    if (toolbarHidden && queueOpen) setQueueOpen(false);
  }, [toolbarHidden, queueOpen]);

  // 用 useCallback 稳定引用：TTS ticker 每 200ms 触发重渲染，
  // 若使用内联函数会导致 Viewport useEffect 每次都重新执行，
  // 进而把 toolbarHidden 强制重置为 false。
  const handleCalloutChange = useCallback((isOpen) => setToolbarHidden(isOpen), []);

  // 同理稳定 onToggleToolbar，防止 Viewport 里 handleClick/handleMouseUp
  // 因 TTS ticker 重渲染而持有 stale closure 导致切换失效。
  const handleToggleToolbar = useCallback(() => {
    if (state.currentImageUrl) setToolbarHidden((v) => !v);
  }, [state.currentImageUrl]);

  const addToast = useCallback((toast) => {
    const id = ++toastIdSeq;
    setToasts((prev) => [...prev, { ...toast, id }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // 当 currentBookId 变化时，加载书内页面平铺列表（用于翻页）
  useEffect(() => {
    const bookId = state.currentBookId;
    if (!bookId) {
      dispatch({ type: 'SET_BOOK_FLAT', flat: [] });
      return;
    }
    
    // 如果本地持久化丢失了书名，尝试拉取恢复
    if (!state.currentBookTitle) {
      getBook(bookId)
        .then((data) => {
          if (data?.book?.title) {
            setCurrentPage(bookId, data.book.title, state.currentPageId, state.currentImageUrl);
          }
        })
        .catch(() => {});
    }

    getPages(bookId)
      .then(({ pages }) => {
        dispatch({ type: 'SET_BOOK_FLAT', flat: Array.isArray(pages) ? pages : [] });
      })
      .catch(error => {
        if (error.status === 404) dispatch({ type: 'CLEAR_MISSING_BOOK', bookId });
      });
  }, [state.currentBookId, state.currentBookTitle, state.currentPageId, state.currentImageUrl, dispatch, setCurrentPage]);

  /** 文生图完成后的回调 */
  const handleGenerate = useCallback((result, query) => {
    setCurrentPage(result.bookId, result.bookTitle || query, result.pageId, result.imageUrl);
    addToast({ type: result.reusedBook ? 'info' : 'success', message: result.reusedBook
      ? `已打开书架中的「${result.bookTitle || query}」，未重复生成` : `"${result.pageTitle}" 生成成功` });

    // 更新书内平铺列表中新增的页面（如果是新书则重新加载）
    if (result.bookId) {
      getPages(result.bookId)
        .then(({ pages }) => {
          dispatch({ type: 'SET_BOOK_FLAT', flat: pages || [] });
        })
        .catch(() => {});
    }
  }, [setCurrentPage, addToast, dispatch]);

  /**
   * 深入探索回调 — 对应 Android handleRegionSelect + runExpandTask
   *
   * params:
   *   selectionImageBase64: string | null  ← 可能为 null，尤其点击已有标注时
   *   identification: { description }       ← Android 传 {type:"scene", description}
   *   selectionRegion: { x, y, w, h }       ← 归一化坐标
   *   normBox: { x, y, w, h }               ← 同上
   *   annotationId: string
   *   parentPageId: string
   *   curImageUrl: string                   ← fallback crop 用
   *   bookId: string
   */
  const handleExpandRegion = useCallback(async (params) => {
    const { annotationId, parentPageId, bookId, curImageUrl, normBox, selectionRegion } = params;
    const ann = params.annotation;  // 标注对象（如果有）

    // ── 对应 Android handleRegionSelect exploredPageId 检查：已探索过直接跳转 ────────
    const exploredPageId = ann?.exploredPageId || params.exploredPageId;
    if (exploredPageId) {
      const bid = bookId ?? state.currentBookId;
      try {
        // 先拿到 imageUrl，再跳转（Android 用内存中的 page 对象，Web 需要发请求）
        const { page } = await getPage(exploredPageId);
        setCurrentPage(bid, state.currentBookTitle, exploredPageId, page.imageUrl);
        if (bid) {
          getPages(bid)
            .then(({ pages }) => dispatch({ type: 'SET_BOOK_FLAT', flat: pages || [] }))
            .catch(() => {});
        }
      } catch {
        addToast({ type: 'error', message: '无法加载该页面' });
      }
      return;
    }

    if (!bookId) {
      addToast({ type: 'error', message: '当前页面无关联书籍，无法深入探索' });
      return;
    }

    const curPageId = parentPageId || state.currentPageId;
    const curBookId = bookId || state.currentBookId;
    const desc = params.identification?.description || ann?.explanation || '';
    
    const dedupeKey = annotationId ? `ann-${annotationId}`
      : `topic-${desc.slice(0, 10)}-${curBookId || 'new'}-${curPageId || 'root'}`;

    if (!params._isRetry && state.exploreQueue.some((t) => t.dedupeKey === dedupeKey)) {
      addToast({ type: 'warning', message: '该区域已在探索队列中' });
      return;
    }

    const taskId = params._isRetry || `expand-${Date.now()}`;
    const sourcePageTitle = state.bookFlat.find(p => p.id === curPageId)?.title || '未知页面';

    if (!params._isRetry) {
      dispatch({
        type: 'ADD_EXPLORE_TASK',
        task: { 
          id: taskId, 
          type: 'expand', 
          status: 'loading', 
          label: desc.slice(0, 20) || '深入探索', 
          bookTitle: state.currentBookTitle || '未命名',
          sourcePageTitle,
          dedupeKey,
          payload: {
            identification: params.identification,
            selectionRegion,
            normBox,
            annotationId,
            parentPageId,
            bookId,
            curImageUrl,
          },
          startedAt: Date.now() 
        },
      });
    }
    setQueueOpen(true);

    try {
      // ── 对应 Android runExpandTask: 如果无 imageBase64 则 fallback cropRegion ──────────
      let selectionImageBase64 = params.selectionImageBase64;
      if (!selectionImageBase64 && curImageUrl) {
        const box = normBox ?? selectionRegion;
        if (box) {
          const { imageBase64 } = await cropRegion(curImageUrl, {
            x1: box.x, y1: box.y, x2: box.x + box.w, y2: box.y + box.h,
          });
          selectionImageBase64 = imageBase64;
        }
      }
      if (!selectionImageBase64) {
        throw new Error('无法获取区域图片，请重新框选');
      }

      // ── 对应 Android identification 结构：{type, description} ──────────────────
      const identification = {
        type: params.identification?.type || 'scene',
        description: params.identification?.description ||
                     ann?.explanation ||
                     'A detailed region from the current illustration.',
      };

      // ── 对应 Android selectionRegion 归一化坐标 {x, y, w, h} ────────────────
      const finalSelectionRegion = selectionRegion ?? normBox ?? null;

      const result = await expandRegion({
        selectionImageBase64,
        identification,
        bookId,
        parentPageId: parentPageId || null,
        selectionRegion: finalSelectionRegion,
        annotationId,
      });

      // 对应 Android annotationsApi.update（写 exploredPageId）
      if (annotationId && !annotationId.startsWith('local-') && parentPageId) {
        updateAnnotation(parentPageId, annotationId, { exploredPageId: result.pageId })
          .catch(() => {});
      }

      dispatch({
        type: 'UPDATE_EXPLORE_TASK',
        id: taskId,
        updates: {
          status:         'done',
          pageId:         result.pageId,
          imageUrl:       result.imageUrl,
          bookId,
          label:          result.pageTitle || label,
          annotationId,
          exploredPageId: result.pageId,
        },
      });
      addToast({ type: 'success', message: `「${result.pageTitle}」 已生成，可在队列中查看` });
    } catch (err) {
      dispatch({
        type: 'UPDATE_EXPLORE_TASK',
        id: taskId,
        updates: { status: 'failed', error: err.message || '生成失败' },
      });
      if (!params._isRetry) {
        addToast({ type: 'error', message: err.message || '深入探索失败' });
      }
    }
  }, [dispatch, addToast, state.currentBookId, state.currentBookTitle, state.bookFlat, state.currentPageId, state.exploreQueue, setCurrentPage]);

  /** 重试探索任务 */
  const handleRetryTask = useCallback((taskId) => {
    const task = state.exploreQueue.find((t) => t.id === taskId);
    if (!task || !task.payload) return;
    dispatch({ type: 'UPDATE_EXPLORE_TASK', id: taskId, updates: { status: 'loading', error: null } });
    handleExpandRegion({ ...task.payload, _isRetry: taskId });
  }, [state.exploreQueue, handleExpandRegion, dispatch]);

  const handleBrowseTopic = useBrowseTopic({ state, dispatch, setCurrentPage, setQueueOpen, addToast });

  /**
   * 页面刷新后恢复执行 loading 状态的任务
   * - expand 任务：先查 annotation.exploredPageId，已有则直接 done；否则重新跑
   * - topic  任务：直接重新调 generateImage
   */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const pendingTasks = state.exploreQueue.filter((t) => t.status === 'loading');
    if (!pendingTasks.length) return;

    pendingTasks.forEach(async (task) => {
      try {
        if (task.type === 'topic') {
          // ── topic 任务：查书库是否已有同名书本（刷新前可能已生成完）──
          // 不重新调用 generateImage，避免重复生成
          const query = task.payload?.query;
          if (!query) throw new Error('任务数据缺失');
          const { books } = await getBooks();
          const book = books?.find((b) => b.title === query);
          if (book) {
            const { pages } = await getPages(book.id);
            const first = pages?.[0];
            if (first) {
              dispatch({
                type: 'UPDATE_EXPLORE_TASK',
                id: task.id,
                updates: { status: 'done', pageId: first.id, imageUrl: first.imageUrl, bookId: book.id, label: first.title || query },
              });
              return;
            }
          }
          // 书未生成完 → 标 failed，让用户手动重试
          throw new Error('生成未完成，请重试');

        } else {
          // ── expand 任务：先查 annotation.exploredPageId ───────────
          const { annotationId, parentPageId, bookId } = task.payload || {};
          if (annotationId && parentPageId) {
            try {
              const { annotations } = await getAnnotations(parentPageId);
              const ann = annotations?.find((a) => a.id === annotationId);
              if (ann?.exploredPageId) {
                // 服务端已完成，直接恢复
                const { page } = await getPage(ann.exploredPageId);
                dispatch({
                  type: 'UPDATE_EXPLORE_TASK',
                  id: task.id,
                  updates: { status: 'done', pageId: ann.exploredPageId, imageUrl: page.imageUrl, bookId, exploredPageId: ann.exploredPageId },
                });
                return;
              }
            } catch { /* annotation 查询失败，继续重跑 */ }
          }
          // 服务端未完成，重新跑 expand
          if (task.payload) handleExpandRegion({ ...task.payload, _isRetry: task.id });
          else throw new Error('任务数据缺失');
        }
      } catch (err) {
        dispatch({
          type: 'UPDATE_EXPLORE_TASK',
          id: task.id,
          updates: { status: 'failed', error: err.message || '恢复失败，请重试' },
        });
      }
    });
  // 只在挂载时跑一次
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 从探索队列跳转到已生成的页面 */
  const handleQueueNavigate = useCallback((pageId, imageUrl, bookId) => {
    setCurrentPage(bookId ?? state.currentBookId, state.currentBookTitle, pageId, imageUrl);
    // 刷新 bookFlat
    const bid = bookId ?? state.currentBookId;
    if (bid) {
      getPages(bid)
        .then(({ pages }) => dispatch({ type: 'SET_BOOK_FLAT', flat: pages || [] }))
        .catch(() => {});
    }
  }, [setCurrentPage, state.currentBookId, dispatch]);


  /* ── 认证加载中 ─────────────────────────────────────────── */
  if (authLoading) {
    return (
      <div className={styles.fullCenter}>
        <div className={styles.starfield} />
        <div className={styles.splash}>
          <AppLogo size={88} className={styles.splashLogo} />
          <h1 className={styles.splashTitle}>无限之书</h1>
          <p className={styles.splashSub}>AI 科普图册</p>
          <LoadingSpinner size={28} text="正在初始化…" />
        </div>
      </div>
    );
  }

  if (authError) {
    return (
      <div className={styles.fullCenter}>
        <div className={styles.errorBox}>
          <p className={styles.errorTitle}>连接失败</p>
          <p className={styles.errorDesc}>{authError}</p>
          <button className="btn btn-primary" onClick={initAuth}>重试</button>
        </div>
      </div>
    );
  }

  /* ── 主界面 ─────────────────────────────────────────────── */
  const hasExplanation = state.explanationOpen;

  return (
    <div className={styles.app}>
      <div className="starfield" />


      {/* 主内容区 */}
      <main ref={readingViewportRef}
        className={styles.main}
        style={{
          paddingBottom: hasExplanation
            ? 'min(40vh, 480px)'
            : '0',
        }}
        onClick={undefined}
      >
        <Viewport
          onImageFrameChange={setReaderImageWidth}
          onToast={addToast}
          onExpandRegion={handleExpandRegion}
          onToggleToolbar={handleToggleToolbar}
          onCalloutChange={handleCalloutChange}
          ttsState={tts.annState !== 'idle' ? tts.annState : tts.pageState !== 'idle' ? tts.pageState : 'idle'}
          ttsSrcId={tts.annSourceId}
          onPlayAnnotation={(ann) => {
            // 对应 Android onPlayAnnotation：播放标注语音
            tts.playAnnotation({
              annotationId:   ann.id,
              annotationText: ann.explanation,
              bookTitle:      state.currentBookTitle || '',
              pageTitle:      state.bookFlat.find((p) => p.id === state.currentPageId)?.title || '',
              pageId:         state.currentPageId,
            });
          }}
        />
      </main>

      {/* 面板 */}
      <ShelfPanel onToast={addToast} onSelectTopic={handleBrowseTopic} />
      <PageTreePanel onToast={addToast} />
      <ExplanationPanel onToast={addToast} />
      <SettingsPage onToast={addToast} />
      <ShopPage onToast={addToast} />

      {/* 导航位于左上角，账户位于右上角，探索任务另起一行。 */}
      <ReaderHeader hidden={toolbarHidden} queueOpen={queueOpen}
        onQueueToggle={() => setQueueOpen((v) => !v)} onCloseQueue={() => setQueueOpen(false)} />
      <ExploreQueuePanel
        open={queueOpen && !toolbarHidden && !state.settingsOpen && !state.shopOpen}
        onClose={() => setQueueOpen(false)}
        onNavigate={handleQueueNavigate}
        onRetry={handleRetryTask}
      />

      {/* Toast 通知 */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* 底部工具栏（最后渲染，确保在面板之上） */}
      <ReaderToolBar
        imageWidth={readerImageWidth}
        onGenerate={handleGenerate}
        tts={tts}
        onToast={addToast}
        hidden={toolbarHidden}
      />
    </div>
  );
}
