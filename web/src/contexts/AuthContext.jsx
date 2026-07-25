import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { getFingerprint } from '../utils/fingerprint.js';
import { getToken, setToken, setDeviceId, getDeviceId } from '../utils/storage.js';
import { registerDevice, heartbeat, getDeviceInfo } from '../api/device.js';

const AuthContext = createContext(null);

/**
 * AuthProvider — 负责设备注册、Token 持久化、余额管理
 */
export function AuthProvider({ children }) {
  const [token,    setTokenState] = useState(getToken);
  const [deviceId, setDeviceIdState] = useState(getDeviceId);
  const [balance,  setBalance]    = useState(0);
  const [loading,  setLoading]    = useState(true);
  const [error,    setError]      = useState(null);
  const heartbeatRef = useRef(null);

  /** 设备注册/续签 */
  const initAuth = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // FingerprintJS 可能需要稍作等待
      let fp = '';
      for (let i = 0; i < 3; i++) {
        fp = await getFingerprint();
        if (fp) break;
        await new Promise((r) => setTimeout(r, 800));
      }
      if (!fp) throw new Error('无法获取设备指纹，请刷新页面重试');

      const res = await registerDevice(fp, {
        appVersion:  'web-1.0',
        deviceModel: navigator.userAgent.slice(0, 100),
        osVersion:   navigator.platform || 'web',
      });

      setToken(res.token);
      setDeviceId(res.device.id);
      setTokenState(res.token);
      setDeviceIdState(res.device.id);
      setBalance(res.device.balance ?? 0);
    } catch (err) {
      setError(err.message);
      console.error('[Auth] 设备注册失败:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  /** 刷新余额 */
  const refreshBalance = useCallback(async () => {
    try {
      const info = await getDeviceInfo();
      setBalance(info.device.balance ?? 0);
    } catch {}
  }, []);

  // 启动时初始化
  useEffect(() => {
    initAuth();
  }, [initAuth]);

  // Token 存在后启动心跳（每 60s）
  useEffect(() => {
    if (!token) return;
    heartbeatRef.current = setInterval(() => {
      heartbeat('web-1.0').catch(() => {});
    }, 60_000);
    return () => clearInterval(heartbeatRef.current);
  }, [token]);

  const value = { token, deviceId, balance, loading, error, refreshBalance, initAuth };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** @returns {{ token, deviceId, balance, loading, error, refreshBalance }} */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AppProvider');
  return ctx;
}
