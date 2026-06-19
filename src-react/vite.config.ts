import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: path.resolve(__dirname),
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      // entity-type contract: the existing specta output. Re-pointed into
      // src-react at cutover (Plan 6).
      '@gen': path.resolve(__dirname, '../src/generated'),
    },
  },
  server: { port: 1430, strictPort: true },
  test: { environment: 'jsdom', setupFiles: ['./src/test-setup.ts'], globals: true },
})
