import { useCallback, useRef } from 'react'

const useImageExport = (canvasRef, options = {}) => {
  const {
    includeAnnotations = true,
    includeWatermark = true,
    patientInfo = {},
  } = options

  const tempCanvasRef = useRef(null)

  const drawWatermark = useCallback((ctx, width, height) => {
    const {
      patientName = '未知患者',
      studyDate = '',
      seriesDescription = '',
    } = patientInfo

    const now = new Date()
    const exportTime = now.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })

    const watermarkLines = [
      `患者: ${patientName}`,
      studyDate ? `检查日期: ${studyDate}` : '',
      seriesDescription ? `序列: ${seriesDescription}` : '',
      `导出时间: ${exportTime}`,
    ].filter(Boolean)

    const fontSize = 14
    const lineHeight = fontSize + 6
    const padding = 12
    const textWidth = Math.max(...watermarkLines.map((line) => ctx.measureText(line).width))
    const boxWidth = textWidth + padding * 2
    const boxHeight = watermarkLines.length * lineHeight + padding * 2
    const boxX = width - boxWidth - 10
    const boxY = height - boxHeight - 10

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
    ctx.fillRect(boxX, boxY, boxWidth, boxHeight)

    ctx.font = `${fontSize}px Arial, sans-serif`
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
    ctx.textBaseline = 'top'

    watermarkLines.forEach((line, index) => {
      ctx.fillText(line, boxX + padding, boxY + padding + index * lineHeight)
    })
  }, [patientInfo])

  const createExportCanvas = useCallback(() => {
    if (!canvasRef?.current) return null

    const sourceCanvas = canvasRef.current
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = sourceCanvas.width
    tempCanvas.height = sourceCanvas.height
    tempCanvasRef.current = tempCanvas

    const ctx = tempCanvas.getContext('2d')
    ctx.drawImage(sourceCanvas, 0, 0)

    if (includeWatermark) {
      drawWatermark(ctx, tempCanvas.width, tempCanvas.height)
    }

    return tempCanvas
  }, [canvasRef, includeWatermark, drawWatermark])

  const triggerDownload = useCallback((dataUrl, filename) => {
    const link = document.createElement('a')
    link.download = filename
    link.href = dataUrl
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [])

  const generateFilename = useCallback((extension) => {
    const { patientName = '患者' } = patientInfo
    const now = new Date()
    const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`
    return `${patientName}_${timestamp}.${extension}`
  }, [patientInfo])

  const exportPNG = useCallback(() => {
    const exportCanvas = createExportCanvas()
    if (!exportCanvas) return

    const dataUrl = exportCanvas.toDataURL('image/png')
    const filename = generateFilename('png')
    triggerDownload(dataUrl, filename)
  }, [createExportCanvas, generateFilename, triggerDownload])

  const exportJPEG = useCallback((quality = 0.92) => {
    const exportCanvas = createExportCanvas()
    if (!exportCanvas) return

    const dataUrl = exportCanvas.toDataURL('image/jpeg', quality)
    const filename = generateFilename('jpg')
    triggerDownload(dataUrl, filename)
  }, [createExportCanvas, generateFilename, triggerDownload])

  return {
    exportPNG,
    exportJPEG,
  }
}

export default useImageExport
