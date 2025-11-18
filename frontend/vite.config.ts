import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
  },
  css: {
    preprocessorOptions: {
      less: {
        modifyVars: {
          '@brand-color': '#1976D2', // 主题色
        },
        javascriptEnabled: true,
      },
    },
  },
})