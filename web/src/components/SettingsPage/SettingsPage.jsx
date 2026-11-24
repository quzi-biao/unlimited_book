import { useState, useEffect } from 'react';
import { useAppState } from '../../contexts/AppStateContext.jsx';
import { getVoices, setVoice, getPromptStyles, setPromptStyle, factoryReset } from '../../api/device.js';
import { LoadingSpinner } from '../common/LoadingSpinner.jsx';
import { Icon } from '../common/Icons.jsx';
import styles from './SettingsPage.module.css';

/**
 * SettingsPage — 设置抽屉
 * Tab：音色 / 画风 / 账户
 */
export function SettingsPage({ onKnowledgeAccount, onToast }) {
  const { state, dispatch } = useAppState();
  const [tab, setTab] = useState('voice');

  if (!state.settingsOpen) return null;

  return (
    <>
      <div className={styles.backdrop} onClick={() => dispatch({ type: 'SET_SETTINGS', open: false })} />
      <div className={`${styles.panel} glass-strong`}>
        <div className={styles.header}>
          <h2 className={styles.title}>设置</h2>
          <button className="btn-icon" onClick={() => dispatch({ type: 'SET_SETTINGS', open: false })} aria-label="关闭"><Icon name="close" size={18} /></button>
        </div>

        <div className={styles.tabs}>
          {[['voice', 'voice', '音色'], ['style', 'palette', '画风'], ['account', 'user', '账户']].map(([key, icon, label]) => (
            <button
              key={key}
              className={`${styles.tab} ${tab === key ? styles.tabActive : ''}`}
              onClick={() => setTab(key)}
            >
              <Icon name={icon} size={15} />
              {label}
            </button>
          ))}
        </div>

        <div className={styles.body}>
          {tab === 'voice'   && <VoiceTab   onToast={onToast} />}
          {tab === 'style'   && <StyleTab   onToast={onToast} />}
          {tab === 'account' && <><button className="btn btn-secondary" onClick={onKnowledgeAccount}>我的账号</button><AccountTab onToast={onToast} /></>}
        </div>
      </div>
    </>
  );
}

/** 音色 Tab */
function VoiceTab({ onToast }) {
  const [voices,    setVoices]    = useState([]);
  const [current,  setCurrent]   = useState(null);
  const [loading,  setLoading]   = useState(true);
  const [saving,   setSaving]    = useState(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    getVoices().then(({ voices: v, currentVoiceId }) => {
      setVoices(Array.isArray(v) ? v : []);
      setCurrent(currentVoiceId);
      setError(false);
    }).catch(() => setError(true)).finally(() => setLoading(false));
  }, [attempt]);

  const handleSelect = async (voiceId) => {
    setSaving(voiceId);
    try {
      await setVoice(voiceId);
      setCurrent(voiceId);
      onToast?.({ type: 'success', message: '音色已切换' });
    } catch {
      onToast?.({ type: 'error', message: '切换失败' });
    } finally {
      setSaving(null);
    }
  };

  if (loading) return <div className={styles.center}><LoadingSpinner text="正在加载音色…" /></div>;
  if (error) return <ListState title="音色加载失败" onRetry={() => { setLoading(true); setAttempt(value => value + 1); }} />;
  if (!voices.length) return <ListState title="暂无可用音色" />;

  return (
    <div className={styles.list}>
      {voices.map((v) => (
        <button
          type="button"
          key={v.id}
          className={`${styles.item} ${current === v.voiceId ? styles.itemActive : ''}`}
          aria-pressed={current === v.voiceId}
          disabled={saving !== null}
          onClick={() => handleSelect(v.voiceId)}
        >
          <div className={styles.itemLeft}>
            <Icon name="voice" size={18} className={styles.itemIcon} />
            <div>
              <p className={styles.itemName}>{v.voiceName || v.voiceId}</p>
              {v.description && <p className={styles.itemDesc}>{v.description}</p>}
            </div>
          </div>
          <div className={styles.itemRight}>
            {saving === v.voiceId && <div className={styles.mini_spin} />}
            {current === v.voiceId && saving !== v.voiceId && <Icon name="check" size={18} className={styles.checkmark} />}

          </div>
        </button>
      ))}
    </div>
  );
}

/** 画风 Tab */
function StyleTab({ onToast }) {
  const [styles_,  setStyles_]  = useState([]);
  const [current,  setCurrent]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    getPromptStyles().then(({ styles: s, currentPromptStyleId }) => {
      setStyles_(Array.isArray(s) ? s : []);
      setCurrent(currentPromptStyleId);
      setError(false);
    }).catch(() => setError(true)).finally(() => setLoading(false));
  }, [attempt]);

  const handleSelect = async (id) => {
    setSaving(id);
    try {
      await setPromptStyle(id);
      setCurrent(id);
      onToast?.({ type: 'success', message: '画风已切换' });
    } catch {
      onToast?.({ type: 'error', message: '切换失败' });
    } finally {
      setSaving(null);
    }
  };

  if (loading) return <div className={styles.center}><LoadingSpinner text="正在加载画风…" /></div>;
  if (error) return <ListState title="画风加载失败" onRetry={() => { setLoading(true); setAttempt(value => value + 1); }} />;
  if (!styles_.length) return <ListState title="暂无可用画风" />;

  return (
    <div className={styles.list}>
      {styles_.map((s) => (
        <button
          type="button"
          key={s.id}
          className={`${styles.item} ${current === s.id ? styles.itemActive : ''}`}
          aria-pressed={current === s.id}
          disabled={saving !== null}
          onClick={() => handleSelect(s.id)}
        >
          <div className={styles.itemLeft}>
            <Icon name="palette" size={18} className={styles.itemIcon} />
            <div>
              <p className={styles.itemName}>{s.name}</p>
              <p className={styles.itemDesc}>{s.imageModel}</p>
            </div>
          </div>
          <div className={styles.itemRight}>
            {saving === s.id && <div className={styles.mini_spin} />}
            {current === s.id && saving !== s.id && <Icon name="check" size={18} className={styles.checkmark} />}

          </div>
        </button>
      ))}
    </div>
  );
}

/** 音色与画风共用明确的失败和空列表反馈。 */
function ListState({ title, onRetry }) {
  return <div className={styles.listState} role={onRetry ? 'alert' : 'status'}>
    <p>{title}</p>
    {onRetry && <button type="button" className={styles.retryButton} onClick={onRetry}>重试</button>}
  </div>;
}

/** 账户 Tab */
function AccountTab({ onToast }) {
  const { dispatch } = useAppState();
  const [resetting, setResetting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const handleReset = async () => {
    if (!confirmed) { setConfirmed(true); return; }
    setResetting(true);
    try {
      await factoryReset();
      onToast?.({ type: 'success', message: '数据已清除，请刷新页面' });
      dispatch({ type: 'SET_SETTINGS', open: false });
      setTimeout(() => window.location.reload(), 1500);
    } catch {
      onToast?.({ type: 'error', message: '重置失败' });
    } finally {
      setResetting(false);
      setConfirmed(false);
    }
  };

  return (
    <div className={styles.accountTab}>
      <div className={styles.dangerZone}>
        <h4 className={styles.dangerTitle}>危险操作</h4>
        <p className={styles.dangerDesc}>清除所有云端数据（书本、页面、标注），此操作不可恢复。</p>
        <button
          className={`btn ${confirmed ? styles.dangerConfirm : styles.dangerBtn}`}
          onClick={handleReset}
          disabled={resetting}
        >
          {resetting ? '重置中…' : confirmed ? '再次点击确认重置' : '恢复出厂设置'}
        </button>
      </div>
    </div>
  );
}
