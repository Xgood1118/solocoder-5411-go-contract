import React, { useState, useEffect } from 'react'
import { Card, Row, Col, Table, Tag, Button, Space, Statistic, message } from 'antd'
import { FileTextOutlined, PictureOutlined, EditOutlined, ClockCircleOutlined, CloseCircleOutlined, TeamOutlined, ReloadOutlined } from '@ant-design/icons'
import api from '../services/api'
import { useAuthStore } from '../store/auth'
import { useNavigate } from 'react-router-dom'

const roleTextMap = {
  doctor: '医生',
  reviewer: '审核员',
  admin: '管理员',
}

const roleColorMap = {
  doctor: 'blue',
  reviewer: 'purple',
  admin: 'red',
}

const AdminStatsPage = () => {
  const [overviewLoading, setOverviewLoading] = useState(false)
  const [volumeLoading, setVolumeLoading] = useState(false)
  const [overview, setOverview] = useState({
    total_studies: 0,
    total_images: 0,
    total_annotations: 0,
    pending_review: 0,
    rejected: 0,
    total_doctors: 0,
  })
  const [annotationVolume, setAnnotationVolume] = useState([])
  const { user, hasRole } = useAuthStore()
  const navigate = useNavigate()

  const fetchOverview = async () => {
    setOverviewLoading(true)
    try {
      const res = await api.get('/admin/stats/overview')
      setOverview(res.data)
    } catch (e) {
      message.error('获取概览数据失败')
    } finally {
      setOverviewLoading(false)
    }
  }

  const fetchAnnotationVolume = async () => {
    setVolumeLoading(true)
    try {
      const res = await api.get('/admin/stats/annotation-volume')
      setAnnotationVolume(res.data)
    } catch (e) {
      message.error('获取标注量统计失败')
    } finally {
      setVolumeLoading(false)
    }
  }

  const fetchAllData = () => {
    fetchOverview()
    fetchAnnotationVolume()
  }

  useEffect(() => {
    if (!hasRole(['admin', 'reviewer'])) {
      message.error('无权访问该页面')
      navigate('/studies')
      return
    }
    fetchAllData()
  }, [])

  const volumeColumns = [
    {
      title: '排名',
      key: 'rank',
      width: 80,
      render: (_, __, index) => index + 1,
    },
    {
      title: '医生姓名',
      dataIndex: 'name',
      key: 'name',
      width: 120,
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 100,
      render: (role) => (
        <Tag color={roleColorMap[role]}>
          {roleTextMap[role] || role}
        </Tag>
      ),
    },
    {
      title: '标注总量',
      dataIndex: 'total',
      key: 'total',
      width: 100,
      sorter: (a, b) => a.total - b.total,
      defaultSortOrder: 'descend',
    },
    {
      title: '已接受',
      dataIndex: 'accepted',
      key: 'accepted',
      width: 100,
    },
    {
      title: '待审核',
      dataIndex: 'pending',
      key: 'pending',
      width: 100,
    },
    {
      title: '被拒绝',
      dataIndex: 'rejected',
      key: 'rejected',
      width: 100,
    },
    {
      title: '准确率',
      key: 'accuracy',
      width: 100,
      render: (_, record) => {
        if (record.total === 0) return '0.00%'
        const accuracy = (record.accepted / record.total) * 100
        return `${accuracy.toFixed(2)}%`
      },
    },
  ]

  const rejectionRateData = annotationVolume
    .map((item) => ({
      ...item,
      rejection_rate: item.total > 0 ? (item.rejected / item.total) * 100 : 0,
    }))
    .sort((a, b) => b.rejection_rate - a.rejection_rate)

  const rejectionColumns = [
    {
      title: '排名',
      key: 'rank',
      width: 80,
      render: (_, __, index) => index + 1,
    },
    {
      title: '医生姓名',
      dataIndex: 'name',
      key: 'name',
      width: 120,
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 100,
      render: (role) => (
        <Tag color={roleColorMap[role]}>
          {roleTextMap[role] || role}
        </Tag>
      ),
    },
    {
      title: '驳回率',
      key: 'rejection_rate',
      width: 100,
      render: (_, record) => `${record.rejection_rate.toFixed(2)}%`,
      sorter: (a, b) => a.rejection_rate - b.rejection_rate,
      defaultSortOrder: 'descend',
    },
    {
      title: '驳回数量',
      dataIndex: 'rejected',
      key: 'rejected',
      width: 100,
    },
    {
      title: '总标注量',
      dataIndex: 'total',
      key: 'total',
      width: 100,
    },
  ]

  const statCards = [
    {
      title: '总检查数',
      value: overview.total_studies,
      icon: <FileTextOutlined style={{ fontSize: 24, color: '#1890ff' }} />,
      color: '#e6f7ff',
    },
    {
      title: '总影像数',
      value: overview.total_images,
      icon: <PictureOutlined style={{ fontSize: 24, color: '#52c41a' }} />,
      color: '#f6ffed',
    },
    {
      title: '总标注数',
      value: overview.total_annotations,
      icon: <EditOutlined style={{ fontSize: 24, color: '#722ed1' }} />,
      color: '#f9f0ff',
    },
    {
      title: '待审核数',
      value: overview.pending_review,
      icon: <ClockCircleOutlined style={{ fontSize: 24, color: '#faad14' }} />,
      color: '#fffbe6',
    },
    {
      title: '被拒绝数',
      value: overview.rejected,
      icon: <CloseCircleOutlined style={{ fontSize: 24, color: '#ff4d4f' }} />,
      color: '#fff1f0',
    },
    {
      title: '医生数',
      value: overview.total_doctors,
      icon: <TeamOutlined style={{ fontSize: 24, color: '#13c2c2' }} />,
      color: '#e6fffb',
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Card
        style={{ marginBottom: 16 }}
        bodyStyle={{ padding: 16 }}
        title="数据统计"
        extra={
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            onClick={fetchAllData}
            loading={overviewLoading || volumeLoading}
          >
            刷新
          </Button>
        }
      >
        <Row gutter={[16, 16]}>
          {statCards.map((card, index) => (
            <Col span={4} key={index}>
              <Card
                style={{ background: card.color, border: 'none' }}
                bodyStyle={{ padding: 20 }}
              >
                <Space size="middle">
                  {card.icon}
                  <Statistic title={card.title} value={card.value} />
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      <Row gutter={16}>
        <Col span={12}>
          <Card title="标注量排名" bodyStyle={{ padding: 0 }}>
            <Table
              rowKey="id"
              columns={volumeColumns}
              dataSource={annotationVolume}
              loading={volumeLoading}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showTotal: (total) => `共 ${total} 条记录`,
              }}
              scroll={{ x: 700 }}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="驳回率排名" bodyStyle={{ padding: 0 }}>
            <Table
              rowKey="id"
              columns={rejectionColumns}
              dataSource={rejectionRateData}
              loading={volumeLoading}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showTotal: (total) => `共 ${total} 条记录`,
              }}
              scroll={{ x: 600 }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default AdminStatsPage
