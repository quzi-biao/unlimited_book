import React, { useState, useEffect } from 'react';
import { Table, Card, Button, Input, Modal, Select, message, Tag, Typography } from 'antd';

const { Text } = Typography;
import { adminApi } from '../api';
import dayjs from 'dayjs';

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const [channels, setChannels] = useState([]);
  const [channelModalVisible, setChannelModalVisible] = useState(false);
  const [currentOrder, setCurrentOrder] = useState(null);
  const [selectedChannel, setSelectedChannel] = useState(null);

  const [filterStatus, setFilterStatus] = useState(undefined);
  const [filterChannel, setFilterChannel] = useState(undefined);
  const [filterSettlement, setFilterSettlement] = useState(undefined);

  useEffect(() => {
    fetchOrders();
    fetchChannels();
  }, [page]);

  const fetchOrders = async (s = search, fStatus = filterStatus, fChannel = filterChannel, fSettlement = filterSettlement) => {
    setLoading(true);
    try {
      const res = await adminApi.orders.list({ 
        page, 
        limit: 10, 
        search: s,
        ...(fStatus && { status: fStatus }),
        ...(fChannel && { channelId: fChannel }),
        ...(fSettlement && { channelSettlementStatus: fSettlement })
      });
      setOrders(res.orders);
      setTotal(res.total);
    } catch (err) {
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchChannels = async () => {
    try {
      const res = await adminApi.channels.list();
      setChannels(res.channels || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRefund = (order) => {
    Modal.confirm({
      title: '确认退款',
      content: `确定要对该订单（金额: ${order.amount / 100}元）发起退款吗？退款金额将原路返回给用户。`,
      onOk: async () => {
        try {
          await adminApi.orders.refund(order.id);
          message.success('退款请求已提交');
          fetchOrders();
        } catch (err) {
          message.error(err.message);
        }
      }
    });
  };

  const openChannelModal = (r) => {
    setCurrentOrder(r);
    setSelectedChannel(r.channelId);
    setChannelModalVisible(true);
  };

  const submitChannelChange = async () => {
    if (!currentOrder) return;
    try {
      await adminApi.orders.update(currentOrder.id, { channelId: selectedChannel });
      message.success('修改归属渠道成功');
      setChannelModalVisible(false);
      fetchOrders();
    } catch (err) {
      message.error(err.message);
    }
  };

  const columns = [
    { title: '订单号', dataIndex: 'id', key: 'id' },
    { title: '设备编号', dataIndex: ['device', 'deviceCode'], key: 'deviceCode' },
    { title: '套餐/描述', key: 'desc', render: (_, r) => r.plan?.name || `${r.points}点` },
    { title: '金额', key: 'amount', render: (_, r) => `¥${(r.amount / 100).toFixed(2)}` },
    {
      title: '归属渠道',
      key: 'channel',
      render: (_, r) => {
        const c = channels.find(ch => ch.id === r.channelId);
        return c ? c.name : <Text type="secondary">无渠道</Text>;
      }
    },
    {
      title: '状态',
      key: 'status',
      render: (_, r) => {
        if (r.status === 'paid') return <Tag color="success">已支付</Tag>;
        if (r.status === 'refunded') return <Tag color="error">已退款</Tag>;
        if (r.status === 'cancelled') return <Tag color="default">已取消</Tag>;
        return <Tag color="processing">待支付</Tag>;
      }
    },
    {
      title: '渠道结算',
      key: 'channelSettlementStatus',
      render: (_, r) => {
        if (!r.channelId || r.status !== 'paid') return '-';
        return r.channelSettlementStatus === 'settled'
          ? <Tag color="green">已结算</Tag>
          : <Tag color="orange">未结算</Tag>;
      }
    },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', render: (t) => dayjs(t).format('YYYY-MM-DD HH:mm') },
    {
      title: '操作',
      key: 'action',
      render: (_, r) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button size="small" type="link" onClick={() => openChannelModal(r)}>
            归属渠道
          </Button>
          {r.status === 'paid' && (
            <Button size="small" type="text" danger onClick={() => handleRefund(r)}>
              退款
            </Button>
          )}
        </div>
      )
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <Select allowClear placeholder="订单状态" style={{ width: 120 }} value={filterStatus} onChange={v => { setFilterStatus(v); setPage(1); fetchOrders(search, v, filterChannel, filterSettlement); }}>
          <Select.Option value="pending">待支付</Select.Option>
          <Select.Option value="paid">已支付</Select.Option>
          <Select.Option value="refunded">已退款</Select.Option>
          <Select.Option value="cancelled">已取消</Select.Option>
        </Select>
        <Select allowClear placeholder="归属渠道" style={{ width: 150 }} value={filterChannel} onChange={v => { setFilterChannel(v); setPage(1); fetchOrders(search, filterStatus, v, filterSettlement); }}>
          {channels.map(c => <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>)}
        </Select>
        <Select allowClear placeholder="渠道结算状态" style={{ width: 150 }} value={filterSettlement} onChange={v => { setFilterSettlement(v); setPage(1); fetchOrders(search, filterStatus, filterChannel, v); }}>
          <Select.Option value="unsettled">未结算</Select.Option>
          <Select.Option value="settled">已结算</Select.Option>
        </Select>
        <Input.Search
          placeholder="搜索订单号或设备编号"
          allowClear
          onSearch={(v) => { setSearch(v); setPage(1); fetchOrders(v, filterStatus, filterChannel, filterSettlement); }}
          style={{ width: 300 }}
        />
      </div>
      <Card>
        <Table
          dataSource={orders}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ current: page, total, pageSize: 10, onChange: setPage }}
        />
      </Card>

      <Modal
        title="设置订单归属渠道"
        open={channelModalVisible}
        onOk={submitChannelChange}
        onCancel={() => setChannelModalVisible(false)}
        destroyOnClose
      >
        <div style={{ padding: '20px 0' }}>
          <span>选择归属渠道：</span>
          <Select
            style={{ width: 200 }}
            value={selectedChannel}
            allowClear
            placeholder="无渠道"
            onChange={setSelectedChannel}
            options={channels.map(c => ({ label: c.name, value: c.id }))}
          />
        </div>
      </Modal>
    </div>
  );
}
