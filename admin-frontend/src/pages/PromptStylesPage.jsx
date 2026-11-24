import { useState, useEffect } from 'react';
import { Table, Button, Space, message, Tag, Popconfirm, Tooltip, Typography } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../api';

const { Title } = Typography;

export default function PromptStylesPage() {
  const navigate = useNavigate();
  const [styles, setStyles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    adminApi.promptStyles.list()
      .then(data => { if (active) setStyles(data); })
      .catch(err => { if (active) message.error(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const fetchStyles = async () => {
    setLoading(true);
    try {
      const data = await adminApi.promptStyles.list();
      setStyles(data);
    } catch (err) {
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await adminApi.promptStyles.remove(id);
      message.success('删除成功');
      fetchStyles();
    } catch (err) {
      message.error('删除失败: ' + err.message);
    }
  };

  const columns = [
    { title: '风格名称', dataIndex: 'name', key: 'name' },
    { title: '适用的生图模型', dataIndex: 'imageModel', key: 'imageModel', render: (val) => <Tag color="blue">{val || '未指定'}</Tag> },
    { title: '状态', dataIndex: 'isActive', key: 'isActive', render: (active) => active ? <Tag color="success">启用</Tag> : <Tag color="default">停用</Tag> },
    {
      title: '操作',
      key: 'action',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="编辑">
            <Button
              type="text" size="small" icon={<EditOutlined />}
              aria-label={`编辑${record.name}`}
              onClick={() => navigate(`/admin/prompt-styles/${record.id}`)}
            />
          </Tooltip>
          <Popconfirm
            title="确定要删除此风格吗？如果设备正在使用，将可能引发错误。"
            onConfirm={() => handleDelete(record.id)}
            okText="删除"
            cancelText="取消"
          >
            <Tooltip title="删除">
              <Button type="text" danger size="small" icon={<DeleteOutlined />} aria-label={`删除${record.name}`} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, background: '#fff', borderRadius: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>提示词风格管理</Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate('/admin/prompt-styles/new')}
        >
          添加新风格
        </Button>
      </div>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={styles}
        loading={loading}
        pagination={false}
        scroll={{ x: 720 }}
      />
    </div>
  );
}
