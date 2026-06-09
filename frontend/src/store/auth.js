import { create } from 'zustand'
import api from '../services/api'

export const useAuthStore = create((set, get) => ({
  user: null,
  token: null,
  isLoading: false,

  init: () => {
    const token = localStorage.getItem('token')
    const userStr = localStorage.getItem('user')
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr)
        set({ token, user })
        get().fetchCurrentUser()
      } catch (e) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
      }
    }
  },

  fetchCurrentUser: async () => {
    try {
      const res = await api.get('/auth/me')
      set({ user: res.data })
      localStorage.setItem('user', JSON.stringify(res.data))
    } catch (e) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      set({ user: null, token: null })
    }
  },

  login: async (username, password) => {
    set({ isLoading: true })
    try {
      const formData = new FormData()
      formData.append('username', username)
      formData.append('password', password)

      const res = await api.post('/auth/login', formData)
      const { access_token } = res.data

      localStorage.setItem('token', access_token)
      set({ token: access_token })

      await get().fetchCurrentUser()
      return { success: true }
    } catch (e) {
      return {
        success: false,
        message: e.response?.data?.detail || '登录失败',
      }
    } finally {
      set({ isLoading: false })
    }
  },

  logout: () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    set({ user: null, token: null })
  },

  hasRole: (role) => {
    const user = get().user
    if (!user) return false
    if (Array.isArray(role)) return role.includes(user.role)
    return user.role === role
  },

  isAdmin: () => get().user?.role === 'admin',
  isReviewer: () => get().user?.role === 'reviewer' || get().user?.role === 'admin',
  isDoctor: () => get().user?.role === 'doctor' || get().isReviewer(),
}))
