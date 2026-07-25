import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { ConfigProvider, Layout, Menu, Avatar, Dropdown, App as AntApp } from 'antd';
import {
  MobileOutlined, AppstoreOutlined,
  SafetyOutlined, LogoutOutlined, DownOutlined, UnorderedListOutlined,
  SettingOutlined, SoundOutlined, ShoppingOutlined, ShopOutlined
} from '@ant-design/icons';
import './index.css';
import zhCN from 'antd/locale/zh_CN';
import LoginPage from './pages/LoginPage';
import DeviceList from './pages/DeviceList';
import DeviceDetail from './pages/DeviceDetail';
import TopicsListPage from './pages/TopicsListPage';
import TopicCategoriesPage from './pages/TopicCategoriesPage';
import VersionsPage from './pages/VersionsPage';
import ConfigPage from './pages/ConfigPage';
import VoicesPage from './pages/VoicesPage';
import PlansPage from './pages/PlansPage';
import PromptStylesPage from './pages/PromptStylesPage';
import PromptStyleEditPage from './pages/PromptStyleEditPage';
import DashboardPage from './pages/DashboardPage';
import ChannelsPage from './pages/ChannelsPage';
import ChannelDetailPage from './pages/ChannelDetailPage';
import TicketsPage from './pages/TicketsPage';
import OrdersPage from './pages/OrdersPage';
import AgreementsPage from './pages/AgreementsPage';
import SettlementsPage from './pages/SettlementsPage';

const { Sider, Content } = Layout;

/** 路由守卫 */
function RequireAuth({ children }) {
  const token = localStorage.getItem('admin_token');
  if (!token) return <Navigate to="/admin/login" replace />;
  return children;
}

/** 主布局 */
function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = (() => {
    try { return JSON.parse(localStorage.getItem('admin_user') || 'null'); } catch { return null; }
  })();

  const logout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    navigate('/admin/login');
  };

  // 高亮当前菜单
  const selectedKey = (() => {
    const p = location.pathname;
    if (p.startsWith('/admin/devices')) return 'devices';
    if (p.startsWith('/admin/topics-list')) return 'topics-list';
    if (p.startsWith('/admin/cache')) return 'cache';
    if (p.startsWith('/admin/versions')) return 'versions';
    if (p.startsWith('/admin/voices')) return 'voices';
    if (p.startsWith('/admin/prompt-styles')) return 'prompt-styles';
    if (p.startsWith('/admin/channels')) return 'channels';
    if (p.startsWith('/admin/tickets')) return 'tickets';
    if (p.startsWith('/admin/settlements')) return 'settlements';
    if (p.startsWith('/admin/dashboard')) return 'dashboard';
    if (p.startsWith('/admin/plans')) return 'plans';
    if (p.startsWith('/admin/agreements')) return 'agreements';
    if (p.startsWith('/admin/config')) return 'config';
    if (p.startsWith('/admin/orders')) return 'orders';
    return 'dashboard';
  })();

  const menuItems = [
    { key: 'devices', icon: <MobileOutlined />, label: '设备管理' },
    {
      key: 'operation',
      icon: <ShopOutlined />,
      label: '运营管理',
      children: [
        { key: 'dashboard', label: '经营看板' },
        { key: 'channels', label: '渠道管理' },
        { key: 'orders', label: '订单管理' },
        { key: 'tickets', label: '客服工单' },
        { key: 'settlements', label: '结算报表' },
      ],
    },
    {
      key: 'system',
      icon: <SettingOutlined />,
      label: '系统管理',
      children: [
        { key: 'topics-list', label: '话题列表' },
        { key: 'versions', label: '版本管理' },
        { key: 'voices', label: '音色管理' },
        { key: 'prompt-styles', label: '风格管理' },
        { key: 'agreements', label: '内容管理' },
        { key: 'plans', label: '套餐管理' },
        { key: 'config', label: '全局配置' },
      ],
    },
  ];

  const userMenuItems = [
    { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', danger: true },
  ];

  return (
    <Layout className="admin-layout">
      <Sider width={220} className="admin-sider" theme="light">
        <div className="admin-logo">
          <SafetyOutlined style={{ fontSize: 18 }} />
          无限之书
        </div>
        <Menu
          mode="inline"
          defaultOpenKeys={['operation', 'system']}
          selectedKeys={[selectedKey]}
          style={{ border: 'none', marginTop: 4 }}
          items={menuItems}
          onClick={({ key }) => navigate(`/admin/${key}`)}
        />
      </Sider>
      <Layout>
        <div className="admin-header">
          <span style={{ flex: 1, fontSize: 14, color: '#8c8c8c' }}>
            {menuItems.flatMap(m => m.children || [m]).find(m => m.key === selectedKey)?.label}
          </span>
          <Dropdown
            menu={{ items: userMenuItems, onClick: ({ key }) => key === 'logout' && logout() }}
            placement="bottomRight"
          >
            <span style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, color: '#262626', fontSize: 14 }}>
              <Avatar size={28} style={{ background: '#4f46e5', fontSize: 12 }}>
                {user?.username?.[0]?.toUpperCase() || 'A'}
              </Avatar>
              {user?.username || '管理员'}
              <DownOutlined style={{ fontSize: 10, color: '#8c8c8c' }} />
            </span>
          </Dropdown>
        </div>
        <Content className="admin-content">
          <Routes>
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="devices" element={<DeviceList />} />
            <Route path="devices/:id" element={<DeviceDetail />} />
            <Route path="topics-list" element={<TopicsListPage />} />
            <Route path="topic-categories" element={<TopicCategoriesPage />} />
            <Route path="versions" element={<VersionsPage />} />
            <Route path="voices" element={<VoicesPage />} />
            <Route path="prompt-styles" element={<PromptStylesPage />} />
            <Route path="prompt-styles/:id" element={<PromptStyleEditPage />} />
            <Route path="channels" element={<ChannelsPage />} />
            <Route path="channels/:id" element={<ChannelDetailPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="tickets" element={<TicketsPage />} />
            <Route path="settlements" element={<SettlementsPage />} />
            <Route path="plans" element={<PlansPage />} />
            <Route path="agreements" element={<AgreementsPage />} />
            <Route path="config" element={<ConfigPage />} />
            <Route index element={<Navigate to="dashboard" replace />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}

export default function App() {
  return (
    <ConfigProvider locale={zhCN} theme={{ token: { colorPrimary: '#4f46e5', borderRadius: 8 } }}>
      <AntApp>
        <BrowserRouter>
          <Routes>
            <Route path="/admin/login" element={<LoginPage />} />
            <Route path="/admin/*" element={<RequireAuth><AdminLayout /></RequireAuth>} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  );
}
