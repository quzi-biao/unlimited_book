import { useEffect, useState } from 'react';
import { Button, Card, Drawer, Form, Input, Modal, Select, Table, Tag, Typography, App } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { adminApi } from '../api';

const { Title, Text } = Typography;

const ticketTypes = {
  device: '设备故障',
  payment: '支付问题',
  refund: '退款申请',
  feedback: '意见反馈',
  other: '其他',
};

const ticketStatuses = {
  open: { label: '待处理', color: 'blue' },
  processing: { label: '处理中', color: 'processing' },
  waiting: { label: '等待用户', color: 'gold' },
  resolved: { label: '已解决', color: 'success' },
  closed: { label: '已关闭', color: 'default' },
};

const ticketPriorities = {
  low: { label: '低', color: 'default' },
  medium: { label: '中', color: 'blue' },
  high: { label: '高', color: 'orange' },
  urgent: { label: '紧急', color: 'error' },
};

export default function TicketsPage() {
  const { message } = App.useApp();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [form] = Form.useForm();
  const [detailForm] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminApi.tickets.list();
      setTickets(res.tickets || []);
    } catch (err) {
      message.error(err.message || '获取工单失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    adminApi.tickets.list()
      .then(res => { if (active) setTickets(res.tickets || []); })
      .catch(err => { if (active) message.error(err.message || '获取工单失败'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [message]);

  const createTicket = async () => {
    const values = await form.validateFields();
    try {
      await adminApi.tickets.create(values);
      message.success('工单已创建');
      setOpen(false);
      form.resetFields();
      load();
    } catch (err) {
      message.error(err.message || '创建工单失败');
    }
  };

  const saveDetail = async () => {
    const values = await detailForm.validateFields();
    try {
      await adminApi.tickets.update(detail.id, values);
      message.success('已更新');
      setDetail(null);
      load();
    } catch (err) {
      message.error(err.message || '更新失败');
    }
  };

  const activeCount = tickets.filter(ticket => ['open', 'processing', 'waiting'].includes(ticket.status)).length;

  const columns = [
    { title: '标题', dataIndex: 'title', key: 'title', ellipsis: true },
    { title: '类型', dataIndex: 'type', key: 'type', render: v => ticketTypes[v] || v || '未知' },
    {
      title: '优先级', dataIndex: 'priority', key: 'priority',
      render: v => {
        const priority = ticketPriorities[v] || { label: v || '未知', color: 'default' };
        return <Tag color={priority.color}>{priority.label}</Tag>;
      },
    },
    {
      title: '状态', dataIndex: 'status', key: 'status',
      render: v => {
        const status = ticketStatuses[v] || { label: v || '未知', color: 'default' };
        return <Tag color={status.color}>{status.label}</Tag>;
      },
    },
    { title: '设备', key: 'device', render: (_, r) => r.device?.deviceCode ? <Link to={`/admin/devices/${r.deviceId}`}>{r.device.deviceCode}</Link> : '—' },
    { title: '渠道', key: 'channel', render: (_, r) => r.channel?.name ? <Link to={`/admin/channels/${r.channelId}`}>{r.channel.name}</Link> : '—' },
    { title: '留言数', key: 'msgs', render: (_, r) => r._count?.messages ?? 0 },
    { title: '操作', key: 'action', width: 80, fixed: 'right', render: (_, r) => <Button type="link" onClick={() => { setDetail(r); detailForm.setFieldsValue(r); }}>处理</Button> },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>客服工单</Title>
          <Text type="secondary">全部 {tickets.length} 条 · 待处理 {activeCount} 条</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>新建工单</Button>
      </div>

      <Card>
        <Table rowKey="id" columns={columns} dataSource={tickets} loading={loading} pagination={false} size="small" scroll={{ x: 900 }} />
      </Card>

      <Modal title="新建工单" open={open} onCancel={() => setOpen(false)} onOk={createTicket} destroyOnClose>
        <Form form={form} layout="vertical" initialValues={{ type: 'feedback', priority: 'medium' }}>
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}><Input /></Form.Item>
          <Form.Item name="type" label="类型"><Select options={[{ value: 'device', label: '设备故障' }, { value: 'payment', label: '支付退款' }, { value: 'refund', label: '退款' }, { value: 'feedback', label: '意见反馈' }, { value: 'other', label: '其他' }]} /></Form.Item>
          <Form.Item name="priority" label="优先级"><Select options={[{ value: 'low', label: '低' }, { value: 'medium', label: '中' }, { value: 'high', label: '高' }, { value: 'urgent', label: '紧急' }]} /></Form.Item>
          <Form.Item name="contactName" label="联系人"><Input /></Form.Item>
          <Form.Item name="contactPhone" label="联系电话"><Input /></Form.Item>
          <Form.Item name="description" label="描述" rules={[{ required: true, message: '请输入描述' }]}><Input.TextArea rows={5} /></Form.Item>
        </Form>
      </Modal>

      <Drawer title="处理工单" open={!!detail} onClose={() => setDetail(null)} width={520}>
        {detail && (
          <Form form={detailForm} layout="vertical" initialValues={detail}>
            <Form.Item name="status" label="状态"><Select options={[{ value: 'open', label: '待处理' }, { value: 'processing', label: '处理中' }, { value: 'waiting', label: '等待用户' }, { value: 'resolved', label: '已解决' }, { value: 'closed', label: '已关闭' }]} /></Form.Item>
            <Form.Item name="priority" label="优先级"><Select options={[{ value: 'low', label: '低' }, { value: 'medium', label: '中' }, { value: 'high', label: '高' }, { value: 'urgent', label: '紧急' }]} /></Form.Item>
            <Form.Item name="resolution" label="处理结论"><Input.TextArea rows={4} /></Form.Item>
            <Button type="primary" onClick={saveDetail} style={{ marginBottom: 24 }}>保存</Button>
            
            {detail.messages && detail.messages.length > 0 && (
              <div>
                <Title level={5}>客户留言</Title>
                <div style={{ background: '#fafafa', padding: 12, borderRadius: 8 }}>
                  {detail.messages.map(m => (
                    <div key={m.id} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid #f0f0f0' }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>{new Date(m.createdAt).toLocaleString()} [{m.authorType === 'customer' ? '客户' : '客服'}]</Text>
                      <div style={{ marginTop: 4 }}>{m.content}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Form>
        )}
      </Drawer>
    </div>
  );
}
