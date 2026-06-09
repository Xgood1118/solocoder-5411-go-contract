import * as cornerstone from 'cornerstone-core'
import * as cornerstoneTools from 'cornerstone-tools'
import * as cornerstoneMath from 'cornerstone-math'
import * as cornerstoneWADOImageLoader from 'cornerstone-wado-image-loader'
import dicomParser from 'dicom-parser'
import Hammer from 'hammerjs'

let initialized = false

export const initCornerstone = () => {
  if (initialized) return

  cornerstoneTools.external.cornerstone = cornerstone
  cornerstoneTools.external.cornerstoneMath = cornerstoneMath
  cornerstoneTools.external.Hammer = Hammer

  cornerstoneWADOImageLoader.external.cornerstone = cornerstone
  cornerstoneWADOImageLoader.external.dicomParser = dicomParser

  cornerstoneWADOImageLoader.configure({
    beforeSend: function (xhr) {
      const token = localStorage.getItem('token')
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`)
      }
    },
  })

  cornerstoneTools.init({
    showSVGCursors: true,
  })

  const WwwcTool = cornerstoneTools.WwwcTool
  const PanTool = cornerstoneTools.PanTool
  const ZoomTool = cornerstoneTools.ZoomTool
  const LengthTool = cornerstoneTools.LengthTool
  const EllipticalRoiTool = cornerstoneTools.EllipticalRoiTool
  const AngleTool = cornerstoneTools.AngleTool
  const RectangleRoiTool = cornerstoneTools.RectangleRoiTool
  const ArrowAnnotateTool = cornerstoneTools.ArrowAnnotateTool
  const FreehandRoiTool = cornerstoneTools.FreehandRoiTool
  const CrosshairsTool = cornerstoneTools.CrosshairsTool
  const StackScrollMouseWheelTool = cornerstoneTools.StackScrollMouseWheelTool

  cornerstoneTools.addTool(WwwcTool)
  cornerstoneTools.addTool(PanTool)
  cornerstoneTools.addTool(ZoomTool)
  cornerstoneTools.addTool(LengthTool)
  cornerstoneTools.addTool(EllipticalRoiTool)
  cornerstoneTools.addTool(AngleTool)
  cornerstoneTools.addTool(RectangleRoiTool)
  cornerstoneTools.addTool(ArrowAnnotateTool)
  cornerstoneTools.addTool(FreehandRoiTool)
  cornerstoneTools.addTool(CrosshairsTool)
  cornerstoneTools.addTool(StackScrollMouseWheelTool)

  cornerstoneTools.setToolActive('Wwwc', { mouseButtonMask: 1 })
  cornerstoneTools.setToolActive('Pan', { mouseButtonMask: 2 })
  cornerstoneTools.setToolActive('Zoom', { mouseButtonMask: 4 })
  cornerstoneTools.setToolActive('StackScrollMouseWheel', {})

  initialized = true
}

export const WL_PRESETS = [
  { name: '肺窗', windowCenter: -600, windowWidth: 1500 },
  { name: '纵隔窗', windowCenter: 40, windowWidth: 400 },
  { name: '骨窗', windowCenter: 300, windowWidth: 2500 },
  { name: '脑窗', windowCenter: 35, windowWidth: 80 },
  { name: '软组织窗', windowCenter: 50, windowWidth: 350 },
  { name: '腹部窗', windowCenter: 40, windowWidth: 400 },
  { name: '脊柱窗', windowCenter: 200, windowWidth: 1500 },
  { name: '默认', windowCenter: 0, windowWidth: 0 },
]

export const ANNOTATION_CATEGORIES = [
  { value: '结节', label: '结节', color: '#f5222d' },
  { value: '肿块', label: '肿块', color: '#fa8c16' },
  { value: '钙化', label: '钙化', color: '#722ed1' },
  { value: '可疑淋巴', label: '可疑淋巴', color: '#13c2c2' },
]

export const TOOL_LIST = [
  { key: 'Wwwc', name: '调窗', icon: '🎯', type: 'navigation' },
  { key: 'Pan', name: '平移', icon: '✋', type: 'navigation' },
  { key: 'Zoom', name: '缩放', icon: '🔍', type: 'navigation' },
  { key: 'Length', name: '直线测量', icon: '📏', type: 'measurement' },
  { key: 'EllipticalRoi', name: '椭圆面积', icon: '⭕', type: 'measurement' },
  { key: 'RectangleRoi', name: '矩形标注', icon: '⬜', type: 'annotation', annotationType: 'rectangle' },
  { key: 'Angle', name: '角度测量', icon: '📐', type: 'measurement' },
  { key: 'ArrowAnnotate', name: '箭头标注', icon: '➡️', type: 'annotation', annotationType: 'arrow' },
  { key: 'FreehandRoi', name: '自由曲线', icon: '✏️', type: 'annotation', annotationType: 'freehand' },
]

export const ANNOTATION_TYPE_MAP = {
  RectangleRoi: 'rectangle',
  EllipticalRoi: 'ellipse',
  ArrowAnnotate: 'arrow',
  FreehandRoi: 'freehand',
  Length: 'line',
  Angle: 'angle',
}

export const getCategoryColor = (category) => {
  const cat = ANNOTATION_CATEGORIES.find((c) => c.value === category)
  return cat?.color || '#1890ff'
}

export const pixelToCanvas = (element, x, y) => {
  const enabledElement = cornerstone.getEnabledElement(element)
  if (!enabledElement) return { x: 0, y: 0 }

  const viewport = cornerstone.getViewport(element)
  const { image } = enabledElement

  const canvasX = (x - image.column / 2) * viewport.scale + element.clientWidth / 2
  const canvasY = (y - image.row / 2) * viewport.scale + element.clientHeight / 2

  return { x: canvasX, y: canvasY }
}

export const canvasToPixel = (element, canvasX, canvasY) => {
  const enabledElement = cornerstone.getEnabledElement(element)
  if (!enabledElement) return { x: 0, y: 0 }

  const viewport = cornerstone.getViewport(element)
  const { image } = enabledElement

  const x = (canvasX - element.clientWidth / 2) / viewport.scale + image.column / 2
  const y = (canvasY - element.clientHeight / 2) / viewport.scale + image.row / 2

  return { x, y }
}

export default {
  initCornerstone,
  WL_PRESETS,
  ANNOTATION_CATEGORIES,
  TOOL_LIST,
  getCategoryColor,
  pixelToCanvas,
  canvasToPixel,
}
