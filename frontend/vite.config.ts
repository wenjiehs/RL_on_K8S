import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
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