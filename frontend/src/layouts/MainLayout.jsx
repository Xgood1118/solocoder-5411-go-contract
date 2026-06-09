import React from 'react'
import { Layout, Menu, Avatar, Dropdown, Space } from 'antd'
import {
  FileTextOutlined,
  BarChartOutlined,
  UserOutlined,
  LogoutOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/auth'

const { Header, Sider, Content } = Layout

const MainLayout = () => {
  const { user, logout, isAdmin, isReviewer } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const menuItems = [
    {
      key: '/studies',
      icon: <FileTextOutlined />,
      label: '检查列表',
      onClick: () => navigate('/studies'),
    },
  ]

  if (isAdmin() || isReviewer()) {
    menuItems.push({
      key: '/admin/stats',
      icon: <BarChartOutlined />,
      label: '统计管理',
      onClick: () => navigate('/admin/stats'),
    })
  }

  const userMenu = {
    items: [
      {
        key: 'profile',
        icon: <UserOutlined />,
        label: user?.full_name || '用户',
        disabled: true,
      },
      { type: 'divider' },
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: '退出登录',
        onClick: handleLogout,
      },
    ],
  }

  const getSelectedKeys = () => {
    const path = location.pathname
    if (path.startsWith('/viewer')) return ['/studies']
    if (path.startsWith('/admin')) return ['/admin/stats']
    return [path]
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={220} theme="dark">
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: 16,
          fontWeight: 'bold',
          borderBottom: '1px solid #1f1f1f',
        }}>
          🏥 放射科标注
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={getSelectedKeys()}
          items={menuItems}
          style={{ borderRight: 0 }}
        />
      </Sider>
      <Layout>
        <Header style={{
          background: '#fff',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        }}>
          <div style={{ fontSize: 16, fontWeight: 500 }}>
            在线影像标注与教学系统
          </div>
          <Dropdown menu={userMenu} placement="bottomRight">
            <Space style={{ cursor: 'pointer' }}>
              <Avatar icon={<UserOutlined />} />
              <span>
                {user?.full_name}
                <span style={{ color: '#999', fontSize: 12, marginLeft: 8 }}>
                  ({user?.role === 'admin' ? '管理员' : user?.role === 'reviewer' ? '审核员' : '医生'})
                </span>
              </span>
            </Space>
          </Dropdown>
        </Header>
        <Content style={{ margin: 0, padding: 0, background: '#f0f2f5' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}

export default MainLayout
