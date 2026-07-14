import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

export default defineConfig({
  plugins: [uni()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/static/images': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/static/avatars': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
