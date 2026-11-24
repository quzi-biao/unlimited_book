import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Empty, Statistic, Table, Tag } from 'antd';
import { Link } from 'react-router-dom';
import { adminApi } from '../api';
import styles from './DashboardPage.module.css';

function fenToYuan(fen) {
  return `¥${(Number(fen || 0) / 100).toFixed(2)}`;
}

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchMetrics = useCallback(() => adminApi.dashboard.metrics(), []);

  const retry = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { metrics } = await fetchMetrics();
      setData(metrics);
    } catch (err) {
      setError(err.message || '请检查网络后重试');
    } finally {
      setLoading(false);
    }
  }, [fetchMetrics]);

  useEffect(() => {
    let active = true;
    fetchMetrics()
      .then(({ metrics }) => { if (active) setData(metrics); })
      .catch(err => { if (active) setError(err.message || '请检查网络后重试'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [fetchMetrics]);

  if (loading) return <Card loading />;
  if (error) return <Alert message="经营数据加载失败" description={error} type="error" showIcon
    action={<Button size="small" onClick={retry}>重试</Button>} />;
  if (!data) return <Empty description="暂无经营数据" />;

  const orderStatusMap = {
    pending: { label: '未支付', color: 'default' },
    paid: { label: '已支付', color: 'green' },
    refunded: { label: '已退款', color: 'red' },
    cancelled: { label: '已取消', color: 'default' },
  };

  const ticketTypeMap = {
    system: '系统通知',
    feedback: '客户反馈',
  };

  const ticketStatusMap = {
    open: { label: '开启', color: 'blue' },
    processing: { label: '处理中', color: 'orange' },
    waiting: { label: '等待客户回复', color: 'orange' },
    resolved: { label: '已解决', color: 'green' },
    closed: { label: '已关闭', color: 'default' },
  };

  const orderColumns = [
    { title: '订单号', dataIndex: 'id', key: 'id', width: 136, ellipsis: true },
    { title: '金额', dataIndex: 'amount', key: 'amount', width: 80, render: (v) => fenToYuan(v) },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 100, render: (v) => {
        const s = orderStatusMap[v] || { label: v, color: 'default' };
        return <Tag color={s.color}>{s.label}</Tag>;
      }
    },
    { title: '设备', key: 'device', width: 150, responsive: ['lg'], ellipsis: true, render: (_, r) => r.device ? <Link to={`/admin/devices/${r.deviceId}`}>{r.device.deviceCode}</Link> : '—' },
    { title: '渠道名称', key: 'channel', width: 140, responsive: ['lg'], ellipsis: true, render: (_, r) => r.channel ? <Link to={`/admin/channels/${r.channelId}`}>{r.channel.name}</Link> : '—' },
  ];

  const ticketColumns = [
    { title: '工单', dataIndex: 'title', key: 'title', width: 128, ellipsis: true },
    { title: '类型', dataIndex: 'type', key: 'type', width: 80, render: (v) => ticketTypeMap[v] || v },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 100, render: (v) => {
        const s = ticketStatusMap[v] || { label: v, color: 'default' };
        return <Tag color={s.color}>{s.label}</Tag>;
      }
    },
    { title: '设备', key: 'device', width: 150, responsive: ['lg'], ellipsis: true, render: (_, r) => r.device ? <Link to={`/admin/devices/${r.deviceId}`}>{r.device.deviceCode}</Link> : '—' },
    { title: '渠道名称', key: 'channel', width: 140, responsive: ['lg'], ellipsis: true, render: (_, r) => r.channel ? <Link to={`/admin/channels/${r.channelId}`}>{r.channel.name}</Link> : '—' },
  ];

  return (
    <div className={styles.page}>
      <section className={styles.metrics} aria-label="运营指标">
        <Card className={styles.metric}><Statistic title="设备数" value={data.deviceCount} /></Card>
        <Card className={styles.metric}><Statistic title="在线会话" value={data.onlineCount} /></Card>
        <Card className={styles.metric}><Statistic title="订单数" value={data.orders} /></Card>
        <Card className={styles.metric}><Statistic title="收入" value={fenToYuan(data.revenueFen)} /></Card>
        <Card className={styles.metric}><Statistic title="有效渠道" value={data.channels} /></Card>
        <Card className={styles.metric}><Statistic title="工单数" value={data.tickets} /></Card>
        <Card className={styles.metric}><Statistic title="开放工单" value={data.openTickets} /></Card>
        <Card className={styles.metric}><Statistic title="客单价" value={fenToYuan(data.avgOrderFen)} /></Card>
      </section>

      <Card title="最近订单" className={styles.tableCard}>
        <Table rowKey="id" columns={orderColumns} dataSource={data.recentOrders} pagination={false} size="small" scroll={{ x: 'max-content' }} />
      </Card>

      <Card title="最近工单" className={styles.tableCard}>
        <Table rowKey="id" columns={ticketColumns} dataSource={data.recentTickets} pagination={false} size="small" scroll={{ x: 'max-content' }} />
      </Card>
    </div>
  );
}
