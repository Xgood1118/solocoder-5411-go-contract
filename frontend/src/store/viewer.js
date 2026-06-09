import { create } from 'zustand'
import api from '../services/api'

export const useViewerStore = create((set, get) => ({
  studyUid: null,
  studyInfo: null,
  seriesList: [],
  currentSeriesUid: null,
  imageList: [],
  currentImageIndex: 0,
  currentImageUid: null,
  currentTool: 'Wwwc',
  viewMode: 'single',

  lockInfo: null,
  isReadOnly: false,

  isRecording: false,
  isPageHidden: false,

  setStudy: (studyUid, studyInfo) => {
    set({ studyUid, studyInfo })
  },

  setSeriesList: (seriesList) => {
    set({ seriesList })
  },

  setCurrentSeries: (seriesUid) => {
    set({ currentSeriesUid: seriesUid, currentImageIndex: 0, currentImageUid: null })
  },

  setImageList: (imageList) => {
    set({ imageList })
    if (imageList.length > 0) {
      set({
        currentImageIndex: 0,
        currentImageUid: imageList[0].image_uid,
      })
    }
  },

  setCurrentImageIndex: (index) => {
    const { imageList } = get()
    if (index >= 0 && index < imageList.length) {
      set({
        currentImageIndex: index,
        currentImageUid: imageList[index].image_uid,
      })
    }
  },

  nextImage: () => {
    const { currentImageIndex, imageList } = get()
    if (currentImageIndex < imageList.length - 1) {
      get().setCurrentImageIndex(currentImageIndex + 1)
    }
  },

  prevImage: () => {
    const { currentImageIndex } = get()
    if (currentImageIndex > 0) {
      get().setCurrentImageIndex(currentImageIndex - 1)
    }
  },

  setCurrentTool: (tool) => {
    set({ currentTool: tool })
  },

  setViewMode: (mode) => {
    set({ viewMode: mode })
  },

  setLockInfo: (lockInfo) => {
    set({ lockInfo })
  },

  setIsReadOnly: (isReadOnly) => {
    set({ isReadOnly })
  },

  setIsRecording: (isRecording) => {
    set({ isRecording })
  },

  setIsPageHidden: (isPageHidden) => {
    set({ isPageHidden })
  },

  getCurrentImageInfo: () => {
    const { imageList, currentImageIndex } = get()
    return imageList[currentImageIndex] || null
  },

  getCurrentSeriesInfo: () => {
    const { seriesList, currentSeriesUid } = get()
    return seriesList.find((s) => s.series_uid === currentSeriesUid) || null
  },

  fetchLockInfo: async (imageUid) => {
    try {
      const res = await api.get(`/images/${imageUid}/lock`)
      set({ lockInfo: res.data })
      return res.data
    } catch (e) {
      console.warn('获取锁状态失败:', e)
      return null
    }
  },

  acquireLock: async (imageUid) => {
    try {
      const res = await api.post(`/images/${imageUid}/lock`)
      set({ lockInfo: res.data })
      return { success: true, ...res.data }
    } catch (e) {
      if (e.response?.status === 409) {
        await get().fetchLockInfo(imageUid)
      }
      return { success: false, message: e.response?.data?.detail }
    }
  },

  releaseLock: async (imageUid) => {
    try {
      await api.post(`/images/${imageUid}/unlock`)
      set({ lockInfo: null })
      return { success: true }
    } catch (e) {
      return { success: false, message: e.response?.data?.detail }
    }
  },
}))
