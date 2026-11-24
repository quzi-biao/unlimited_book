import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Form, Input, Button, Alert } from 'antd';
import { SafetyOutlined, UserOutlined, LockOutlined } from '@ant-design/icons';
import { adminApi } from '../api';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const onFinish = async ({ username, password }) => {
    setError('');
    setLoading(true);
    try {
      const { token, user } = await adminApi.login({ username, password });
      localStorage.setItem('admin_token', token);
      localStorage.setItem('admin_user', JSON.stringify(user));
      navigate('/admin/devices', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#f5f7fa',
    }}>
      <Card style={{ width: 'min(380px, 100%)', boxShadow: '0 8px 28px rgba(15,23,42,0.08)', borderRadius: 8 }} styles={{ body: { padding: '32px 28px' } }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <SafetyOutlined style={{ fontSize: 36, color: '#4f46e5', marginBottom: 10, display: 'block' }} />
          <div style={{ fontSize: 20, fontWeight: 700, color: '#262626' }}>无限之书</div>
          <div style={{ color: '#8c8c8c', fontSize: 13, marginTop: 4 }}>后台管理系统</div>
        </div>

        {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16, borderRadius: 8 }} />}

        <Form form={form} onFinish={onFinish} layout="vertical" size="large">
          <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input prefix={<UserOutlined />} placeholder="admin" autoFocus />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="••••••" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block style={{ marginTop: 8, height: 42 }}>
            登 录
          </Button>
        </Form>
      </Card>
    </div>
  );
}
