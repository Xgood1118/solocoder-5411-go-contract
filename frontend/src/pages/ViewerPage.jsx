import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Button, Space, List, Tag, message, Tooltip, Radio, Modal } from 'antd'
import { LeftOutlined, DownloadOutlined, VideoCameraOutlined, VideoCameraAddOutlined, CheckOutlined, CloseOutlined, LayoutOutlined, PictureOutlined, HistoryOutlined, WarningOutlined } from '@ant-design/icons'
import { useParams, useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import CornerstoneViewer from '../components/CornerstoneViewer'
import MPRViewer from '../components/MPRViewer'
import AnnotationLabelPopup from '../components/AnnotationLabelPopup'
import { useAuthStore } from '../store/auth'
import { useViewerStore } from '../store/viewer'
import { useAnnotationStore } from '../store/annotation'
import useScreenRecorder from '../hooks/useScreenRecorder'
import { TOOL_LIST, WL_PRESETS, ANNOTATION_CATEGORIES, getCategoryColor, ANNOTATION_TYPE_MAP } from '../utils/cornerstone'
import api from '../services/api'

const ViewerPage = () => {
  const { studyUid } = useParams()
  const navigate = useNavigate()
  const { isReviewer, isDoctor, user } = useAuthStore()

  const {
    studyInfo,
    seriesList,
    currentSeriesUid,
    imageList,
    currentImageIndex,
    currentImageUid,
    currentTool,
    viewMode,
    lockInfo,
    setStudy,
    setSeriesList,
    setCurrentSeries,
    setImageList,
    setCurrentImageIndex,
    setCurrentTool,
    setViewMode,
    setLockInfo,
    fetchLockInfo,
    acquireLock,
    releaseLock,
    getCurrentImageInfo,
    getCurrentSeriesInfo,
  } = useViewerStore()

  const {
    annotations,
    loading: annotationsLoading,
    fetchAnnotations,
    createAnnotation,
    acceptAnnotation,
    rejectAnnotation,
    clearAnnotations,
  } = useAnnotationStore()

  const viewerContainerRef = useRef(null)
  const cornerstoneViewerRef = useRef(null)

  const [labelPopupVisible, setLabelPopupVisible] = useState(false)
  const [pendingAnnotation, setPendingAnnotation] = useState(null)
  const [loadingSeries, setLoadingSeries] = useState(false)
  const [loadingStudy, setLoadingStudy] = useState(false)
  const [loadingImages, setLoadingImages] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  const handleRecordError = useCallback((error) => {
    message.error(`录制失败: ${error.message}`)
  }, [])

  const {
    isRecording,
    isPageHidden,
    startRecording,
    stopRecording,
    recordedBlob,
  } = useScreenRecorder(viewerContainerRef, {
    fps: 30,
    mimeType: 'video/webm;codecs=vp9',
    onError: handleRecordError,
  })

  useEffect(() => {
    if (recordedBlob && isRecording === false) {
      const url = URL.createObjectURL(recordedBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `recording_${dayjs().format('YYYYMMDD_HHmmss')}.webm`
      a.click()
      URL.revokeObjectURL(url)
      message.success('录制已保存')
    }
  }, [recordedBlob, isRecording])

  const fetchStudyInfo = useCallback(async () => {
    if (!studyUid) return
    setLoadingStudy(true)
    try {
      const res = await api.get(`/studies/${studyUid}`)
      setStudy(studyUid, res.data)
    } catch (e) {
      message.error('获取检查信息失败')
    } finally {
      setLoadingStudy(false)
    }
  }, [studyUid, setStudy])

  const fetchSeriesList = useCallback(async () => {
    if (!studyUid) return
    setLoadingSeries(true)
    try {
      const res = await api.get(`/series/study/${studyUid}`)
      const sorted = [...res.data].sort((a, b) => {
        const aNum = a.series_number || 0
        const bNum = b.series_number || 0
        return aNum - bNum
      })
      setSeriesList(sorted)
      if (sorted.length > 0) {
        setCurrentSeries(sorted[0].series_uid)
      }
    } catch (e) {
      message.error('获取序列列表失败')
    } finally {
      setLoadingSeries(false)
    }
  }, [studyUid, setSeriesList, setCurrentSeries])

  const fetchImageList = useCallback(async (sUid) => {
    if (!sUid) return
    setLoadingImages(true)
    try {
      const res = await api.get(`/images/series/${sUid}`)
      const sorted = [...res.data].sort((a, b) => {
        const aNum = a.instance_number || a.slice_number || 0
        const bNum = b.instance_number || b.slice_number || 0
        return aNum - bNum
      })
      setImageList(sorted)
    } catch (e) {
      message.error('获取影像列表失败')
    } finally {
      setLoadingImages(false)
    }
  }, [setImageList])

  const handleImageLoad = useCallback(async (imgUid) => {
    if (!imgUid) return

    clearAnnotations()

    const lockData = await fetchLockInfo(imgUid)
    await fetchAnnotations(imgUid)

    if (isDoctor() && lockData && !lockData.is_me && !lockData.locked_by) {
      const result = await acquireLock(imgUid)
      if (!result.success) {
        message.warning('该影像已被其他用户锁定，当前为只读模式')
      }
    }
  }, [clearAnnotations, fetchLockInfo, fetchAnnotations, acquireLock, isDoctor])

  const handleSeriesChange = useCallback(async (sUid) => {
    if (currentImageUid && lockInfo?.is_me) {
      await releaseLock(currentImageUid)
    }
    clearAnnotations()
    setCurrentSeries(sUid)
    await fetchImageList(sUid)
  }, [currentImageUid, lockInfo, releaseLock, clearAnnotations, setCurrentSeries, fetchImageList])

  const handleImageChange = useCallback(async (index) => {
    if (index < 0 || index >= imageList.length) return

    if (currentImageUid && lockInfo?.is_me) {
      await releaseLock(currentImageUid)
    }

    setCurrentImageIndex(index)
  }, [imageList, currentImageUid, lockInfo, releaseLock, setCurrentImageIndex])

  const handleWheel = useCallback((e) => {
    if (viewMode !== 'single') return
    e.preventDefault()
    if (imageList.length <= 1) return

    const delta = e.deltaY > 0 ? 1 : -1
    const newIndex = currentImageIndex + delta

    if (newIndex >= 0 && newIndex < imageList.length) {
      handleImageChange(newIndex)
    }
  }, [viewMode, imageList, currentImageIndex, handleImageChange])

  const handleAnnotationComplete = useCallback((annotationData) => {
    if (!isDoctor()) return
    if (lockInfo && !lockInfo.is_me) {
      message.warning('影像已被锁定，无法标注')
      return
    }
    setPendingAnnotation(annotationData)
    setLabelPopupVisible(true)
  }, [isDoctor, lockInfo])

  const handleLabelConfirm = async ({ category, label }) => {
    if (!pendingAnnotation || !currentImageUid) return

    const { pixelCoordinates, toolName } = pendingAnnotation

    const result = await createAnnotation(
      currentImageUid,
      toolName,
      pixelCoordinates,
      category,
      label
    )

    if (result.success) {
      message.success('标注创建成功')
    } else {
      message.error(result.message || '创建标注失败')
    }

    setLabelPopupVisible(false)
    setPendingAnnotation(null)
  }

  const handleLabelCancel = () => {
    setLabelPopupVisible(false)
    setPendingAnnotation(null)
    if (cornerstoneViewerRef.current) {
      // 撤销刚画的标注
    }
  }

  const handleAcceptAnnotation = async (annotationId) => {
    const result = await acceptAnnotation(annotationId)
    if (result.success) {
      message.success('标注已接受')
    } else {
      message.error(result.message || '操作失败')
    }
  }

  const handleRejectAnnotation = (annotationId) => {
    Modal.confirm({
      title: '确认拒绝',
      content: '确定要拒绝此标注吗？',
      okText: '确认拒绝',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        const result = await rejectAnnotation(annotationId, '')
        if (result.success) {
          message.success('标注已拒绝')
        } else {
          message.error(result.message || '操作失败')
        }
      },
    })
  }

  const handleExportPNG = () => {
    if (!viewerContainerRef.current) {
      message.error('无法导出')
      return
    }

    try {
      const canvas = viewerContainerRef.current.querySelector('canvas')
      if (canvas) {
        const link = document.createElement('a')
        link.download = `image_${dayjs().format('YYYYMMDD_HHmmss')}.png`
        link.href = canvas.toDataURL('image/png')
        link.click()
        message.success('PNG导出成功')
      } else {
        message.warning('未找到可导出的影像')
      }
    } catch (e) {
      message.error('导出失败')
    }
  }

  const handleRecordToggle = () => {
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }

  const handleBack = useCallback(async () => {
    if (currentImageUid && lockInfo?.is_me) {
      await releaseLock(currentImageUid)
    }
    navigate('/studies')
  }, [currentImageUid, lockInfo, releaseLock, navigate])

  const handleViewModeChange = (e) => {
    setViewMode(e.target.value)
  }

  const applyWLPreset = useCallback((preset) => {
    if (cornerstoneViewerRef.current?.applyWLPreset) {
      cornerstoneViewerRef.current.applyWLPreset(preset)
    }
  }, [])

  useEffect(() => {
    fetchStudyInfo()
    fetchSeriesList()
  }, [fetchStudyInfo, fetchSeriesList])

  useEffect(() => {
    if (currentSeriesUid) {
      fetchImageList(currentSeriesUid)
    }
  }, [currentSeriesUid, fetchImageList])

  useEffect(() => {
    if (currentImageUid && viewMode === 'single') {
      handleImageLoad(currentImageUid)
    }
  }, [currentImageUid, viewMode, handleImageLoad])

  useEffect(() => {
    const container = viewerContainerRef.current
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false })
      return () => {
        container.removeEventListener('wheel', handleWheel)
      }
    }
  }, [handleWheel])

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (currentImageUid && lockInfo?.is_me) {
        releaseLock(currentImageUid)
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [currentImageUid, lockInfo, releaseLock])

  useEffect(() => {
    return () => {
      if (currentImageUid && lockInfo?.is_me) {
        releaseLock(currentImageUid)
      }
    }
  }, [])

  const currentImageInfo = getCurrentImageInfo()
  const currentSeriesInfo = getCurrentSeriesInfo()

  const getToolName = (toolKey) => {
    const tool = TOOL_LIST.find((t) => t.key === toolKey)
    return tool?.name || toolKey
  }

  const getStatusTag = (status) => {
    const statusMap = {
      pending: { color: 'orange', text: '待审核' },
      accepted: { color: 'green', text: '已接受' },
      rejected: { color: 'red', text: '已拒绝' },
    }
    const s = statusMap[status] || statusMap.pending
    return <Tag color={s.color}>{s.text}</Tag>
  }

  const isReadOnly = !isDoctor() || (lockInfo && !lockInfo.is_me)

  const displayAnnotations = useMemo(() => {
    if (showHistory) {
      return annotations
    }
    return annotations.filter((a) => a.status !== 'rejected')
  }, [annotations, showHistory])

  const annotationTypeLabel = pendingAnnotation
    ? TOOL_LIST.find((t) => t.key === pendingAnnotation.toolName)?.name || pendingAnnotation.toolName
    : ''

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
        background: '#f0f2f5',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          background: '#fff',
          borderBottom: '1px solid #e8e8e8',
          height: 56,
        }}
      >
        <Space size={16}>
          <Button
            icon={<LeftOutlined />}
            onClick={handleBack}
          >
            返回
          </Button>
          <div>
            <div style={{ fontWeight: 500, fontSize: 14 }}>
              {loadingStudy ? '加载中...' : (studyInfo?.patient_name || '未知患者')}
            </div>
            <div style={{ fontSize: 12, color: '#666' }}>
              {studyInfo?.study_description || ''}
              {studyInfo?.study_date && (
                <span style={{ marginLeft: 12 }}>
                  {dayjs(studyInfo.study_date + (studyInfo.study_time || ''), 'YYYYMMDD HHmmss').format('YYYY-MM-DD HH:mm')}
                </span>
              )}
            </div>
          </div>
        </Space>

        <Space size={12}>
          <Radio.Group
            value={viewMode}
            onChange={handleViewModeChange}
            optionType="button"
            buttonStyle="solid"
            size="small"
          >
            <Radio.Button value="single">
              <PictureOutlined style={{ marginRight: 4 }} />
              单图模式
            </Radio.Button>
            <Radio.Button value="mpr">
              <LayoutOutlined style={{ marginRight: 4 }} />
              MPR模式
            </Radio.Button>
          </Radio.Group>

          <Tooltip title="导出PNG">
            <Button
              icon={<DownloadOutlined />}
              onClick={handleExportPNG}
            >
              导出PNG
            </Button>
          </Tooltip>

          <Tooltip title={isRecording ? '停止录制' : '录制视频'}>
            <Button
              icon={isRecording ? <VideoCameraAddOutlined /> : <VideoCameraOutlined />}
              onClick={handleRecordToggle}
              type={isRecording ? 'primary' : 'default'}
              danger={isRecording}
            >
              {isRecording ? '停止录制' : '录制'}
            </Button>
          </Tooltip>
        </Space>
      </div>

      {isRecording && isPageHidden && (
        <div
          style={{
            background: '#faad14',
            color: '#fff',
            padding: '6px 16px',
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <WarningOutlined />
          页面已切至后台，录制可能受到影响
        </div>
      )}

      <div
        style={{
          display: 'flex',
          flex: 1,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: 220,
            background: '#fff',
            borderRight: '1px solid #e8e8e8',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid #e8e8e8',
              fontWeight: 500,
              fontSize: 14,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>序列列表</span>
            <Tag color="blue">{seriesList.length}</Tag>
          </div>
          <List
            style={{ flex: 1, overflow: 'auto' }}
            dataSource={seriesList}
            loading={loadingSeries}
            renderItem={(series) => (
              <List.Item
                key={series.series_uid}
                onClick={() => handleSeriesChange(series.series_uid)}
                style={{
                  cursor: 'pointer',
                  padding: '10px 16px',
                  background: currentSeriesUid === series.series_uid ? '#e6f7ff' : 'transparent',
                  borderLeft: currentSeriesUid === series.series_uid ? '3px solid #1890ff' : '3px solid transparent',
                }}
              >
                <div style={{ width: '100%' }}>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
                    序列 {series.series_number || '-'}
                  </div>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
                    {series.series_description || '无描述'}
                  </div>
                  <div style={{ fontSize: 11, color: '#999' }}>
                    {series.image_count || 0} 张影像
                  </div>
                </div>
              </List.Item>
            )}
          />
        </div>

        <div
          ref={viewerContainerRef}
          style={{
            flex: 1,
            background: '#000',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {viewMode === 'single' && currentImageUid && (
            <CornerstoneViewer
              ref={cornerstoneViewerRef}
              imageUid={currentImageUid}
              imageInfo={{
                ...currentImageInfo,
                total_slices: imageList.length,
                series_description: currentSeriesInfo?.series_description,
              }}
              isReadOnly={isReadOnly}
              lockInfo={lockInfo}
              currentTool={currentTool}
              onAnnotationComplete={handleAnnotationComplete}
              annotations={displayAnnotations
                .filter((a) => a.status !== 'rejected')
                .map((a) => {
                  let toolName = a.tool_name
                  if (!toolName && a.annotation_type) {
                    toolName = Object.keys(ANNOTATION_TYPE_MAP).find(
                      (k) => ANNOTATION_TYPE_MAP[k] === a.annotation_type
                    )
                  }
                  return {
                    tool_name: toolName || 'RectangleRoi',
                    data: a.data,
                  }
                })}
            />
          )}

          {viewMode === 'mpr' && imageList.length > 0 && (
            <MPRViewer
              images={imageList}
              currentIndex={currentImageIndex}
              onIndexChange={(index) => setCurrentImageIndex(index)}
            />
          )}

          {viewMode === 'single' && !currentImageUid && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: '#666',
              }}
            >
              {loadingImages ? '加载中...' : '请选择序列和影像'}
            </div>
          )}

          {isRecording && (
            <div
              style={{
                position: 'absolute',
                top: 16,
                right: 16,
                background: 'rgba(255, 0, 0, 0.85)',
                color: '#fff',
                padding: '6px 12px',
                borderRadius: 4,
                fontSize: 12,
                zIndex: 100,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#fff',
                  animation: 'pulse 1s infinite',
                }}
              />
              录制中
            </div>
          )}

          {viewMode === 'single' && lockInfo && !lockInfo.is_me && (
            <div
              style={{
                position: 'absolute',
                top: 16,
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(250, 173, 20, 0.9)',
                color: '#fff',
                padding: '6px 16px',
                borderRadius: 4,
                fontSize: 13,
                zIndex: 100,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <WarningOutlined />
              {lockInfo.locked_by_name || '某用户'}正在标注，当前为只读模式
            </div>
          )}
        </div>

        <div
          style={{
            width: 280,
            background: '#fff',
            borderLeft: '1px solid #e8e8e8',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {viewMode === 'single' && (
            <>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #e8e8e8' }}>
                <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 8 }}>工具</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {TOOL_LIST.map((tool) => (
                    <Tooltip key={tool.key} title={tool.name}>
                      <Button
                        size="small"
                        type={currentTool === tool.key ? 'primary' : 'default'}
                        onClick={() => setCurrentTool(tool.key)}
                        disabled={isReadOnly && tool.type === 'annotation'}
                        style={{ fontSize: 12 }}
                      >
                        {tool.icon}
                      </Button>
                    </Tooltip>
                  ))}
                </div>
              </div>

              <div style={{ padding: '12px 16px', borderBottom: '1px solid #e8e8e8' }}>
                <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 8 }}>窗宽窗位</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {WL_PRESETS.map((preset) => (
                    <Button
                      key={preset.name}
                      size="small"
                      style={{ fontSize: 11, padding: '0 8px' }}
                      onClick={() => applyWLPreset(preset)}
                    >
                      {preset.name}
                    </Button>
                  ))}
                </div>
              </div>
            </>
          )}

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid #e8e8e8',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontWeight: 500, fontSize: 14 }}>
                标注列表 <Tag color="blue">{displayAnnotations.length}</Tag>
              </span>
              <Space size={8}>
                {isReviewer() && (
                  <Tooltip title={showHistory ? '隐藏历史' : '显示历史'}>
                    <Button
                      size="small"
                      type={showHistory ? 'primary' : 'default'}
                      icon={<HistoryOutlined />}
                      onClick={() => setShowHistory(!showHistory)}
                    />
                  </Tooltip>
                )}
                {viewMode === 'single' && (
                  <span style={{ fontSize: 12, color: '#999' }}>
                    {currentImageIndex + 1} / {imageList.length}
                  </span>
                )}
              </Space>
            </div>
            <List
              style={{ flex: 1, overflow: 'auto' }}
              dataSource={displayAnnotations}
              loading={annotationsLoading}
              locale={{ emptyText: '暂无标注' }}
              renderItem={(anno) => (
                <List.Item key={anno.id || anno.annotation_id} style={{ padding: '10px 16px' }}>
                  <div style={{ width: '100%' }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 4,
                      }}
                    >
                      <Space size={8}>
                        <span
                          style={{
                            display: 'inline-block',
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            background: getCategoryColor(anno.category),
                          }}
                        />
                        <span style={{ fontSize: 13, fontWeight: 500 }}>
                          {anno.category || getToolName(anno.tool_name)}
                        </span>
                      </Space>
                      {getStatusTag(anno.status)}
                    </div>
                    <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>
                      工具: {getToolName(anno.tool_name) || anno.annotation_type}
                    </div>
                    {anno.label && (
                      <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>
                        备注: {anno.label}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: '#999', marginBottom: 8 }}>
                      {anno.created_by_name || '未知用户'} · {dayjs(anno.created_at).format('MM-DD HH:mm')}
                    </div>
                    {isReviewer() && anno.status === 'pending' && (
                      <Space size={4}>
                        <Button
                          size="small"
                          type="text"
                          icon={<CheckOutlined />}
                          style={{ color: '#52c41a', padding: '0 4px' }}
                          onClick={() => handleAcceptAnnotation(anno.id || anno.annotation_id)}
                        >
                          接受
                        </Button>
                        <Button
                          size="small"
                          type="text"
                          icon={<CloseOutlined />}
                          style={{ color: '#ff4d4f', padding: '0 4px' }}
                          onClick={() => handleRejectAnnotation(anno.id || anno.annotation_id)}
                        >
                          拒绝
                        </Button>
                      </Space>
                    )}
                  </div>
                </List.Item>
              )}
            />
          </div>
        </div>
      </div>

      <AnnotationLabelPopup
        visible={labelPopupVisible}
        annotationType={annotationTypeLabel}
        onConfirm={handleLabelConfirm}
        onCancel={handleLabelCancel}
      />
    </div>
  )
}

export default ViewerPage
