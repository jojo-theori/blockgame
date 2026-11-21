import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // The bot worker loads its WebAssembly modules with dynamic imports.
  worker: { format: 'es' },
})
