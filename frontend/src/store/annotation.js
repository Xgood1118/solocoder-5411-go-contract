import { create } from 'zustand'
import api from '../services/api'
import { ANNOTATION_TYPE_MAP } from '../utils/cornerstone'

export const useAnnotationStore = create((set, get) => ({
  annotations: [],
  loading: false,
  selectedAnnotation: null,
  historyAnnotations: [],

  fetchAnnotations: async (imageUid) => {
    set({ loading: true })
    try {
      const res = await api.get(`/annotations/image/${imageUid}`)
      set({ annotations: res.data || [] })
    } catch (e) {
      console.error('获取标注失败:', e)
    } finally {
      set({ loading: false })
    }
  },

  fetchHistory: async (imageUid) => {
    try {
      const res = await api.get(`/annotations/history/image/${imageUid}`)
      set({ historyAnnotations: res.data || [] })
    } catch (e) {
      console.error('获取历史标注失败:', e)
    }
  },

  createAnnotation: async (imageUid, toolName, points, category, label) => {
    try {
      const annotationType = ANNOTATION_TYPE_MAP[toolName] || 'rectangle'

      const payload = {
        image_uid: imageUid,
        annotation_type: annotationType,
        category: category || null,
        label: label || null,
        points: points.map((p) => ({ x: p.x, y: p.y })),
      }

      const res = await api.post('/annotations', payload)
      set((state) => ({
        annotations: [...state.annotations, res.data],
      }))
      return { success: true, data: res.data }
    } catch (e) {
      return {
        success: false,
        message: e.response?.data?.detail || '创建标注失败',
      }
    }
  },

  updateAnnotation: async (annotationId, updates) => {
    try {
      const res = await api.put(`/annotations/${annotationId}`, updates)
      set((state) => ({
        annotations: state.annotations.map((a) =>
          a.annotation_id === annotationId ? { ...a, ...res.data } : a
        ),
      }))
      return { success: true }
    } catch (e) {
      return { success: false, message: e.response?.data?.detail }
    }
  },

  deleteAnnotation: async (annotationId) => {
    try {
      await api.delete(`/annotations/${annotationId}`)
      set((state) => ({
        annotations: state.annotations.filter((a) => a.annotation_id !== annotationId),
      }))
      return { success: true }
    } catch (e) {
      return { success: false, message: e.response?.data?.detail }
    }
  },

  acceptAnnotation: async (annotationId) => {
    try {
      const res = await api.post(`/annotations/${annotationId}/accept`)
      set((state) => ({
        annotations: state.annotations.map((a) =>
          a.annotation_id === annotationId ? { ...a, ...res.data } : a
        ),
      }))
      return { success: true }
    } catch (e) {
      return { success: false, message: e.response?.data?.detail }
    }
  },

  rejectAnnotation: async (annotationId, comment) => {
    try {
      const res = await api.post(`/annotations/${annotationId}/reject`, { comment })
      set((state) => ({
        annotations: state.annotations.filter((a) => a.annotation_id !== annotationId),
        historyAnnotations: [
          ...state.historyAnnotations,
          { ...res.data, status: 'rejected' },
        ],
      }))
      return { success: true }
    } catch (e) {
      return { success: false, message: e.response?.data?.detail }
    }
  },

  setSelectedAnnotation: (annotation) => {
    set({ selectedAnnotation: annotation })
  },

  clearAnnotations: () => {
    set({
      annotations: [],
      selectedAnnotation: null,
      historyAnnotations: [],
    })
  },
}))
