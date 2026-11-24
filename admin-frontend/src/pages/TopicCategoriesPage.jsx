import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert, Table, Input, Button, Space, Typography,
  App, Form, Switch, Popconfirm, InputNumber, Modal, Tooltip
} from 'antd';
import { adminApi } from '../api';
import { DeleteOutlined, EditOutlined, CheckCircleFilled, MinusCircleOutlined, PlusOutlined, ArrowLeftOutlined } from '@ant-design/icons';

const { Text } = Typography;

/**
 * 分类下话题列表的弹窗
 */
function CategoryTopicsModal({ categoryId, categoryName, open, onClose, onRefreshCount }) {
  const { modal, message } = App.useApp();
  const [data, setData] = useState({ total: 0, topics: [] });
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [dataCategoryId, setDataCategoryId] = useState(null);
  const [settledCategoryId, setSettledCategoryId] = useState(null);

  const load = useCallback(async () => {
    if (!categoryId) return;
    setLoading(true);
    try {
      // 获取全部分页1，limit大一点展示，或者正常分页
      const res = await adminApi.topics.all({ category: categoryId, page: 1, limit: 1000 });
      setData(res);
      setDataCategoryId(categoryId);
      setLoadError(null);
    } catch (err) {
      setLoadError(err.message || '获取分类话题失败');
    } finally {
      setLoading(false);
      setSettledCategoryId(categoryId);
    }
  }, [categoryId]);

  useEffect(() => {
    if (!open || !categoryId) return undefined;
    let active = true;
    adminApi.topics.all({ category: categoryId, page: 1, limit: 1000 })
      .then(res => {
        if (!active) return;
        setData(res);
        setDataCategoryId(categoryId);
        setLoadError(null);
      })
      .catch(err => { if (active) setLoadError(err.message || '获取分类话题失败'); })
      .finally(() => {
        if (!active) return;
        setLoading(false);
        setSettledCategoryId(categoryId);
      });
    return () => { active = false; };
  }, [open, categoryId]);

  const handleDelete = (record) => {
    modal.confirm({
      title: '删除话题',
      content: <span>确认删除话题「<b>{record.name}</b>」？</span>,
      okText: '确认删除', cancelText: '取消', okType: 'danger',
      onOk: async () => {
        try {
          await adminApi.topics.deleteTopic(record.id);
          message.success('话题已删除');
          load();
          onRefreshCount();
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
      title: '话题名', dataIndex: 'name', key: 'name', ellipsis: true, width: 200,
    },
    {
      title: '缓存', key: 'cached', width: 90,
      render: (_, r) => r.cached
        ? <Space size={4}><CheckCircleFilled style={{ color: '#52c41a' }} /><Text style={{ color: '#52c41a', fontSize: 12 }}>已缓存</Text></Space>
        : <Space size={4}><MinusCircleOutlined style={{ color: '#bfbfbf' }} /><Text type="secondary" style={{ fontSize: 12 }}>未缓存</Text></Space>,
    },
    {
      title: '操作', key: 'action', width: 80,
      render: (_, r) => (
        <Tooltip title="删除话题">
          <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => handleDelete(r)} />
        </Tooltip>
      ),
    },
  ];

  return (
    <Modal
      title={`「${categoryName}」下的话题`}
      open={open}
      onCancel={onClose}
      footer={null}
      width={800}
      destroyOnHidden
    >
      <div style={{ marginBottom: 12 }}>共 {dataCategoryId === categoryId ? data.total : 0} 个话题</div>
      {loadError && (
        <Alert
          type="error"
          showIcon
          title="分类话题加载失败"
          description={loadError}
          action={<Button size="small" onClick={load}>重试</Button>}
          style={{ marginBottom: 12 }}
        />
      )}
      <Table
        columns={columns}
        dataSource={dataCategoryId === categoryId ? data.topics : []}
        rowKey="id"
        size="small"
        pagination={{ pageSize: 10 }}
        loading={loading || (open && settledCategoryId !== categoryId)}
        scroll={{ x: 460 }}
      />
    </Modal>
  );
}

export default function TopicCategoriesPage() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [form] = Form.useForm();
  const [modalOpen, setModalOpen] = useState(false);

  const [topicsModal, setTopicsModal] = useState({ open: false, categoryId: null, categoryName: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await adminApi.topicCategories.list();
      setCategories(res.categories || []);
    } catch (err) {
      setLoadError(err.message || '获取分类失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    adminApi.topicCategories.list()
      .then(res => {
        if (!active) return;
        setCategories(res.categories || []);
        setLoadError(null);
      })
      .catch(err => { if (active) setLoadError(err.message || '获取分类失败'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const handleSave = async (values) => {
    try {
      if (editingId) {
        await adminApi.topicCategories.update(editingId, values);
        message.success('更新成功');
      } else {
        await adminApi.topicCategories.create(values);
        message.success('创建成功');
      }
      setEditingId(null);
      form.resetFields();
      setModalOpen(false);
      load();
    } catch (err) {
      message.error(err.message);
    }
  };

  const handleEdit = (record) => {
    setEditingId(record.id);
    form.setFieldsValue(record);
    setModalOpen(true);
  };

  const handleDelete = async (id) => {
    try {
      await adminApi.topicCategories.remove(id);
      message.success('删除成功');
      load();
    } catch (err) {
      message.error(err.message);
    }
  };

  const handleToggleActive = async (id, isActive) => {
    try {
      await adminApi.topicCategories.update(id, { isActive });
      message.success(isActive ? '已启用' : '已停用');
      load();
    } catch (err) {
      message.error(err.message);
    }
  };

  const columns = [
    { title: '分类名称', dataIndex: 'name', key: 'name' },
    {
      title: '是否启用',
      key: 'isActive',
      render: (_, r) => (
        <Switch
          checked={r.isActive}
          size="small"
          onChange={(v) => handleToggleActive(r.id, v)}
        />
      )
    },
    { title: '排序', dataIndex: 'sortOrder', key: 'sortOrder' },
    {
      title: '话题数量',
      key: 'count',
      render: (_, r) => (
        <Button
          type="link"
          style={{ padding: 0 }}
          onClick={() => setTopicsModal({ open: true, categoryId: r.id, categoryName: r.name })}
        >
          {r._count?.topics ?? 0} 个话题
        </Button>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 104,
      fixed: 'right',
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="编辑">
            <Button
              type="text" size="small" icon={<EditOutlined />}
              aria-label={`编辑${r.name}`}
              onClick={() => handleEdit(r)}
            />
          </Tooltip>
          <Popconfirm title="确定删除此分类？关联的话题将失去分类" onConfirm={() => handleDelete(r.id)}>
            <Tooltip title="删除">
              <Button type="text" danger size="small" icon={<DeleteOutlined />} aria-label={`删除${r.name}`} />
            </Tooltip>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div style={{ background: '#fff', padding: 24, borderRadius: 8 }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Button 
          icon={<ArrowLeftOutlined />} 
          onClick={() => navigate('/admin/topics-list')}
        >
          返回话题列表
        </Button>
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          onClick={() => { setEditingId(null); form.resetFields(); setModalOpen(true); }}
        >
          新增分类
        </Button>
      </div>

      {loadError && (
        <Alert
          type="error"
          showIcon
          title="分类列表加载失败"
          description={loadError}
          action={<Button size="small" onClick={load}>重试</Button>}
          style={{ marginBottom: 12 }}
        />
      )}
      <Table
        columns={columns}
        dataSource={categories}
        rowKey="id"
        size="middle"
        pagination={false}
        loading={loading}
        scroll={{ x: 720 }}
      />

      <CategoryTopicsModal
        open={topicsModal.open}
        categoryId={topicsModal.categoryId}
        categoryName={topicsModal.categoryName}
        onClose={() => setTopicsModal({ open: false, categoryId: null, categoryName: '' })}
        onRefreshCount={load}
      />

      <Modal
        title={editingId ? '编辑分类' : '新增分类'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields(); setEditingId(null); }}
        onOk={() => form.submit()}
        okText="保存"
        cancelText="取消"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={handleSave} style={{ marginTop: 16 }}>
          <Form.Item name="name" label="分类名称" rules={[{ required: true, message: '输入名称' }]}>
            <Input placeholder="分类名称" />
          </Form.Item>
          <Form.Item name="sortOrder" label="排序" initialValue={0}>
            <InputNumber placeholder="排序（越小越靠前）" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="isActive" label="是否启用" valuePropName="checked" initialValue={true}>
            <Switch checkedChildren="启用" unCheckedChildren="停用" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
