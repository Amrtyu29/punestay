import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Lets both front ends call /api/... and reach the FastAPI server without CORS trouble.
const apiProxy = {
  '/api': {
    target: process.env.VITE_API_URL || 'http://localhost:8000',
    changeOrigin: true,
    rewrite: (p) => p.replace(/^\/api/, ''),
  },
  // Listing photos are served by the API at /uploads/...; online the API serves the pages too, so same origin.
  '/uploads': { target: process.env.VITE_API_URL || 'http://localhost:8000', changeOrigin: true },
}

export default defineConfig({
  plugins: [react()],
  // Two pages: the PuneStay home page (plain HTML/CSS/JS) at /, the React app at /app/.
  build: { rollupOptions: { input: { home: 'index.html', app: 'app/index.html' } } },
  server: { port: 5173, proxy: apiProxy },
  // `npm run preview` serves the built dist with the same /api proxy (http://localhost:4173).
  preview: { port: 4173, proxy: apiProxy },
})
