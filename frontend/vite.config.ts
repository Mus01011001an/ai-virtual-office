import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, host: true },
  build: {
    chunkSizeWarningLimit: 4000,
    // Dua halaman: office lama (/) dan Office Baru (/office-new/, docs/ai-office-architecture.md).
    rollupOptions: { input: { main: resolve(__dirname, 'index.html'), officeNew: resolve(__dirname, 'office-new/index.html') } },
  },
})
