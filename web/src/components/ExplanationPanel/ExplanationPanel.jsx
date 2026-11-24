import { useState, useEffect, useCallback } from 'react';
import { useAppState } from '../../contexts/AppStateContext.jsx';
import { getExplanation } from '../../api/pages.js';
import { LoadingSpinner } from '../common/LoadingSpinner.jsx';
import { MarkdownRenderer } from '../common/MarkdownRenderer.jsx';
import { Icon } from '../common/Icons.jsx';
import { NodeAudio } from '../../knowledge/NodeAudio.jsx';
import styles from './ExplanationPanel.module.css';

/**
 * ExplanationPanel — 底部 AI 解读面板
 * 懒生成：首次请求时调用 Gemini，之后从 DB 缓存读取
 */
export function ExplanationPanel({ asset, preferences, onToast }) {
  const { state, dispatch } = useAppState();
  const [explanation, setExplanation] = useState('');
  const [loading, setLoading] = useState(false);
  const [lang, setLang] = useState('zh');

  const load = useCallback(async (pageId, lng) => {
    if (!pageId) return;
    setLoading(true);
    setExplanation('');
    try {
      const { explanation: text } = await getExplanation(pageId, lng);
      setExplanation(text);
    } catch (err) {
      onToast?.({ type: 'error', message: err.message || '解读加载失败' });
    } finally {
      setLoading(false);
    }
  }, [onToast]);

  useEffect(() => {
    if (asset) return;
    if (state.explanationOpen && state.currentPageId) {
      load(state.currentPageId, lang);
    } else {
      setExplanation('');
    }
  }, [state.explanationOpen, state.currentPageId, lang, load, asset]);

  if (!state.explanationOpen) return null;
  const content = asset ? asset.explanations?.[lang] : explanation;

  return (
    <div className={`${styles.panel} glass`} id="ai-explanation-panel">
      <div className={styles.header}>
        <h3 className={styles.title}><Icon name="lightbulb" size={16} /> AI 解读</h3>
        <div className={styles.actions}>
          <button
            className={`${styles.langBtn} ${lang === 'zh' ? styles.langActive : ''}`}
            onClick={() => setLang('zh')}
          >中文</button>
          <button
            className={`${styles.langBtn} ${lang === 'en' ? styles.langActive : ''}`}
            onClick={() => setLang('en')}
          >English</button>
          <button
            className="btn-icon"
            onClick={() => dispatch({ type: 'SET_EXPLANATION', open: false })}
            aria-label="关闭"
          ><Icon name="close" size={18} /></button>
        </div>
      </div>

      <div className={styles.body}>
        {asset&&<NodeAudio key={asset.key+':'+lang} asset={asset} language={lang} preferences={preferences} onToast={onToast}/>}
        {loading && <div className={styles.center}><LoadingSpinner text="AI 正在生成解读…" /></div>}
        {!loading && content && (
          <MarkdownRenderer content={content} className={styles.text} />
        )}
        {!loading && !content && (
          <p className={styles.hint}>{asset ? "这页暂无该语言的解读" : "点击页面图片后，解读将在此显示"}</p>
        )}
      </div>
    </div>
  );
}
