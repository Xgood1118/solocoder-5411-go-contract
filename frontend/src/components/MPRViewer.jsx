import React, { useState, useEffect, useRef, useCallback } from 'react'
import * as cornerstone from 'cornerstone-core'
import { initCornerstone, WL_PRESETS } from '../utils/cornerstone'

const MPRViewer = ({
  images = [],
  currentIndex = 0,
  onIndexChange,
}) => {
  const axialRef = useRef(null)
  const coronalCanvasRef = useRef(null)
  const sagittalCanvasRef = useRef(null)

  const [imageDataCache, setImageDataCache] = useState([])
  const [isLoaded, setIsLoaded] = useState(false)
  const [axialIndex, setAxialIndex] = useState(currentIndex)
  const [coronalIndex, setCoronalIndex] = useState(0)
  const [sagittalIndex, setSagittalIndex] = useState(0)

  const [crosshair, setCrosshair] = useState({ x: 0, y: 0, z: 0 })

  const [axialWL, setAxialWL] = useState({ windowCenter: 40, windowWidth: 400 })
  const [coronalWL, setCoronalWL] = useState({ windowCenter: 40, windowWidth: 400 })
  const [sagittalWL, setSagittalWL] = useState({ windowCenter: 40, windowWidth: 400 })

  const [axialScale, setAxialScale] = useState(1)
  const [coronalScale, setCoronalScale] = useState(1)
  const [sagittalScale, setSagittalScale] = useState(1)

  const [axialPan, setAxialPan] = useState({ x: 0, y: 0 })
  const [coronalPan, setCoronalPan] = useState({ x: 0, y: 0 })
  const [sagittalPan, setSagittalPan] = useState({ x: 0, y: 0 })

  const [imageInfo, setImageInfo] = useState({ columns: 0, rows: 0, sliceCount: 0 })
  const [huValue, setHuValue] = useState(null)
  const [coordinates, setCoordinates] = useState({ x: 0, y: 0, z: 0 })

  const isDraggingRef = useRef(false)
  const dragStartRef = useRef({ x: 0, y: 0 })
  const dragTypeRef = useRef(null)
  const dragViewRef = useRef(null)

  const loadImages = useCallback(async () => {
    if (!images || images.length === 0) return

    initCornerstone()

    const cache = []
    let cols = 0
    let rows = 0

    for (let i = 0; i < images.length; i++) {
      const imageUid = images[i]?.image_uid || images[i]?.uid
      if (!imageUid) continue

      const imageId = `wadouri:/api/images/${imageUid}/dicom`
      try {
        const image = await cornerstone.loadImage(imageId)
        cache.push(image)
        cols = image.columns
        rows = image.rows
      } catch (e) {
        console.warn(`Failed to load image ${i}:`, e)
      }
    }

    setImageDataCache(cache)
    setImageInfo({ columns: cols, rows: rows, sliceCount: cache.length })
    setCoronalIndex(Math.floor(cols / 2))
    setSagittalIndex(Math.floor(rows / 2))
    setCrosshair({ x: Math.floor(cols / 2), y: Math.floor(rows / 2), z: Math.floor(cache.length / 2) })
    setIsLoaded(true)

    if (cache.length > 0 && axialRef.current) {
      if (!cornerstone.getEnabledElements().some((e) => e.element === axialRef.current)) {
        cornerstone.enable(axialRef.current)
      }
      cornerstone.displayImage(axialRef.current, cache[Math.floor(cache.length / 2)])
      setAxialIndex(Math.floor(cache.length / 2))
      if (onIndexChange) {
        onIndexChange(Math.floor(cache.length / 2))
      }
    }
  }, [images, onIndexChange])

  useEffect(() => {
    loadImages()

    return () => {
      if (axialRef.current) {
        try {
          cornerstone.disable(axialRef.current)
        } catch (e) {}
      }
    }
  }, [loadImages])

  const applyWindowLevel = useCallback((pixelValue, windowCenter, windowWidth) => {
    const min = windowCenter - windowWidth / 2
    const max = windowCenter + windowWidth / 2
    if (pixelValue <= min) return 0
    if (pixelValue >= max) return 255
    return Math.round(((pixelValue - min) / windowWidth) * 255)
  }, [])

  const getPixelValue = useCallback((image, x, y) => {
    if (!image || x < 0 || x >= image.columns || y < 0 || y >= image.rows) {
      return -1000
    }
    const index = Math.floor(y) * image.columns + Math.floor(x)
    const pixelData = image.getPixelData()
    return pixelData[index] * image.slope + image.intercept
  }, [])

  const renderCoronal = useCallback(() => {
    const canvas = coronalCanvasRef.current
    if (!canvas || imageDataCache.length === 0) return

    const ctx = canvas.getContext('2d')
    const width = canvas.width
    const height = canvas.height

    const sliceCount = imageDataCache.length
    const firstImage = imageDataCache[0]
    const cols = firstImage.columns
    const rows = firstImage.rows

    const imageData = ctx.createImageData(width, height)
    const data = imageData.data

    const xIndex = coronalIndex

    const scaleX = width / cols
    const scaleY = height / sliceCount

    for (let py = 0; py < height; py++) {
      const sliceIdx = Math.min(Math.floor(py / scaleY), sliceCount - 1)
      const image = imageDataCache[sliceIdx]
      if (!image) continue

      for (let px = 0; px < width; px++) {
        const yIdx = Math.floor(px / scaleX)
        const hu = getPixelValue(image, xIndex, yIdx)
        const gray = applyWindowLevel(hu, coronalWL.windowCenter, coronalWL.windowWidth)

        const idx = (py * width + px) * 4
        data[idx] = gray
        data[idx + 1] = gray
        data[idx + 2] = gray
        data[idx + 3] = 255
      }
    }

    ctx.putImageData(imageData, 0, 0)
  }, [imageDataCache, coronalIndex, coronalWL, applyWindowLevel, getPixelValue])

  const renderSagittal = useCallback(() => {
    const canvas = sagittalCanvasRef.current
    if (!canvas || imageDataCache.length === 0) return

    const ctx = canvas.getContext('2d')
    const width = canvas.width
    const height = canvas.height

    const sliceCount = imageDataCache.length
    const firstImage = imageDataCache[0]
    const cols = firstImage.columns
    const rows = firstImage.rows

    const imageData = ctx.createImageData(width, height)
    const data = imageData.data

    const yIndex = sagittalIndex

    const scaleX = width / cols
    const scaleY = height / sliceCount

    for (let py = 0; py < height; py++) {
      const sliceIdx = Math.min(Math.floor(py / scaleY), sliceCount - 1)
      const image = imageDataCache[sliceIdx]
      if (!image) continue

      for (let px = 0; px < width; px++) {
        const xIdx = Math.floor(px / scaleX)
        const hu = getPixelValue(image, xIdx, yIndex)
        const gray = applyWindowLevel(hu, sagittalWL.windowCenter, sagittalWL.windowWidth)

        const idx = (py * width + px) * 4
        data[idx] = gray
        data[idx + 1] = gray
        data[idx + 2] = gray
        data[idx + 3] = 255
      }
    }

    ctx.putImageData(imageData, 0, 0)
  }, [imageDataCache, sagittalIndex, sagittalWL, applyWindowLevel, getPixelValue])

  const drawCrosshairOnCanvas = useCallback((canvas, x, y, color = '#00ff00') => {
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.strokeStyle = color
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, canvas.height)
    ctx.moveTo(0, y)
    ctx.lineTo(canvas.width, y)
    ctx.stroke()
  }, [])

  const renderAllViews = useCallback(() => {
    if (!isLoaded || imageDataCache.length === 0) return

    renderCoronal()
    renderSagittal()

    const coronalCanvas = coronalCanvasRef.current
    const sagittalCanvas = sagittalCanvasRef.current

    if (coronalCanvas) {
      const firstImage = imageDataCache[0]
      const cols = firstImage.columns
      const sliceCount = imageDataCache.length
      const scaleX = coronalCanvas.width / cols
      const scaleY = coronalCanvas.height / sliceCount
      const crossX = crosshair.x * scaleX
      const crossY = crosshair.z * scaleY
      drawCrosshairOnCanvas(coronalCanvas, crossX, crossY, '#00ff00')
    }

    if (sagittalCanvas) {
      const firstImage = imageDataCache[0]
      const rows = firstImage.rows
      const sliceCount = imageDataCache.length
      const scaleX = sagittalCanvas.width / rows
      const scaleY = sagittalCanvas.height / sliceCount
      const crossX = crosshair.y * scaleX
      const crossY = crosshair.z * scaleY
      drawCrosshairOnCanvas(sagittalCanvas, crossX, crossY, '#00ff00')
    }
  }, [isLoaded, imageDataCache, renderCoronal, renderSagittal, crosshair, drawCrosshairOnCanvas])

  useEffect(() => {
    renderAllViews()
  }, [renderAllViews])

  const handleAxialMouseMove = useCallback((e) => {
    if (!axialRef.current || !isLoaded || imageDataCache.length === 0) return

    const element = axialRef.current
    const rect = element.getBoundingClientRect()
    const canvasX = e.clientX - rect.left
    const canvasY = e.clientY - rect.top

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

        setCrosshair({ x: pixelX, y: pixelY, z: axialIndex })
        setCoronalIndex(pixelX)
        setSagittalIndex(pixelY)
        setCoordinates({ x: pixelX, y: pixelY, z: axialIndex })

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
  }, [isLoaded, axialIndex, imageDataCache])

  const handleCoronalMouseMove = useCallback((e) => {
    const canvas = coronalCanvasRef.current
    if (!canvas || !isLoaded || imageDataCache.length === 0) return

    const rect = canvas.getBoundingClientRect()
    const canvasX = e.clientX - rect.left
    const canvasY = e.clientY - rect.top

    const firstImage = imageDataCache[0]
    const cols = firstImage.columns
    const sliceCount = imageDataCache.length

    const scaleX = canvas.width / cols
    const scaleY = canvas.height / sliceCount

    const pixelX = Math.floor(canvasX / scaleX)
    const sliceIdx = Math.min(Math.floor(canvasY / scaleY), sliceCount - 1)

    setCrosshair({ x: pixelX, y: sagittalIndex, z: sliceIdx })
    setSagittalIndex(sagittalIndex)
    setAxialIndex(sliceIdx)
    setCoordinates({ x: pixelX, y: sagittalIndex, z: sliceIdx })

    if (imageDataCache[sliceIdx]) {
      const hu = getPixelValue(imageDataCache[sliceIdx], pixelX, sagittalIndex)
      setHuValue(Math.round(hu))
    }

    if (axialRef.current && imageDataCache[sliceIdx]) {
      try {
        cornerstone.displayImage(axialRef.current, imageDataCache[sliceIdx])
        if (onIndexChange) {
          onIndexChange(sliceIdx)
        }
      } catch (e) {}
    }
  }, [isLoaded, imageDataCache, sagittalIndex, getPixelValue, onIndexChange])

  const handleSagittalMouseMove = useCallback((e) => {
    const canvas = sagittalCanvasRef.current
    if (!canvas || !isLoaded || imageDataCache.length === 0) return

    const rect = canvas.getBoundingClientRect()
    const canvasX = e.clientX - rect.left
    const canvasY = e.clientY - rect.top

    const firstImage = imageDataCache[0]
    const rows = firstImage.rows
    const sliceCount = imageDataCache.length

    const scaleX = canvas.width / rows
    const scaleY = canvas.height / sliceCount

    const pixelY = Math.floor(canvasX / scaleX)
    const sliceIdx = Math.min(Math.floor(canvasY / scaleY), sliceCount - 1)

    setCrosshair({ x: coronalIndex, y: pixelY, z: sliceIdx })
    setCoronalIndex(coronalIndex)
    setAxialIndex(sliceIdx)
    setCoordinates({ x: coronalIndex, y: pixelY, z: sliceIdx })

    if (imageDataCache[sliceIdx]) {
      const hu = getPixelValue(imageDataCache[sliceIdx], coronalIndex, pixelY)
      setHuValue(Math.round(hu))
    }

    if (axialRef.current && imageDataCache[sliceIdx]) {
      try {
        cornerstone.displayImage(axialRef.current, imageDataCache[sliceIdx])
        if (onIndexChange) {
          onIndexChange(sliceIdx)
        }
      } catch (e) {}
    }
  }, [isLoaded, imageDataCache, coronalIndex, getPixelValue, onIndexChange])

  const handleWheel = useCallback((e, viewType) => {
    e.preventDefault()
    e.stopPropagation()

    if (!isLoaded || imageDataCache.length === 0) return

    const delta = e.deltaY > 0 ? 1 : -1

    if (viewType === 'axial') {
      const newIndex = Math.max(0, Math.min(imageDataCache.length - 1, axialIndex + delta))
      setAxialIndex(newIndex)
      setCrosshair(prev => ({ ...prev, z: newIndex }))
      if (axialRef.current && imageDataCache[newIndex]) {
        try {
          cornerstone.displayImage(axialRef.current, imageDataCache[newIndex])
          if (onIndexChange) {
            onIndexChange(newIndex)
          }
        } catch (e) {}
      }
    } else if (viewType === 'coronal') {
      const firstImage = imageDataCache[0]
      const newIndex = Math.max(0, Math.min(firstImage.columns - 1, coronalIndex + delta))
      setCoronalIndex(newIndex)
      setCrosshair(prev => ({ ...prev, x: newIndex }))
    } else if (viewType === 'sagittal') {
      const firstImage = imageDataCache[0]
      const newIndex = Math.max(0, Math.min(firstImage.rows - 1, sagittalIndex + delta))
      setSagittalIndex(newIndex)
      setCrosshair(prev => ({ ...prev, y: newIndex }))
    }
  }, [isLoaded, imageDataCache, axialIndex, coronalIndex, sagittalIndex, onIndexChange])

  const handleMouseDown = useCallback((e, viewType) => {
    isDraggingRef.current = true
    dragStartRef.current = { x: e.clientX, y: e.clientY }
    dragViewRef.current = viewType

    if (e.button === 0) {
      dragTypeRef.current = 'wwwc'
    } else if (e.button === 1 || e.button === 2) {
      dragTypeRef.current = 'pan'
    }
  }, [])

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false
    dragTypeRef.current = null
    dragViewRef.current = null
  }, [])

  const handleMouseDrag = useCallback((e) => {
    if (!isDraggingRef.current || !dragTypeRef.current || !dragViewRef.current) return

    const dx = e.clientX - dragStartRef.current.x
    const dy = e.clientY - dragStartRef.current.y
    dragStartRef.current = { x: e.clientX, y: e.clientY }

    const viewType = dragViewRef.current
    const dragType = dragTypeRef.current

    if (dragType === 'wwwc') {
      const wlDelta = {
        windowCenter: dx * 2,
        windowWidth: dy * 2,
      }

      if (viewType === 'axial') {
        if (axialRef.current) {
          try {
            const viewport = cornerstone.getViewport(axialRef.current)
            viewport.voi.windowCenter += wlDelta.windowCenter
            viewport.voi.windowWidth = Math.max(1, viewport.voi.windowWidth + wlDelta.windowWidth)
            cornerstone.setViewport(axialRef.current, viewport)
            setAxialWL({
              windowCenter: viewport.voi.windowCenter,
              windowWidth: viewport.voi.windowWidth,
            })
          } catch (e) {}
        }
      } else if (viewType === 'coronal') {
        setCoronalWL(prev => ({
          windowCenter: prev.windowCenter + wlDelta.windowCenter,
          windowWidth: Math.max(1, prev.windowWidth + wlDelta.windowWidth),
        }))
      } else if (viewType === 'sagittal') {
        setSagittalWL(prev => ({
          windowCenter: prev.windowCenter + wlDelta.windowCenter,
          windowWidth: Math.max(1, prev.windowWidth + wlDelta.windowWidth),
        }))
      }
    }
  }, [])

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseDrag)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseDrag)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [handleMouseDrag, handleMouseUp])

  const applyWLPreset = useCallback((preset, viewType) => {
    if (preset.name === '默认') {
      const defaultWL = { windowCenter: 40, windowWidth: 400 }
      if (viewType === 'axial') {
        setAxialWL(defaultWL)
        if (axialRef.current) {
          try {
            const viewport = cornerstone.getViewport(axialRef.current)
            viewport.voi.windowCenter = defaultWL.windowCenter
            viewport.voi.windowWidth = defaultWL.windowWidth
            cornerstone.setViewport(axialRef.current, viewport)
          } catch (e) {}
        }
      } else if (viewType === 'coronal') {
        setCoronalWL(defaultWL)
      } else if (viewType === 'sagittal') {
        setSagittalWL(defaultWL)
      }
    } else {
      if (viewType === 'axial') {
        setAxialWL({ windowCenter: preset.windowCenter, windowWidth: preset.windowWidth })
        if (axialRef.current) {
          try {
            const viewport = cornerstone.getViewport(axialRef.current)
            viewport.voi.windowCenter = preset.windowCenter
            viewport.voi.windowWidth = preset.windowWidth
            cornerstone.setViewport(axialRef.current, viewport)
          } catch (e) {}
        }
      } else if (viewType === 'coronal') {
        setCoronalWL({ windowCenter: preset.windowCenter, windowWidth: preset.windowWidth })
      } else if (viewType === 'sagittal') {
        setSagittalWL({ windowCenter: preset.windowCenter, windowWidth: preset.windowWidth })
      }
    }
  }, [])

  const viewContainerStyle = {
    position: 'relative',
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
    overflow: 'hidden',
    border: '1px solid #333',
    boxSizing: 'border-box',
  }

  const canvasStyle = {
    width: '100%',
    height: '100%',
    display: 'block',
    cursor: 'crosshair',
  }

  const viewLabelStyle = {
    position: 'absolute',
    top: '8px',
    left: '8px',
    color: '#00ff00',
    fontSize: '12px',
    fontWeight: 'bold',
    textShadow: '1px 1px 2px #000',
    zIndex: 10,
    pointerEvents: 'none',
  }

  const wlInfoStyle = {
    position: 'absolute',
    bottom: '8px',
    left: '8px',
    color: '#00ff00',
    fontSize: '11px',
    textShadow: '1px 1px 2px #000',
    zIndex: 10,
    pointerEvents: 'none',
  }

  const infoPanelStyle = {
    width: '100%',
    height: '100%',
    backgroundColor: '#111',
    color: '#0f0',
    padding: '12px',
    boxSizing: 'border-box',
    border: '1px solid #333',
    fontSize: '12px',
    overflow: 'auto',
  }

  const infoRowStyle = {
    marginBottom: '8px',
    display: 'flex',
    justifyContent: 'space-between',
  }

  const infoLabelStyle = {
    color: '#888',
  }

  const infoValueStyle = {
    color: '#0f0',
    fontFamily: 'monospace',
  }

  const wlPresetButtonStyle = {
    background: 'transparent',
    border: '1px solid #333',
    color: '#0f0',
    padding: '2px 6px',
    margin: '2px',
    cursor: 'pointer',
    fontSize: '10px',
    borderRadius: '2px',
  }

  const wlPresetsContainerStyle = {
    position: 'absolute',
    top: '8px',
    right: '8px',
    zIndex: 10,
    display: 'flex',
    flexWrap: 'wrap',
    maxWidth: '120px',
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: '1fr 1fr',
        gap: '2px',
        width: '100%',
        height: '100%',
        backgroundColor: '#000',
      }}
    >
      <div style={viewContainerStyle}>
        <div style={viewLabelStyle}>轴位 Axial ({axialIndex + 1}/{imageDataCache.length})</div>
        <div style={wlPresetsContainerStyle}>
          {WL_PRESETS.slice(0, 3).map((preset) => (
            <button
              key={preset.name}
              style={wlPresetButtonStyle}
              onClick={() => applyWLPreset(preset, 'axial')}
            >
              {preset.name}
            </button>
          ))}
        </div>
        <div
          ref={axialRef}
          style={{
            ...canvasStyle,
            width: '100%',
            height: '100%',
            position: 'relative',
          }}
          onMouseMove={handleAxialMouseMove}
          onWheel={(e) => handleWheel(e, 'axial')}
          onMouseDown={(e) => handleMouseDown(e, 'axial')}
          onContextMenu={(e) => e.preventDefault()}
        />
        <div style={wlInfoStyle}>
          WL: {Math.round(axialWL.windowCenter)}/{Math.round(axialWL.windowWidth)}
        </div>
      </div>

      <div style={viewContainerStyle}>
        <div style={viewLabelStyle}>冠位 Coronal ({coronalIndex})</div>
        <div style={wlPresetsContainerStyle}>
          {WL_PRESETS.slice(0, 3).map((preset) => (
            <button
              key={preset.name}
              style={wlPresetButtonStyle}
              onClick={() => applyWLPreset(preset, 'coronal')}
            >
              {preset.name}
            </button>
          ))}
        </div>
        <canvas
          ref={coronalCanvasRef}
          width={512}
          height={512}
          style={canvasStyle}
          onMouseMove={handleCoronalMouseMove}
          onWheel={(e) => handleWheel(e, 'coronal')}
          onMouseDown={(e) => handleMouseDown(e, 'coronal')}
          onContextMenu={(e) => e.preventDefault()}
        />
        <div style={wlInfoStyle}>
          WL: {Math.round(coronalWL.windowCenter)}/{Math.round(coronalWL.windowWidth)}
        </div>
      </div>

      <div style={viewContainerStyle}>
        <div style={viewLabelStyle}>矢位 Sagittal ({sagittalIndex})</div>
        <div style={wlPresetsContainerStyle}>
          {WL_PRESETS.slice(0, 3).map((preset) => (
            <button
              key={preset.name}
              style={wlPresetButtonStyle}
              onClick={() => applyWLPreset(preset, 'sagittal')}
            >
              {preset.name}
            </button>
          ))}
        </div>
        <canvas
          ref={sagittalCanvasRef}
          width={512}
          height={512}
          style={canvasStyle}
          onMouseMove={handleSagittalMouseMove}
          onWheel={(e) => handleWheel(e, 'sagittal')}
          onMouseDown={(e) => handleMouseDown(e, 'sagittal')}
          onContextMenu={(e) => e.preventDefault()}
        />
        <div style={wlInfoStyle}>
          WL: {Math.round(sagittalWL.windowCenter)}/{Math.round(sagittalWL.windowWidth)}
        </div>
      </div>

      <div style={infoPanelStyle}>
        <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px', color: '#0f0' }}>
          MPR 信息面板
        </div>

        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '6px', color: '#aaa' }}>三维坐标</div>
          <div style={infoRowStyle}>
            <span style={infoLabelStyle}>X (冠状):</span>
            <span style={infoValueStyle}>{coordinates.x}</span>
          </div>
          <div style={infoRowStyle}>
            <span style={infoLabelStyle}>Y (矢状):</span>
            <span style={infoValueStyle}>{coordinates.y}</span>
          </div>
          <div style={infoRowStyle}>
            <span style={infoLabelStyle}>Z (轴位):</span>
            <span style={infoValueStyle}>{coordinates.z}</span>
          </div>
        </div>

        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '6px', color: '#aaa' }}>HU 值</div>
          <div style={infoRowStyle}>
            <span style={infoLabelStyle}>当前像素:</span>
            <span style={infoValueStyle}>{huValue !== null ? huValue : '--'}</span>
          </div>
        </div>

        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '6px', color: '#aaa' }}>图像信息</div>
          <div style={infoRowStyle}>
            <span style={infoLabelStyle}>列数:</span>
            <span style={infoValueStyle}>{imageInfo.columns}</span>
          </div>
          <div style={infoRowStyle}>
            <span style={infoLabelStyle}>行数:</span>
            <span style={infoValueStyle}>{imageInfo.rows}</span>
          </div>
          <div style={infoRowStyle}>
            <span style={infoLabelStyle}>层数:</span>
            <span style={infoValueStyle}>{imageInfo.sliceCount}</span>
          </div>
        </div>

        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '6px', color: '#aaa' }}>操作说明</div>
          <div style={{ fontSize: '11px', color: '#666', lineHeight: '1.6' }}>
            <div>• 鼠标移动: 十字线定位</div>
            <div>• 滚轮: 切换切片</div>
            <div>• 左键拖拽: 调窗 (WL/WW)</div>
            <div>• 右键拖拽: 平移</div>
          </div>
        </div>

        {!isLoaded && (
          <div style={{ textAlign: 'center', color: '#666', marginTop: '20px' }}>
            加载中...
          </div>
        )}
      </div>
    </div>
  )
}

export default MPRViewer
