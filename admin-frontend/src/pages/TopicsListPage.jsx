import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert, Table, Input, Select, Button, Tag, Space, Typography,
  Tooltip, Card, App, Modal, Image, Form
} from 'antd';
import {
  SearchOutlined, ReloadOutlined, DeleteOutlined,
  PlusOutlined, CheckCircleFilled, MinusCircleOutlined, EyeOutlined, AppstoreOutlined
} from '@ant-design/icons';
import { adminApi } from '../api';
import styles from './TopicsListPage.module.css';

const { Text } = Typography;
const { Option } = Select;

/**
 * 话题列表页 — 展示全量话题，支持手动新增/删除话题
 * 注：TopicCache 缓存永久保留，无需管理
 */
export default function TopicsListPage() {
  const navigate = useNavigate();
  const { modal, message } = App.useApp();
  const [data, setData]   = useState({ total: 0, cachedTotal: 0, topics: [], categories: [] });
  const [loading, setLoading]   = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [page, setPage]         = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [search, setSearch]     = useState('');
  const [category, setCategory] = useState('');
  const [cached, setCached]     = useState('');
  const [preview, setPreview]   = useState(null);   // 预览缓存图片
  const [addOpen, setAddOpen]   = useState(false);  // 新增话题弹窗
  const [addLoading, setAddLoading] = useState(false);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await adminApi.topics.all({ page, limit: pageSize, search, category, cached });
      setData(res);
    } catch (err) {
      setLoadError(err.message || '获取话题列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, category, cached]);

  useEffect(() => {
    let active = true;
    adminApi.topics.all({ page, limit: pageSize, search, category, cached })
      .then(res => {
        if (!active) return;
        setData(res);
        setLoadError(null);
      })
      .catch(err => { if (active) setLoadError(err.message || '获取话题列表失败'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, pageSize, search, category, cached]);

  // ── 新增话题 ──────────────────────────────────────────────
  const handleAdd = async (values) => {
    setAddLoading(true);
    try {
      await adminApi.topics.create({ 
        name: values.name.trim(), 
        categoryId: values.categoryId 
      });
      message.success(`话题「${values.name.trim()}」已添加`);
      setAddOpen(false);
      form.resetFields();
      load();
    } catch (err) {
      message.error(err.message);
    } finally {
      setAddLoading(false);
    }
  };

  // ── 删除话题 ──────────────────────────────────────────────
  const handleDelete = (record) => {
    modal.confirm({
      title: '删除话题',
      content: (
        <span>
          确认删除话题「<b>{record.name}</b>」？
          <br />
          <span style={{ color: '#8c8c8c', fontSize: 12 }}>
            缓存图片将永久保留，仅从话题列表中移除。
          </span>
        </span>
      ),
      okText: '确认删除', cancelText: '取消', okType: 'danger',
      onOk: async () => {
        try {
          await adminApi.topics.deleteTopic(record.id);
          message.success('话题已删除');
          load();
        } catch (err) {
          message.error(err.message);
        }
      },
    });
  };

  const columns = [
    {
      title: '#', dataIndex: 'index', key: 'index', width: 60,
      render: v => <Text type="secondary" style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title: '话题名', dataIndex: 'name', key: 'name', ellipsis: true, width: 320,
      render: (v, r) => (
        <Tooltip title={v} placement="topLeft">
          <span style={{ fontSize: 13, color: r.cached ? '#262626' : '#8c8c8c' }}>{v}</span>
        </Tooltip>
      ),
    },
    {
      title: '分类', dataIndex: 'category', key: 'category', width: 120,
      render: v => v ? <Tag color="blue" style={{ fontSize: 11 }}>{v}</Tag> : <Text type="secondary">未分类</Text>,
    },
    {
      title: '缓存', key: 'cached', width: 90,
      render: (_, r) => r.cached
        ? <Space size={4}><CheckCircleFilled style={{ color: '#52c41a' }} /><Text style={{ color: '#52c41a', fontSize: 12 }}>已缓存</Text></Space>
        : <Space size={4}><MinusCircleOutlined style={{ color: '#bfbfbf' }} /><Text type="secondary" style={{ fontSize: 12 }}>未缓存</Text></Space>,
    },
    {
      title: '命中', dataIndex: 'hitCount', key: 'hitCount', width: 80,
      sorter: (a, b) => a.hitCount - b.hitCount,
      render: v => v > 0
        ? <Tag color={v > 10 ? 'green' : 'geekblue'}>{v}</Tag>
        : <Text type="secondary" style={{ fontSize: 12 }}>—</Text>,
    },
    {
      title: '操作', key: 'action', width: 90, fixed: 'right',
      render: (_, r) => (
        <Space size={4}>
          {r.cached && (
            <Tooltip title="查看缓存图片">
              <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => setPreview(r)} />
            </Tooltip>
          )}
          <Tooltip title="删除话题">
            <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => handleDelete(r)} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, color: '#595959', fontSize: 13 }}>
        话题总数 <strong>{data.total}</strong> 条 &nbsp;·&nbsp;
        已缓存 <strong style={{ color: '#52c41a' }}>{data.cachedTotal}</strong> 条 &nbsp;·&nbsp;
        未缓存 <strong style={{ color: '#8c8c8c' }}>{data.total - data.cachedTotal}</strong> 条
      </div>

      {/* 缓存图片预览 Modal */}
      <Modal
        open={!!preview}
        onCancel={() => setPreview(null)}
        footer={null}
        title={preview?.name}
        width={520}
        centered
      >
        {preview?.imageUrl
          ? <Image src={preview.imageUrl} style={{ width: '100%', borderRadius: 8 }} preview={false} />
          : <div style={{ textAlign: 'center', color: '#8c8c8c', padding: 40 }}>暂无缓存图片</div>
        }
        <div style={{ marginTop: 12, fontSize: 12, color: '#8c8c8c' }}>
          分类：{preview?.category} &nbsp;·&nbsp; 命中次数：{preview?.hitCount} 次
        </div>
      </Modal>

      {/* 新增话题 Modal */}
      <Modal
        open={addOpen}
        onCancel={() => { setAddOpen(false); form.resetFields(); }}
        title="新增话题"
        onOk={() => form.submit()}
        okText="添加"
        cancelText="取消"
        confirmLoading={addLoading}
        centered
      >
        <Form form={form} onFinish={handleAdd} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label="话题名称"
            rules={[{ required: true, message: '请输入话题名称' }]}
          >
            <Input placeholder="例：血液循环" maxLength={60} showCount />
          </Form.Item>
          <Form.Item name="categoryId" label="分类">
            <Select placeholder="选择分类" allowClear>
              {data.categories.map(c => <Option key={c.id} value={c.id}>{c.name}</Option>)}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      <Card>
        <div className={styles.toolbar}>
          <Input.Search
            className={styles.search}
            placeholder="搜索话题名称…"
            allowClear
            enterButton={<SearchOutlined />}
            onSearch={v => { setLoading(true); setSearch(v); setPage(1); }}
          />
          <Select
            className={styles.category}
            placeholder="全部分类" allowClear
            onChange={v => { setLoading(true); setCategory(v || ''); setPage(1); }}
          >
            {data.categories.map(c => <Option key={c.id} value={c.id}>{c.name}</Option>)}
          </Select>
          <Select
            className={styles.cached}
            placeholder="缓存状态" allowClear
            onChange={v => { setLoading(true); setCached(v || ''); setPage(1); }}
          >
            <Option value="true">已缓存</Option>
            <Option value="false">未缓存</Option>
          </Select>
          <Button className={styles.refresh} icon={<ReloadOutlined />} onClick={load}>刷新</Button>
          <Button
            className={styles.add}
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setAddOpen(true)}
          >
            新增话题
          </Button>
          <Button
            className={styles.categoryManagement}
            icon={<AppstoreOutlined />}
            onClick={() => navigate('/admin/topic-categories')}
          >
            分类管理
          </Button>
        </div>

        {loadError && (
          <Alert
            type="error"
            showIcon
            title="话题列表加载失败"
            description={loadError}
            action={<Button size="small" icon={<ReloadOutlined />} onClick={load}>重试</Button>}
            style={{ marginBottom: 12 }}
          />
        )}

        <Table
          rowKey="id"
          columns={columns}
          dataSource={data.topics}
          loading={loading}
          size="small"
          scroll={{ x: 800 }}
          rowClassName={r => r.cached ? '' : 'ant-table-row-dimmed'}
          pagination={{
            current: page, pageSize, total: data.total,
            showSizeChanger: true, pageSizeOptions: ['20', '50', '100'],
            showTotal: t => `共 ${t} 条`,
            onChange: (p, ps) => { setLoading(true); setPage(p); setPageSize(ps); },
          }}
        />
      </Card>
    </div>
  );
}
