import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Form, Input, Button, Alert } from 'antd';
import { SafetyOutlined, UserOutlined, LockOutlined } from '@ant-design/icons';
import { adminApi } from '../api';
import styles from './LoginPage.module.css';

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
    <main className={styles.page}>
      <Card className={styles.card} styles={{ body: { padding: '32px 28px' } }}>
        <div className={styles.brand}>
          <SafetyOutlined className={styles.logo} />
          <div className={styles.brandName}>无限之书</div>
          <div className={styles.brandSubtitle}>后台管理系统</div>
        </div>

        {error && <Alert className={styles.error} message={error} type="error" showIcon />}

        <Form form={form} onFinish={onFinish} layout="vertical" size="large">
          <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input prefix={<UserOutlined />} placeholder="admin" autoComplete="username" autoFocus />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="••••••" autoComplete="current-password" />
          </Form.Item>
          <Button className={styles.submit} type="primary" htmlType="submit" loading={loading} block>
            登 录
          </Button>
        </Form>
      </Card>
    </main>
  );
}
