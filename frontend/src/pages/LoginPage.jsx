import React, { useState } from 'react'
import { Form, Input, Button, Card, message } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'

const LoginPage = () => {
  const [loading, setLoading] = useState(false)
  const { login } = useAuthStore()
  const navigate = useNavigate()

  const onFinish = async (values) => {
    setLoading(true)
    const result = await login(values.username, values.password)
    setLoading(false)

    if (result.success) {
      message.success('登录成功')
      navigate('/studies')
    } else {
      message.error(result.message || '登录失败')
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    }}>
      <Card
        style={{ width: 400, boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}
        title={
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ margin: 0 }}>🏥 放射科影像标注系统</h2>
            <p style={{ fontSize: 12, color: '#999', marginTop: 8 }}>
              Radiology Annotation System
            </p>
          </div>
        }
      >
        <Form
          name="login"
          onFinish={onFinish}
          initialValues={{ username: 'zhang', password: 'secret123' }}
          size="large"
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="用户名" />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
            >
              登录
            </Button>
          </Form.Item>
        </Form>

        <div style={{ fontSize: 12, color: '#999', textAlign: 'center' }}>
          <p style={{ marginBottom: 4 }}>测试账号：</p>
          <p>医生: zhang / secret123</p>
          <p>主任: wang / secret123</p>
          <p>管理员: admin / secret123</p>
        </div>
      </Card>
    </div>
  )
}

export default LoginPage
