import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiUrl = new URL(
    env.VITE_API_BASE_URL || 'http://localhost:5000/api'
  )

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: apiUrl.origin,
          changeOrigin: true,
          secure: true,
        },
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: './src/test/setup.js',
      clearMocks: true,
    },
  }
})
