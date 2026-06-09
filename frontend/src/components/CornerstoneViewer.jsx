import React, { useRef, useEffect, useState, useCallback, useImperativeHandle, forwardRef } from 'react'
import * as cornerstone from 'cornerstone-core'
import * as cornerstoneTools from 'cornerstone-tools'
import { initCornerstone, WL_PRESETS, TOOL_LIST } from '../utils/cornerstone'

const CornerstoneViewer = forwardRef(({
  imageUid,
  imageInfo,
  isReadOnly,
  lockInfo,
  currentTool,
  onImageLoaded,
  onAnnotationComplete,
  annotations = [],
}, ref) => {
  const elementRef = useRef(null)
  const [huValue, setHuValue] = useState(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [scale, setScale] = useState(1)
  const [activeWLPreset, setActiveWLPreset] = useState('默认')
  const [isImageLoaded, setIsImageLoaded] = useState(false)
  const annotationEventBoundRef = useRef(false)

  const loadImage = useCallback(async () => {
    if (!elementRef.current || !imageUid) return

    initCornerstone()

    const element = elementRef.current

    if (!cornerstone.getEnabledElements().some((e) => e.element === element)) {
      cornerstone.enable(element)
    }

    const imageId = `wadouri:/api/images/${imageUid}/dicom`

    try {
      await cornerstone.loadImage(imageId).then((image) => {
        cornerstone.displayImage(element, image)
        setIsImageLoaded(true)
        if (onImageLoaded) {
          onImageLoaded(image)
        }
      })
    } catch (error) {
      console.error('Failed to load DICOM image:', error)
    }
  }, [imageUid, onImageLoaded])

  const handleToolChange = useCallback((toolName) => {
    if (!elementRef.current || !isImageLoaded) return

    const element = elementRef.current

    TOOL_LIST.forEach((tool) => {
      try {
        cornerstoneTools.setToolDisabled(tool.key)
      } catch (e) {}
    })

    if (isReadOnly) {
      cornerstoneTools.setToolActive('Wwwc', { mouseButtonMask: 1 })
      cornerstoneTools.setToolActive('Pan', { mouseButtonMask: 2 })
      cornerstoneTools.setToolActive('Zoom', { mouseButtonMask: 4 })
      return
    }

    if (toolName === 'Wwwc') {
      cornerstoneTools.setToolActive('Wwwc', { mouseButtonMask: 1 })
      cornerstoneTools.setToolActive('Pan', { mouseButtonMask: 2 })
      cornerstoneTools.setToolActive('Zoom', { mouseButtonMask: 4 })
    } else if (toolName === 'Pan') {
      cornerstoneTools.setToolActive('Pan', { mouseButtonMask: 1 })
      cornerstoneTools.setToolActive('Zoom', { mouseButtonMask: 4 })
    } else if (toolName === 'Zoom') {
      cornerstoneTools.setToolActive('Zoom', { mouseButtonMask: 1 })
      cornerstoneTools.setToolActive('Pan', { mouseButtonMask: 2 })
    } else {
      cornerstoneTools.setToolActive(toolName, { mouseButtonMask: 1 })
      cornerstoneTools.setToolActive('Pan', { mouseButtonMask: 2 })
      cornerstoneTools.setToolActive('Zoom', { mouseButtonMask: 4 })
    }
  }, [isReadOnly, isImageLoaded])

  const applyWLPreset = useCallback((preset) => {
    if (!elementRef.current || !isImageLoaded) return

    const element = elementRef.current

    if (preset.name === '默认') {
      cornerstone.reset(element)
    } else {
      const viewport = cornerstone.getViewport(element)
      viewport.voi.windowWidth = preset.windowWidth
      viewport.voi.windowCenter = preset.windowCenter
      cornerstone.setViewport(element, viewport)
    }

    setActiveWLPreset(preset.name)
  }, [isImageLoaded])

  useImperativeHandle(ref, () => ({
    applyWLPreset,
    getElement: () => elementRef.current,
  }), [applyWLPreset])

  const handleMouseMove = useCallback((e) => {
    if (!elementRef.current || !isImageLoaded) return

    const element = elementRef.current
    const rect = element.getBoundingClientRect()
    const canvasX = e.clientX - rect.left
    const canvasY = e.clientY - rect.top

    setMousePos({ x: canvasX, y: canvasY })

    try {
      const enabledElement = cornerstone.getEnabledElement(element)
      if (enabledElement && enabledElement.image) {
        const viewport = cornerstone.getViewport(element)
        const image = enabledElement.image

        const pixelX = Math.floor(
          (canvasX - element.clientWidth / 2) / viewport.scale + image.column / 2
        )
        const pixelY = Math.floor(
          (canvasY - element.clientHeight / 2) / viewport.scale + image.row / 2
        )

        if (
          pixelX >= 0 &&
          pixelX < image.columns &&
          pixelY >= 0 &&
          pixelY < image.rows
        ) {
          const pixelIndex = pixelY * image.columns + pixelX
          const storedPixel = image.getPixelData()[pixelIndex]
          const hu = storedPixel * image.slope + image.intercept
          setHuValue(Math.round(hu))
        } else {
          setHuValue(null)
        }
      }
    } catch (error) {
      setHuValue(null)
    }
  }, [isImageLoaded])

  const handleViewportChange = useCallback(() => {
    if (!elementRef.current) return
    try {
      const viewport = cornerstone.getViewport(elementRef.current)
      if (viewport) {
        setScale(viewport.scale.toFixed(2))
      }
    } catch (e) {}
  }, [])

  const handleAnnotationAdded = useCallback((evt) => {
    if (isReadOnly) return

    const eventData = evt.detail
    const annotation = eventData.annotation

    if (!annotation || !annotation.isDrawing) {
      return
    }

    if (onAnnotationComplete) {
      const element = elementRef.current
      const enabledElement = cornerstone.getEnabledElement(element)
      const image = enabledElement?.image

      let pixelCoordinates = []

      if (annotation.handles) {
        const handleKeys = Object.keys(annotation.handles).filter(
          (k) => k !== 'textBox' && annotation.handles[k]
        )
        pixelCoordinates = handleKeys.map((key) => {
          const handle = annotation.handles[key]
          return {
            x: Math.round(handle.x),
            y: Math.round(handle.y),
          }
        })
      }

      if (annotation.points) {
        pixelCoordinates = annotation.points.map((p) => ({
          x: Math.round(p.x),
          y: Math.round(p.y),
        }))
      }

      const annotationData = {
        toolName: eventData.toolName,
        annotationUid: annotation.annotationUid || `anno_${Date.now()}`,
        pixelCoordinates,
        imageUid,
      }

      onAnnotationComplete(annotationData)
    }
  }, [isReadOnly, onAnnotationComplete, imageUid])

  const loadExistingAnnotations = useCallback(() => {
    if (!elementRef.current || !isImageLoaded || !annotations.length) return

    const element = elementRef.current
    const toolStateManager = cornerstoneTools.getElementToolStateManager(element)

    annotations.forEach((anno) => {
      if (!anno.tool_name || !anno.data) return

      try {
        const toolState = cornerstoneTools.getToolState(element, anno.tool_name)
        if (toolState) {
          toolState.data.push(anno.data)
        } else {
          cornerstoneTools.addToolState(element, anno.tool_name, anno.data)
        }
      } catch (e) {
        console.warn('Failed to load annotation:', e)
      }
    })

    cornerstone.updateImage(element)
  }, [isImageLoaded, annotations])

  useEffect(() => {
    loadImage()

    return () => {
      if (elementRef.current) {
        try {
          cornerstone.disable(elementRef.current)
        } catch (e) {}
      }
    }
  }, [loadImage])

  useEffect(() => {
    if (!elementRef.current || !isImageLoaded) return

    const element = elementRef.current

    const updateViewport = () => handleViewportChange()
    element.addEventListener('cornerstoneimagerendered', updateViewport)

    return () => {
      element.removeEventListener('cornerstoneimagerendered', updateViewport)
    }
  }, [isImageLoaded, handleViewportChange])

  useEffect(() => {
    if (!elementRef.current || !isImageLoaded || isReadOnly) return

    const element = elementRef.current

    if (!annotationEventBoundRef.current) {
      const eventName = 'cornerstonetoolsmeasurementadded'
      element.addEventListener(eventName, handleAnnotationAdded)
      annotationEventBoundRef.current = true

      return () => {
        element.removeEventListener(eventName, handleAnnotationAdded)
        annotationEventBoundRef.current = false
      }
    }
  }, [isImageLoaded, isReadOnly, handleAnnotationAdded])

  useEffect(() => {
    if (currentTool && !isReadOnly) {
      handleToolChange(currentTool)
    }
  }, [currentTool, isReadOnly, handleToolChange])

  useEffect(() => {
    loadExistingAnnotations()
  }, [loadExistingAnnotations])

  return (
    <div className="cornerstone-canvas-wrapper">
      <div
        ref={elementRef}
        className="cornerstone-canvas"
        onMouseMove={handleMouseMove}
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
        }}
      />

      {!isReadOnly && (
        <div className="viewer-toolbar">
          {TOOL_LIST.map((tool) => (
            <button
              key={tool.key}
              className={currentTool === tool.key ? 'active' : ''}
              onClick={() => handleToolChange(tool.key)}
              title={tool.name}
            >
              {tool.icon} {tool.name}
            </button>
          ))}
        </div>
      )}

      <div className="wl-presets-bar">
        {WL_PRESETS.map((preset) => (
          <button
            key={preset.name}
            className={activeWLPreset === preset.name ? 'active' : ''}
            onClick={() => applyWLPreset(preset)}
          >
            {preset.name}
          </button>
        ))}
      </div>

      <div className="viewer-info-overlay">
        <div>{imageInfo?.series_description || '序列描述'}</div>
        <div>
          层数: {imageInfo?.instance_number || imageInfo?.slice_number || '1'}
          {imageInfo?.total_slices ? ` / ${imageInfo.total_slices}` : ''}
        </div>
      </div>

      <div className="viewer-hu-value">
        {huValue !== null && (
          <span>
            HU: {huValue} ({Math.round(mousePos.x)}, {Math.round(mousePos.y)})
          </span>
        )}
      </div>

      <div className="viewer-scale-info">缩放: {scale}x</div>

      {lockInfo && !lockInfo.is_me && (
        <div className="lock-banner">
          {lockInfo.locked_by_name || '某用户'}正在标注
        </div>
      )}
    </div>
  )
})

CornerstoneViewer.displayName = 'CornerstoneViewer'

export default CornerstoneViewer
