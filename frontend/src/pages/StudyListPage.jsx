import React, { useState, useEffect } from 'react'
import { Table, Card, Space, Tag, Input, Select, Button, message } from 'antd'
import { SearchOutlined, EyeOutlined, ReloadOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import api from '../services/api'

const { Search } = Input
const { Option } = Select

const StudyListPage = () => {
  const [loading, setLoading] = useState(false)
  const [studies, setStudies] = useState([])
  const [patientId, setPatientId] = useState('')
  const [modality, setModality] = useState('')
  const navigate = useNavigate()

  const fetchStudies = async () => {
    setLoading(true)
    try {
      const params = {}
      if (patientId) params.patient_id = patientId
      if (modality) params.modality = modality

      const res = await api.get('/studies', { params })
      setStudies(res.data)
    } catch (e) {
      message.error('获取检查列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStudies()
  }, [])

  const handleSearch = () => {
    fetchStudies()
  }

  const handleViewStudy = (studyUid) => {
    navigate(`/viewer/${studyUid}`)
  }

  const columns = [
    {
      title: '患者姓名',
      dataIndex: 'patient_name',
      key: 'patient_name',
      width: 120,
    },
    {
      title: '患者ID',
      dataIndex: 'patient_id',
      key: 'patient_id',
      width: 120,
    },
    {
      title: '检查日期',
      dataIndex: 'study_date',
      key: 'study_date',
      width: 140,
      render: (date, record) => {
        const datetime = `${date} ${record.study_time || ''}`.trim()
        return dayjs(datetime, 'YYYYMMDD HHmmss').format('YYYY-MM-DD HH:mm')
      },
      sorter: (a, b) => {
        const aTime = `${a.study_date}${a.study_time || ''}`
        const bTime = `${b.study_date}${b.study_time || ''}`
        return aTime.localeCompare(bTime)
      },
      defaultSortOrder: 'descend',
    },
    {
      title: '检查描述',
      dataIndex: 'study_description',
      key: 'study_description',
      ellipsis: true,
    },
    {
      title: '模态',
      dataIndex: 'modalities_in_study',
      key: 'modalities',
      width: 120,
      render: (modalities) => (
        <Space wrap>
          {modalities?.map((m) => (
            <Tag key={m} color="blue">{m}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '序列数',
      dataIndex: 'series_uids',
      key: 'series_count',
      width: 80,
      render: (uids) => uids?.length || 0,
    },
    {
      title: '同步状态',
      dataIndex: 'sync_status',
      key: 'sync_status',
      width: 100,
      render: (status) => {
        const colorMap = {
          completed: 'green',
          partial: 'orange',
          failed: 'red',
        }
        const textMap = {
          completed: '完成',
          partial: '部分',
          failed: '失败',
        }
        return <Tag color={colorMap[status]}>{textMap[status]}</Tag>
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => handleViewStudy(record.study_uid)}
        >
          查看
        </Button>
      ),
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Card
        style={{ marginBottom: 16 }}
        bodyStyle={{ padding: 16 }}
      >
        <Space size="middle" wrap>
          <Search
            placeholder="患者ID"
            allowClear
            style={{ width: 200 }}
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            onSearch={handleSearch}
            prefix={<SearchOutlined />}
          />
          <Select
            placeholder="选择模态"
            allowClear
            style={{ width: 150 }}
            value={modality || undefined}
            onChange={(v) => setModality(v)}
          >
            <Option value="CT">CT</Option>
            <Option value="MRI">MRI</Option>
            <Option value="CR">CR</Option>
            <Option value="DX">DX</Option>
            <Option value="US">US</Option>
          </Select>
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            onClick={handleSearch}
          >
            查询
          </Button>
        </Space>
      </Card>

      <Card bodyStyle={{ padding: 0 }}>
        <Table
          rowKey="study_uid"
          columns={columns}
          dataSource={studies}
          loading={loading}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条记录`,
          }}
          scroll={{ x: 900 }}
        />
      </Card>
    </div>
  )
}

export default StudyListPage
