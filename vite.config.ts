import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    // Dev: encaminha /api/* para o BFF (bun run server/server.ts)
    proxy: {
      '/api': `http://localhost:${process.env.CHAT_PORT || 3335}`,
    },
  },
})
