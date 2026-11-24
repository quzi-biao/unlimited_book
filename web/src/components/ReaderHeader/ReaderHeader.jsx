import { useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useAppState } from '../../contexts/AppStateContext.jsx';
import { ExploreQueueBtn } from '../ExploreQueue/ExploreQueue.jsx';
import { Icon } from '../common/Icons.jsx';
import { ReaderNavigation } from './ReaderNavigation.jsx';
import { ReaderNodeActions } from '../../knowledge/ReaderNodeActions.jsx';
import styles from './ReaderHeader.module.css';

/** 顶部左右分别放阅读导航和账户，探索任务另起一行，避免窄屏互相遮挡。 */
export function ReaderHeader({ treePage, onTree, jobs, hidden, queueOpen, onQueueToggle, onCloseQueue, knowledge, onNodePanel }) {
  const { balance, refreshBalance } = useAuth();
  const { state, dispatch } = useAppState();
  const panelOpen = state.settingsOpen || state.shopOpen;
  const accountVisible = !hidden && !panelOpen;

  useEffect(() => {
    if (accountVisible) refreshBalance();
  }, [accountVisible, refreshBalance]);

  /** 打开账户页前收起其他抽屉，返回阅读时不残留遮罩。 */
  function openAccountPage(type) {
    onCloseQueue();
    dispatch({ type: 'SET_SHELF', open: false });
    dispatch({ type: 'SET_PAGETREE', open: false });
    dispatch({ type, open: true });
  }

  if (!accountVisible) return null;

  return (
    <div className={styles.header} id="reader-header">
      {accountVisible && <ReaderNavigation treePage={treePage} onTree={onTree} onNavigate={onCloseQueue}>
        {knowledge?.node && <ReaderNodeActions key={knowledge.node.assetKey} node={knowledge.node}
          onOpen={onNodePanel} onPrint={knowledge.printNode} onExpand={onCloseQueue} />}
      </ReaderNavigation>}
      {accountVisible && (
        <section className={styles.account} aria-label="账户与设置">
          <div className={styles.balance} id="display-balance" aria-label={`学习点数余额 ${balance}`}>
            <Icon name="coin" size={16} />
            <span>{balance.toLocaleString()}</span>
          </div>
          <button type="button" id="btn-shop" aria-label="充值" className={`${styles.button} ${styles.recharge}`} onClick={() => openAccountPage('SET_SHOP')}>
            <Icon name="topup" size={16} /><span className={styles.rechargeLabel}>充值</span>
          </button>
          <button type="button" id="btn-settings" aria-label="设置" className={styles.button} onClick={() => openAccountPage('SET_SETTINGS')}>
            <Icon name="settings" size={18} />
          </button>
        </section>
      )}
      <div className={styles.queue} id="reader-queue-entry">
        <ExploreQueueBtn jobs={jobs} open={queueOpen} onToggle={onQueueToggle} />
      </div>
    </div>
  );
}
