import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Same-origin proxy to the local IndicXlit server, so transliteration never
// depends on CORS or on which port Vite happened to pick.
const apiProxy = {
  '/transliterate': 'http://127.0.0.1:8000',
  '/health': 'http://127.0.0.1:8000',
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Pinned rather than auto-incrementing: a silent fallback to another port
  // leaves stale servers running and makes it unclear which build a tab loaded.
  server: { port: 5173, strictPort: true, proxy: apiProxy },
  preview: { port: 4173, strictPort: true, proxy: apiProxy },
})
