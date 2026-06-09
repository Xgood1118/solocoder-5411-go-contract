import React, { useState, useEffect } from 'react'
import { Modal, Radio, Input, Space, Typography, message } from 'antd'
import { ANNOTATION_CATEGORIES } from '../utils/cornerstone'

const { TextArea } = Input
const { Text } = Typography

const ANNOTATION_TYPE_LABELS = {
  rectangle: '矩形',
  ellipse: '椭圆',
  arrow: '箭头',
  freehand: '自由曲线',
}

const AnnotationLabelPopup = ({
  visible,
  annotationType,
  defaultCategory = '',
  defaultLabel = '',
  onConfirm,
  onCancel,
}) => {
  const [category, setCategory] = useState(defaultCategory)
  const [label, setLabel] = useState(defaultLabel)

  useEffect(() => {
    if (visible) {
      setCategory(defaultCategory)
      setLabel(defaultLabel)
    }
  }, [visible, defaultCategory, defaultLabel])

  const handleConfirm = () => {
    if (!category) {
      message.warning('请选择标注分类')
      return
    }
    onConfirm && onConfirm({ category, label })
    setCategory('')
    setLabel('')
  }

  const handleCancel = () => {
    setCategory('')
    setLabel('')
    onCancel && onCancel()
  }

  const typeLabel = ANNOTATION_TYPE_LABELS[annotationType] || annotationType

  return (
    <Modal
      title="标注分类确认"
      open={visible}
      onOk={handleConfirm}
      onCancel={handleCancel}
      okText="确认"
      cancelText="取消"
      okButtonProps={{ type: 'primary' }}
      width={420}
      destroyOnClose
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <div>
          <Text strong>标注类型：</Text>
          <Text>{typeLabel}</Text>
        </div>

        <div>
          <Text strong style={{ marginBottom: 12, display: 'inline-block' }}>
            选择分类：
          </Text>
          <Radio.Group
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{ width: '100%' }}
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              {ANNOTATION_CATEGORIES.map((cat) => (
                <Radio key={cat.value} value={cat.value}>
                  <span
                    style={{
                      display: 'inline-block',
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      backgroundColor: cat.color,
                      marginRight: 8,
                      verticalAlign: 'middle',
                    }}
                  />
                  {cat.label}
                </Radio>
              ))}
            </Space>
          </Radio.Group>
        </div>

        <div>
          <Text strong style={{ marginBottom: 8, display: 'inline-block' }}>
            文字标签：
          </Text>
          <TextArea
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="输入标注备注说明（可选）"
            rows={3}
            maxLength={200}
            showCount
          />
        </div>
      </Space>
    </Modal>
  )
}

export default AnnotationLabelPopup
