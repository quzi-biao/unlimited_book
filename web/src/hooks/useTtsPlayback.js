import { useRef, useState, useCallback, useEffect } from 'react';
import { checkTtsCache, triggerTts, checkAnnotationTtsCache, triggerAnnotationTts } from '../api/tts.js';

const SPEED_LIST = [1, 1.25, 1.5, 1.75, 2, 2.25];
const RATE_KEY   = 'tts_rate';

/** 从 localStorage 恢复上次倍速 */
function loadRate() {
  try {
    const v = parseFloat(localStorage.getItem(RATE_KEY));
    return SPEED_LIST.includes(v) ? v : 1;
  } catch { return 1; }
}

/** 对应 Android TtsChannel */
const CHANNEL = { PAGE: 'page', ANNOTATION: 'annotation' };

/**
 * useTtsPlayback — 对应 Android useTtsPlayback.kt
 *
 * 双通道（PAGE / ANNOTATION）互斥播放。
 * 暴露的 uiState 与 Android TtsPlayerUiState 结构一致：
 *   playbackState: 'idle'|'loading'|'playing'|'paused'|'error'
 *   rate, currentTimeSec, durationSec
 *   bookTitle, pageTitle, annotationMode, sourcePageId
 */
export function useTtsPlayback() {
  const [rate,           setRateState]    = useState(loadRate);
  const [pageState,      setPageState]    = useState('idle');
  const [annState,       setAnnState]     = useState('idle');
  const [annSourceId,    setAnnSourceId]  = useState(null);
  const [currentTimeSec, setCurrentTime]  = useState(0);
  const [durationSec,    setDuration]     = useState(0);

  // 当前元数据
  const pageMetaRef = useRef(null); // { pageId, bookTitle, pageTitle }
  const annMetaRef  = useRef(null); // { pageId, bookTitle, pageTitle, annotationId, annotationText }

  // 播放引擎
  const audioRef    = useRef(null);
  const mountedRef  = useRef(true);
  const channelRef  = useRef(CHANNEL.PAGE);
  const tickerRef   = useRef(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopEngine();
    };
  }, []);

  // ── 内部工具 ──────────────────────────────────────────────

  function isActiveState(s) {
    return s === 'loading' || s === 'playing' || s === 'paused';
  }

  function stopEngine() {
    clearInterval(tickerRef.current);
    tickerRef.current = null;
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    }
    setCurrentTime(0);
    setDuration(0);
  }

  function applyRate(audio, r) {
    try { audio.playbackRate = r; } catch {}
  }

  function startTicker(audio) {
    clearInterval(tickerRef.current);
    tickerRef.current = setInterval(() => {
      if (!mountedRef.current) return;
      setCurrentTime(audio.currentTime);
      setDuration(isFinite(audio.duration) ? audio.duration : 0);
    }, 200);
  }

  // ── 播放单段音频 ─────────────────────────────────────────

  /**
   * 串行播放 segments URL 列表，对应 Android runSegmentLoop
   * @param {'page'|'annotation'} channel
   * @param {string[]} urls
   * @param {number} startIdx
   */
  async function playSegments(channel, urls, startIdx = 0) {
    for (let i = startIdx; i < urls.length; i++) {
      if (!mountedRef.current || channelRef.current !== channel) return;
      await playSingleUrl(channel, urls[i]);
    }
  }

  function playSingleUrl(channel, url) {
    return new Promise((resolve) => {
      if (!mountedRef.current || channelRef.current !== channel) {
        resolve();
        return;
      }
      const audio = new Audio(url);
      audioRef.current = audio;
      const r = rate;
      applyRate(audio, r);

      audio.oncanplay = () => {
        if (!mountedRef.current || channelRef.current !== channel) {
          audio.pause();
          resolve();
          return;
        }
        setDuration(isFinite(audio.duration) ? audio.duration : 0);
        audio.play().catch(() => {});
        startTicker(audio);
        if (channel === CHANNEL.PAGE) setPageState('playing');
        else { setAnnState('playing'); setAnnSourceId(annMetaRef.current?.annotationId || null); }
      };

      audio.onended = () => {
        clearInterval(tickerRef.current);
        resolve();
      };

      audio.onerror = () => {
        clearInterval(tickerRef.current);
        resolve(); // 跳过出错的片段
      };
    });
  }

  // ── 轮询等待 + 播放，对应 Android runSegmentLoop ─────────

  async function runSegmentLoop(channel, checkFn, triggerFn) {
    let played = 0;
    let complete = false;
    let triggered = false;

    while (!complete) {
      if (!mountedRef.current || channelRef.current !== channel) return;
      const cache = await checkFn();
      if (!mountedRef.current || channelRef.current !== channel) return;

      const segments = parseSegments(cache.segments);
      const cached   = !!cache.cached;
      const isComplete = !!cache.complete;

      if (cached && segments.length > played) {
        const newUrls = segments.slice(played);
        played = segments.length;
        await playSegments(channel, newUrls);
        if (!mountedRef.current || channelRef.current !== channel) return;
      }

      if (cached && isComplete && played >= segments.length) {
        complete = true;
      } else {
        if (!triggered) {
          try { await triggerFn(); } catch {}
          triggered = true;
        }
        // 等待下一片段
        if (channel === CHANNEL.PAGE) setPageState((s) => s === 'paused' ? s : 'loading');
        else setAnnState((s) => s === 'paused' ? s : 'loading');
        await sleep(1500);
      }
    }
  }

  function parseSegments(segs) {
    if (!Array.isArray(segs)) return [];
    return segs.map((s) => (typeof s === 'string' ? s : s?.url)).filter(Boolean);
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  // ── error 自动恢复 ────────────────────────────────────────

  function onPlaybackFailure(channel) {
    if (!mountedRef.current) return;
    if (channel === CHANNEL.PAGE) setPageState('error');
    else setAnnState('error');
    setTimeout(() => {
      if (!mountedRef.current) return;
      if (channel === CHANNEL.PAGE) setPageState((s) => s === 'error' ? 'idle' : s);
      else setAnnState((s) => s === 'error' ? 'idle' : s);
    }, 1800);
  }

  function onPlaybackSuccess(channel) {
    if (!mountedRef.current) return;
    if (channel === CHANNEL.PAGE) setPageState('idle');
    else { setAnnState('idle'); setAnnSourceId(null); }
    setCurrentTime(0);
    setDuration(0);
  }

  // ── 开始页面播放 ─────────────────────────────────────────

  function startPagePlayback(pageId, bookTitle, pageTitle) {
    stopEngine();
    channelRef.current = CHANNEL.PAGE;
    pageMetaRef.current = { pageId, bookTitle, pageTitle };
    setPageState('loading');
    setAnnState('idle');
    setAnnSourceId(null);
    annMetaRef.current = null;

    (async () => {
      try {
        await runSegmentLoop(
          CHANNEL.PAGE,
          () => checkTtsCache(pageId, 'zh'),
          () => triggerTts(pageId, 'zh'),
        );
        onPlaybackSuccess(CHANNEL.PAGE);
      } catch (err) {
        if (err?.name !== 'AbortError') onPlaybackFailure(CHANNEL.PAGE);
      }
    })();
  }

  // ── 开始标注播放 ─────────────────────────────────────────

  function startAnnotationPlayback({ annotationId, annotationText, bookTitle, pageTitle, pageId }) {
    if (!annotationId || annotationId.startsWith('local-')) {
      // local 标注：直接返回，暂不支持
      return;
    }
    stopEngine();
    channelRef.current = CHANNEL.ANNOTATION;
    annMetaRef.current = { annotationId, annotationText, bookTitle, pageTitle, pageId };
    setAnnState('loading');
    setAnnSourceId(annotationId);
    setPageState('idle');
    pageMetaRef.current = null;

    (async () => {
      try {
        await runSegmentLoop(
          CHANNEL.ANNOTATION,
          () => checkAnnotationTtsCache(annotationId),
          () => triggerAnnotationTts(annotationId),
        );
        onPlaybackSuccess(CHANNEL.ANNOTATION);
      } catch (err) {
        if (err?.name !== 'AbortError') onPlaybackFailure(CHANNEL.ANNOTATION);
      }
    })();
  }

  // ── pause / resume ────────────────────────────────────────

  function pauseCurrent() {
    const audio = audioRef.current;
    if (audio) { try { audio.pause(); } catch {} }
    clearInterval(tickerRef.current);
    if (channelRef.current === CHANNEL.PAGE) setPageState('paused');
    else setAnnState('paused');
  }

  function resumeCurrent() {
    const audio = audioRef.current;
    if (audio) {
      audio.play().catch(() => {});
      startTicker(audio);
      if (channelRef.current === CHANNEL.PAGE) setPageState('playing');
      else { setAnnState('playing'); }
    }
  }

  // ── 对外接口，对应 Android TtsPlaybackState methods ──────

  /**
   * 圆形按钮点击（对应 Android toggleRound）
   * idle → 开始播放页
   * playing → 暂停
   * paused → 继续
   */
  const toggleRound = useCallback((pageId, bookTitle, pageTitle) => {
    if (!pageId) return;
    // 标注通道优先
    if (isActiveState(annState)) {
      if (annState === 'playing') pauseCurrent();
      else if (annState === 'paused') resumeCurrent();
      return;
    }
    if (pageState === 'idle' || pageState === 'error' || pageMetaRef.current?.pageId !== pageId) {
      startPagePlayback(pageId, bookTitle, pageTitle);
    } else if (pageState === 'playing') {
      pauseCurrent();
    } else if (pageState === 'paused') {
      resumeCurrent();
    }
  }, [pageState, annState]); // eslint-disable-line

  /**
   * 胶囊内播放/暂停按钮（对应 Android togglePlayPause）
   */
  const togglePlayPause = useCallback((pageId, bookTitle, pageTitle) => {
    if (!pageId) return;
    if (isActiveState(annState)) {
      if (annState === 'playing') pauseCurrent();
      else if (annState === 'paused') resumeCurrent();
      return;
    }
    if (pageMetaRef.current?.pageId !== pageId || pageState === 'idle' || pageState === 'error') {
      startPagePlayback(pageId, bookTitle, pageTitle);
      return;
    }
    if (pageState === 'playing') pauseCurrent();
    else if (pageState === 'paused') resumeCurrent();
  }, [pageState, annState]); // eslint-disable-line

  /**
   * 标注播放（对应 Android playAnnotation）
   */
  const playAnnotation = useCallback(({ annotationId, annotationText, bookTitle, pageTitle, pageId }) => {
    if (annState === 'paused' && annMetaRef.current?.annotationId === annotationId) {
      resumeCurrent();
      return;
    }
    if (annState === 'playing' && annMetaRef.current?.annotationId === annotationId) {
      pauseCurrent();
      return;
    }
    startAnnotationPlayback({ annotationId, annotationText, bookTitle, pageTitle, pageId });
  }, [annState]); // eslint-disable-line

  /** seek 进度条 */
  const seekTo = useCallback((sec) => {
    const audio = audioRef.current;
    if (!audio) return;
    const clamp = Math.max(0, Math.min(sec, audio.duration || 0));
    audio.currentTime = clamp;
    setCurrentTime(clamp);
  }, []);

  /** 循环切换倍速，持久化到 localStorage */
  const toggleRate = useCallback(() => {
    setRateState((prev) => {
      const idx = SPEED_LIST.indexOf(prev);
      const next = SPEED_LIST[(idx + 1) % SPEED_LIST.length];
      try { localStorage.setItem(RATE_KEY, String(next)); } catch {}
      if (audioRef.current) applyRate(audioRef.current, next);
      return next;
    });
  }, []);

  /** 停止全部 */
  const stopAll = useCallback(() => {
    stopEngine();
    setPageState('idle');
    setAnnState('idle');
    setAnnSourceId(null);
    pageMetaRef.current = null;
    annMetaRef.current  = null;
    channelRef.current  = CHANNEL.PAGE;
  }, []);

  // ── uiState（对应 Android TtsPlaybackState.uiState）────────

  const annActive  = isActiveState(annState);
  const pageActive = isActiveState(pageState);
  const activeMeta = annActive ? annMetaRef.current : pageMetaRef.current;
  const titleArr   = [activeMeta?.bookTitle, activeMeta?.pageTitle].filter(Boolean);

  const uiState = {
    playbackState: annActive ? annState : pageActive ? pageState : 'idle',
    rate,
    currentTimeSec,
    durationSec,
    bookTitle:     activeMeta?.bookTitle  || '',
    pageTitle:     activeMeta?.pageTitle  || '',
    title:         titleArr.join(' - ')   || '语音播报',
    annotationMode: annActive,
    sourcePageId:  activeMeta?.pageId    || null,
  };

  return {
    uiState,
    pageState,
    annState,
    annSourceId,
    toggleRound,
    togglePlayPause,
    playAnnotation,
    seekTo,
    toggleRate,
    stopAll,
  };
}
