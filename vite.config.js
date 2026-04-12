import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'https://techiohisab.com',
        changeOrigin: true,
        secure: true,
        headers: {
          origin: 'https://techiohisab.com',
          referer: 'https://techiohisab.com/',
        },
      },
    },
  },
})
