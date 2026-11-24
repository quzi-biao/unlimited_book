import { useEffect, useState } from 'react';
import { Button, Card, DatePicker, Form, Modal, Select, Table, Tag, Typography, App } from 'antd';
import { adminApi } from '../api';

const { Title, Text } = Typography;

const settlementStatuses = {
  draft: { label: '草稿', color: 'default' },
  confirmed: { label: '已确认', color: 'processing' },
  paid: { label: '已打款', color: 'success' },
};

export default function SettlementsPage() {
  const { message } = App.useApp();
  const [settlements, setSettlements] = useState([]);
  const [channels, setChannels] = useState([]);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const load = async () => {
    try {
      const [sRes, cRes] = await Promise.all([adminApi.settlements.list(), adminApi.channels.list()]);
      setSettlements(sRes.settlements || []);
      setChannels(cRes.channels || []);
    } catch (err) {
      message.error(err.message || '获取结算数据失败');
    }
  };

  useEffect(() => {
    let active = true;
    Promise.all([adminApi.settlements.list(), adminApi.channels.list()])
      .then(([sRes, cRes]) => {
        if (!active) return;
        setSettlements(sRes.settlements || []);
        setChannels(cRes.channels || []);
      })
      .catch(err => { if (active) message.error(err.message || '获取结算数据失败'); });
    return () => { active = false; };
  }, [message]);

  const create = async () => {
    try {
      const values = await form.validateFields();
      const [periodStart, periodEnd] = values.period;
      await adminApi.settlements.generate({
        channelId: values.channelId,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
      });
      message.success('已生成结算草稿');
      setOpen(false);
      form.resetFields();
      load();
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.message || '生成结算草稿失败');
    }
  };

  const columns = [
    { title: '渠道', dataIndex: ['channel', 'name'], key: 'channel' },
    { title: '区间', key: 'range', render: (_, r) => `${String(r.periodStart).slice(0, 10)} ~ ${String(r.periodEnd).slice(0, 10)}` },
    { title: '订单数', dataIndex: 'hardwareOrderCount', key: 'hardwareOrderCount' },
    { title: '渠道分润', dataIndex: 'totalCommissionFen', key: 'totalCommissionFen', render: (v) => `¥${(v / 100).toFixed(2)}` },
    {
      title: '状态', dataIndex: 'status', key: 'status',
      render: v => {
        const status = settlementStatuses[v] || { label: v || '未知', color: 'default' };
        return <Tag color={status.color}>{status.label}</Tag>;
      },
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>结算报表</Title>
          <Text type="secondary">共 {settlements.length} 条结算记录</Text>
        </div>
        <Button type="primary" onClick={() => setOpen(true)}>生成结算草稿</Button>
      </div>
      <Card>
        <Table rowKey="id" columns={columns} dataSource={settlements} pagination={false} size="small" scroll={{ x: 760 }} />
      </Card>
      <Modal title="生成结算草稿" open={open} onCancel={() => { setOpen(false); form.resetFields(); }} onOk={create} destroyOnClose>
        <Form form={form} layout="vertical">
          <Form.Item name="channelId" label="渠道" rules={[{ required: true, message: '请选择渠道' }]}>
            <Select options={channels.map((c) => ({ value: c.id, label: c.name }))} />
          </Form.Item>
          <Form.Item name="period" label="结算区间" rules={[{ required: true, message: '请选择结算区间' }]}>
            <DatePicker.RangePicker
              allowEmpty={[false, false]}
              showTime={{ format: 'HH:mm' }}
              format="YYYY-MM-DD HH:mm"
              style={{ width: '100%' }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
