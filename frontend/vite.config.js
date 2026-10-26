import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Two pages: PuneStay Sonar (plain HTML/CSS/JS) at /, the React app at /app/.
  build: { rollupOptions: { input: { sonar: 'index.html', app: 'app/index.html' } } },
  server: {
    port: 5173,
    // Lets the frontend call /api/... and reach the FastAPI server without CORS trouble.
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
  },
})
