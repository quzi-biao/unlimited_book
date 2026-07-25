import { useState, useEffect, useRef, useCallback } from 'react';
import { useAppState } from '../../contexts/AppStateContext.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { getPlans, createOrder, getOrderStatus } from '../../api/payment.js';
import { LoadingSpinner } from '../common/LoadingSpinner.jsx';
import { Icon } from '../common/Icons.jsx';
import styles from './ShopPage.module.css';
import QRCode from 'qrcode';

/**
 * ShopPage — 套餐购买 + 微信扫码支付
 */
export function ShopPage({ onToast }) {
  const { state, dispatch } = useAppState();
  const { refreshBalance }  = useAuth();
  const [plans,    setPlans]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState(null);
  const [qrState,  setQrState]  = useState(null); // { codeUrl, orderId, qrDataUrl }
  const [paying,   setPaying]   = useState(false);
  const pollRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!state.shopOpen) return;
    getPlans().then(({ plans: p }) => { setPlans(p); if (p.length) setSelected(p[0].id); })
      .catch(() => onToast?.({ type: 'error', message: '加载套餐失败' }))
      .finally(() => setLoading(false));
  }, [state.shopOpen]);

  useEffect(() => () => clearInterval(pollRef.current), []);

  /** 生成二维码 */
  const handlePay = useCallback(async () => {
    if (!selected || paying) return;
    setPaying(true);
    try {
      const { codeUrl, orderId } = await createOrder(selected);
      const qrDataUrl = await QRCode.toDataURL(codeUrl, {
        width: 240,
        margin: 2,
        color: { dark: '#0a0e1a', light: '#f0c060' },
      });
      setQrState({ codeUrl, orderId, qrDataUrl });

      // 轮询订单状态（最多 5 分钟）
      let polls = 0;
      pollRef.current = setInterval(async () => {
        polls++;
        if (polls > 100) {
          clearInterval(pollRef.current);
          setQrState(null);
          onToast?.({ type: 'warning', message: '二维码已过期，请重新生成' });
          setPaying(false);
          return;
        }
        try {
          const { status, balance } = await getOrderStatus(orderId);
          if (status === 'paid') {
            clearInterval(pollRef.current);
            setQrState(null);
            setPaying(false);
            onToast?.({ type: 'success', message: '支付成功！点数已到账' });
            await refreshBalance();
            dispatch({ type: 'SET_SHOP', open: false });
          }
        } catch {}
      }, 3000);
    } catch (err) {
      onToast?.({ type: 'error', message: err.message || '创建订单失败' });
      setPaying(false);
    }
  }, [selected, paying, refreshBalance, dispatch, onToast]);

  const handleClose = () => {
    clearInterval(pollRef.current);
    setQrState(null);
    setPaying(false);
    dispatch({ type: 'SET_SHOP', open: false });
  };

  if (!state.shopOpen) return null;

  return (
    <>
      <div className={styles.backdrop} onClick={handleClose} />
      <div className={`${styles.panel} glass-strong`}>
        <div className={styles.header}>
          <h2 className={styles.title}><Icon name="topup" size={20} /> 学习点数充値</h2>
          <button className="btn-icon" onClick={handleClose} aria-label="关闭"><Icon name="close" size={18} /></button>
        </div>

        {loading && <div className={styles.center}><LoadingSpinner text="加载套餐…" /></div>}

        {!loading && !qrState && (
          <div className={styles.body}>
            <p className={styles.subtitle}>选择适合你的套餐</p>
            <div className={styles.planGrid}>
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className={`${styles.planCard} ${selected === plan.id ? styles.planSelected : ''}`}
                  onClick={() => setSelected(plan.id)}
                >
                  <div className={styles.planPoints}>{plan.points.toLocaleString()}</div>
                  <div className={styles.planPointsLabel}>学习点数</div>
                  <div className={styles.planName}>{plan.name}</div>
                  <div className={styles.planPrice}>¥{(plan.price / 100).toFixed(2)}</div>
                </div>
              ))}
            </div>

            <button
              className={`btn btn-primary ${styles.payBtn}`}
              onClick={handlePay}
              disabled={!selected || paying}
            >
              {paying ? '生成中…' : '微信扫码支付'}
            </button>
          </div>
        )}

        {/* 二维码展示 */}
        {qrState && (
          <div className={styles.qrBody}>
            <p className={styles.qrHint}>请用微信扫码完成支付</p>
            <div className={styles.qrWrap}>
              <img src={qrState.qrDataUrl} alt="微信支付二维码" className={styles.qrImg} />
            </div>
            <p className={styles.qrDesc}>支付完成后将自动跳转 · 二维码 5 分钟内有效</p>
            <button
              className="btn btn-ghost"
              onClick={() => { clearInterval(pollRef.current); setQrState(null); setPaying(false); }}
            >
              重新生成
            </button>
          </div>
        )}
      </div>
    </>
  );
}
