import React, { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/auth'
import LoginPage from './pages/LoginPage'
import MainLayout from './layouts/MainLayout'
import StudyListPage from './pages/StudyListPage'
import ViewerPage from './pages/ViewerPage'
import AdminStatsPage from './pages/AdminStatsPage'

function App() {
  const { init, user, token } = useAuthStore()

  useEffect(() => {
    init()
  }, [])

  return (
    <Routes>
      <Route path="/login" element={
        token ? <Navigate to="/" replace /> : <LoginPage />
      } />

      <Route path="/" element={
        token ? <MainLayout /> : <Navigate to="/login" replace />
      }>
        <Route index element={<Navigate to="/studies" replace />} />
        <Route path="studies" element={<StudyListPage />} />
        <Route path="viewer/:studyUid" element={<ViewerPage />} />
        <Route path="viewer/:studyUid/:seriesUid" element={<ViewerPage />} />
        <Route path="viewer/:studyUid/:seriesUid/:imageUid" element={<ViewerPage />} />
        <Route path="admin/stats" element={<AdminStatsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
