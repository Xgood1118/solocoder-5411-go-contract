import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const port = parseInt(env.VITE_PORT || '5173')

  return {
    plugins: [react()],
    server: {
      port,
      proxy: {
        '/api': {
          target: env.VITE_API_BASE_URL || 'http://localhost:8000',
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
    },
    optimizeDeps: {
      include: [
        'cornerstone-core',
        'cornerstone-tools',
        'cornerstone-math',
        'cornerstone-wado-image-loader',
        'dicom-parser',
        'hammerjs',
      ],
    },
  }
})
