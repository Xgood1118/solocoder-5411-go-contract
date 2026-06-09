import React, { useState, useEffect, useRef, useCallback } from 'react'
import * as cornerstone from 'cornerstone-core'
import * as cornerstoneTools from 'cornerstone-tools'
import { initCornerstone } from '../utils/cornerstone'

const TimeSeriesComparison = ({
  leftImage,
  rightImage,
  leftStudyDate,
  rightStudyDate,
  onClose,
}) => {
  const leftElementRef = useRef(null)
  const rightElementRef = useRef(null)
  const [isSyncMode, setIsSyncMode] = useState(true)
  const [leftScale, setLeftScale] = useState(1)
  const [rightScale, setRightScale] = useState(1)
  const [leftLoaded, setLeftLoaded] = useState(false)
  const [rightLoaded, setRightLoaded] = useState(false)
  const isSyncingRef = useRef(false)
  const sourceViewportRef = useRef(null)

  const getPhysicalSize = (imageInfo) => {
    if (!imageInfo) return { width: 0, height: 0 }
    const pixelSpacing = imageInfo.pixel_spacing || [1, 1]
    const columns = imageInfo.columns || 512
    const rows = imageInfo.rows || 512
    return {
      width: columns * pixelSpacing[0],
      height: rows * pixelSpacing[1],
    }
  }

  const calculateInitialScale = useCallback((element, imageInfo) => {
    if (!element || !imageInfo) return 1

    const pixelSpacing = imageInfo.pixel_spacing || [1, 1]
    const columns = imageInfo.columns || 512
    const rows = imageInfo.rows || 512

    const physicalWidth = columns * pixelSpacing[0]
    const physicalHeight = rows * pixelSpacing[1]

    const elementWidth = element.clientWidth
    const elementHeight = element.clientHeight

    const scaleX = elementWidth / columns
    const scaleY = elementHeight / rows
    const fitScale = Math.min(scaleX, scaleY) * 0.9

    return fitScale
  }, [])

  const syncViewport = useCallback((sourceElement, targetElement, imageInfo) => {
    if (!sourceElement || !targetElement || !isSyncMode) return
    if (isSyncingRef.current) return

    isSyncingRef.current = true

    try {
      const sourceViewport = cornerstone.getViewport(sourceElement)
      const targetViewport = cornerstone.getViewport(targetElement)

      if (!sourceViewport || !targetViewport) {
        isSyncingRef.current = false
        return
      }

      targetViewport.voi.windowWidth = sourceViewport.voi.windowWidth
      targetViewport.voi.windowCenter = sourceViewport.voi.windowCenter

      const leftPhysicalSize = getPhysicalSize(leftImage)
      const rightPhysicalSize = getPhysicalSize(rightImage)

      if (leftPhysicalSize.width > 0 && rightPhysicalSize.width > 0) {
        const scaleRatio = rightPhysicalSize.width / leftPhysicalSize.width
        if (sourceElement === leftElementRef.current) {
          targetViewport.scale = sourceViewport.scale * scaleRatio
        } else {
          targetViewport.scale = sourceViewport.scale / scaleRatio
        }
      }

      const sourceImage = cornerstone.getEnabledElement(sourceElement)?.image
      const targetImage = cornerstone.getEnabledElement(targetElement)?.image

      if (sourceImage && targetImage) {
        const srcPixelSpacing = leftImage?.pixel_spacing || [1, 1]
        const tgtPixelSpacing = rightImage?.pixel_spacing || [1, 1]

        const translationXRatio = tgtPixelSpacing[0] / srcPixelSpacing[0]
        const translationYRatio = tgtPixelSpacing[1] / srcPixelSpacing[1]

        if (sourceElement === leftElementRef.current) {
          targetViewport.translation.x = sourceViewport.translation.x * translationXRatio
          targetViewport.translation.y = sourceViewport.translation.y * translationYRatio
        } else {
          targetViewport.translation.x = sourceViewport.translation.x / translationXRatio
          targetViewport.translation.y = sourceViewport.translation.y / translationYRatio
        }
      }

      cornerstone.setViewport(targetElement, targetViewport)

      if (targetElement === leftElementRef.current) {
        setLeftScale(targetViewport.scale.toFixed(2))
      } else {
        setRightScale(targetViewport.scale.toFixed(2))
      }
    } catch (e) {
      console.warn('Sync viewport error:', e)
    }

    isSyncingRef.current = false
  }, [isSyncMode, leftImage, rightImage])

  const handleLeftViewportChange = useCallback(() => {
    if (!leftElementRef.current) return
    try {
      const viewport = cornerstone.getViewport(leftElementRef.current)
      if (viewport) {
        setLeftScale(viewport.scale.toFixed(2))
      }
    } catch (e) {}

    if (isSyncMode && rightLoaded) {
      syncViewport(leftElementRef.current, rightElementRef.current, rightImage)
    }
  }, [isSyncMode, rightLoaded, rightImage, syncViewport])

  const handleRightViewportChange = useCallback(() => {
    if (!rightElementRef.current) return
    try {
      const viewport = cornerstone.getViewport(rightElementRef.current)
      if (viewport) {
        setRightScale(viewport.scale.toFixed(2))
      }
    } catch (e) {}

    if (isSyncMode && leftLoaded) {
      syncViewport(rightElementRef.current, leftElementRef.current, leftImage)
    }
  }, [isSyncMode, leftLoaded, leftImage, syncViewport])

  const loadLeftImage = useCallback(async () => {
    if (!leftElementRef.current || !leftImage?.image_uid) return

    initCornerstone()

    const element = leftElementRef.current

    if (!cornerstone.getEnabledElements().some((e) => e.element === element)) {
      cornerstone.enable(element)
    }

    const imageId = `wadouri:/api/images/${leftImage.image_uid}/dicom`

    try {
      await cornerstone.loadImage(imageId).then((image) => {
        cornerstone.displayImage(element, image)

        cornerstoneTools.setToolActiveForElement(element, 'Wwwc', { mouseButtonMask: 1 })
        cornerstoneTools.setToolActiveForElement(element, 'Pan', { mouseButtonMask: 2 })
        cornerstoneTools.setToolActiveForElement(element, 'Zoom', { mouseButtonMask: 4 })

        const initialScale = calculateInitialScale(element, leftImage)
        const viewport = cornerstone.getViewport(element)
        viewport.scale = initialScale
        cornerstone.setViewport(element, viewport)

        setLeftLoaded(true)
        setLeftScale(initialScale.toFixed(2))
      })
    } catch (error) {
      console.error('Failed to load left DICOM image:', error)
    }
  }, [leftImage, calculateInitialScale])

  const loadRightImage = useCallback(async () => {
    if (!rightElementRef.current || !rightImage?.image_uid) return

    initCornerstone()

    const element = rightElementRef.current

    if (!cornerstone.getEnabledElements().some((e) => e.element === element)) {
      cornerstone.enable(element)
    }

    const imageId = `wadouri:/api/images/${rightImage.image_uid}/dicom`

    try {
      await cornerstone.loadImage(imageId).then((image) => {
        cornerstone.displayImage(element, image)

        cornerstoneTools.setToolActiveForElement(element, 'Wwwc', { mouseButtonMask: 1 })
        cornerstoneTools.setToolActiveForElement(element, 'Pan', { mouseButtonMask: 2 })
        cornerstoneTools.setToolActiveForElement(element, 'Zoom', { mouseButtonMask: 4 })

        const initialScale = calculateInitialScale(element, rightImage)
        const viewport = cornerstone.getViewport(element)
        viewport.scale = initialScale
        cornerstone.setViewport(element, viewport)

        setRightLoaded(true)
        setRightScale(initialScale.toFixed(2))
      })
    } catch (error) {
      console.error('Failed to load right DICOM image:', error)
    }
  }, [rightImage, calculateInitialScale])

  const syncPhysicalSize = useCallback(() => {
    if (!leftLoaded || !rightLoaded) return
    if (!leftElementRef.current || !rightElementRef.current) return

    try {
      const leftViewport = cornerstone.getViewport(leftElementRef.current)
      const rightViewport = cornerstone.getViewport(rightElementRef.current)

      const leftPhysicalSize = getPhysicalSize(leftImage)
      const rightPhysicalSize = getPhysicalSize(rightImage)

      if (leftPhysicalSize.width > 0 && rightPhysicalSize.width > 0) {
        const scaleRatio = rightPhysicalSize.width / leftPhysicalSize.width
        rightViewport.scale = leftViewport.scale * scaleRatio
        cornerstone.setViewport(rightElementRef.current, rightViewport)
        setRightScale(rightViewport.scale.toFixed(2))
      }
    } catch (e) {
      console.warn('Sync physical size error:', e)
    }
  }, [leftLoaded, rightLoaded, leftImage, rightImage])

  const formatDate = (dateStr) => {
    if (!dateStr) return '未知日期'
    if (dateStr.length === 8) {
      return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`
    }
    return dateStr
  }

  useEffect(() => {
    loadLeftImage()
    loadRightImage()

    return () => {
      if (leftElementRef.current) {
        try {
          cornerstone.disable(leftElementRef.current)
        } catch (e) {}
      }
      if (rightElementRef.current) {
        try {
          cornerstone.disable(rightElementRef.current)
        } catch (e) {}
      }
    }
  }, [loadLeftImage, loadRightImage])

  useEffect(() => {
    if (leftLoaded && rightLoaded && isSyncMode) {
      syncPhysicalSize()
    }
  }, [leftLoaded, rightLoaded, isSyncMode, syncPhysicalSize])

  useEffect(() => {
    if (!leftElementRef.current || !leftLoaded) return

    const element = leftElementRef.current
    const handler = () => handleLeftViewportChange()
    element.addEventListener('cornerstoneimagerendered', handler)

    return () => {
      element.removeEventListener('cornerstoneimagerendered', handler)
    }
  }, [leftLoaded, handleLeftViewportChange])

  useEffect(() => {
    if (!rightElementRef.current || !rightLoaded) return

    const element = rightElementRef.current
    const handler = () => handleRightViewportChange()
    element.addEventListener('cornerstoneimagerendered', handler)

    return () => {
      element.removeEventListener('cornerstoneimagerendered', handler)
    }
  }, [rightLoaded, handleRightViewportChange])

  const leftPixelSpacing = leftImage?.pixel_spacing
  const rightPixelSpacing = rightImage?.pixel_spacing
  const leftPhysicalSize = getPhysicalSize(leftImage)
  const rightPhysicalSize = getPhysicalSize(rightImage)

  return (
    <div style={styles.container}>
      <div style={styles.toolbar}>
        <div style={styles.toolbarLeft}>
          <span style={styles.title}>时间序列对比</span>
        </div>
        <div style={styles.toolbarCenter}>
          <button
            style={{
              ...styles.syncButton,
              ...(isSyncMode ? styles.syncButtonActive : {}),
            }}
            onClick={() => setIsSyncMode(!isSyncMode)}
          >
            {isSyncMode ? '🔗 同步模式' : '🔓 独立模式'}
          </button>
          <span style={styles.syncHint}>
            {isSyncMode ? '缩放、平移、窗宽窗位已同步' : '两侧视图独立操作'}
          </span>
        </div>
        <div style={styles.toolbarRight}>
          <button style={styles.closeButton} onClick={onClose}>
            ✕ 关闭
          </button>
        </div>
      </div>

      <div style={styles.viewportsContainer}>
        <div style={styles.viewportWrapper}>
          <div style={styles.viewportLabel}>
            <span style={styles.viewportLabelTitle}>基线检查</span>
            <span style={styles.viewportLabelDate}>{formatDate(leftStudyDate)}</span>
          </div>
          <div
            ref={leftElementRef}
            style={styles.viewport}
          />
          <div style={styles.viewportInfoLeft}>
            <div>物理尺寸: {leftPhysicalSize.width.toFixed(1)} × {leftPhysicalSize.height.toFixed(1)} mm</div>
          </div>
          <div style={styles.viewportInfoRight}>
            <div>缩放: {leftScale}x</div>
            <div>像素间距: {leftPixelSpacing ? `${leftPixelSpacing[0].toFixed(3)}×${leftPixelSpacing[1].toFixed(3)} mm` : 'N/A'}</div>
          </div>
        </div>

        <div style={styles.divider} />

        <div style={styles.viewportWrapper}>
          <div style={styles.viewportLabel}>
            <span style={styles.viewportLabelTitle}>随访检查</span>
            <span style={styles.viewportLabelDate}>{formatDate(rightStudyDate)}</span>
          </div>
          <div
            ref={rightElementRef}
            style={styles.viewport}
          />
          <div style={styles.viewportInfoLeft}>
            <div>物理尺寸: {rightPhysicalSize.width.toFixed(1)} × {rightPhysicalSize.height.toFixed(1)} mm</div>
          </div>
          <div style={styles.viewportInfoRight}>
            <div>缩放: {rightScale}x</div>
            <div>像素间距: {rightPixelSpacing ? `${rightPixelSpacing[0].toFixed(3)}×${rightPixelSpacing[1].toFixed(3)} mm` : 'N/A'}</div>
          </div>
        </div>
      </div>

      <div style={styles.footer}>
        <span style={styles.footerText}>⚖️ 已按物理尺寸校准显示</span>
      </div>
    </div>
  )
}

const styles = {
  container: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#1a1a1a',
    color: '#fff',
    position: 'relative',
  },
  toolbar: {
    height: '48px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 16px',
    backgroundColor: '#2a2a2a',
    borderBottom: '1px solid #333',
    flexShrink: 0,
  },
  toolbarLeft: {
    display: 'flex',
    alignItems: 'center',
  },
  toolbarCenter: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  toolbarRight: {
    display: 'flex',
    alignItems: 'center',
  },
  title: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#fff',
  },
  syncButton: {
    padding: '6px 16px',
    borderRadius: '4px',
    border: '1px solid #555',
    backgroundColor: '#3a3a3a',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '13px',
    transition: 'all 0.2s',
  },
  syncButtonActive: {
    backgroundColor: '#1890ff',
    borderColor: '#1890ff',
  },
  syncHint: {
    fontSize: '12px',
    color: '#999',
  },
  closeButton: {
    padding: '6px 16px',
    borderRadius: '4px',
    border: '1px solid #555',
    backgroundColor: '#3a3a3a',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '13px',
    transition: 'all 0.2s',
  },
  viewportsContainer: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
    position: 'relative',
  },
  viewportWrapper: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  divider: {
    width: '2px',
    backgroundColor: '#333',
    flexShrink: 0,
  },
  viewport: {
    width: '100%',
    height: '100%',
    cursor: 'crosshair',
  },
  viewportLabel: {
    position: 'absolute',
    top: '12px',
    left: '12px',
    zIndex: 10,
    color: '#fff',
    textShadow: '1px 1px 2px rgba(0, 0, 0, 0.8)',
    pointerEvents: 'none',
    lineHeight: 1.5,
  },
  viewportLabelTitle: {
    fontSize: '14px',
    fontWeight: 'bold',
    display: 'block',
  },
  viewportLabelDate: {
    fontSize: '13px',
    color: '#4fc3f7',
    display: 'block',
  },
  viewportInfoLeft: {
    position: 'absolute',
    bottom: '12px',
    left: '12px',
    zIndex: 10,
    color: '#fff',
    fontSize: '11px',
    textShadow: '1px 1px 2px rgba(0, 0, 0, 0.8)',
    pointerEvents: 'none',
    lineHeight: 1.6,
  },
  viewportInfoRight: {
    position: 'absolute',
    bottom: '12px',
    right: '12px',
    zIndex: 10,
    color: '#fff',
    fontSize: '11px',
    textShadow: '1px 1px 2px rgba(0, 0, 0, 0.8)',
    pointerEvents: 'none',
    lineHeight: 1.6,
    textAlign: 'right',
  },
  footer: {
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2a2a2a',
    borderTop: '1px solid #333',
    flexShrink: 0,
  },
  footerText: {
    fontSize: '12px',
    color: '#4caf50',
  },
}

export default TimeSeriesComparison
