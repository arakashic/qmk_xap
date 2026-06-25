import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => ({
  root: path.resolve(__dirname),
  plugins: [react()],
  // Force `import.meta.env.VITE_MOCK` to a falsy literal at build time when the
  // flag is unset, so Rollup dead-code-eliminates the gated dynamic import and
  // the mock client never ships in default/debug/release bundles. When
  // VITE_MOCK is set (build:react:mock) Vite's own env replacement makes it
  // truthy, so we skip the override. Omitted for serve/test so import.meta.env
  // stays a live object that vi.stubEnv can toggle per test.
  define:
    command === 'build' && !process.env.VITE_MOCK
      ? { 'import.meta.env.VITE_MOCK': '""' }
      : undefined,
  css: {
    // Explicitly point to src-react's own postcss config so the root
    // postcss.config.js (Vue stack) is not picked up.
    postcss: path.resolve(__dirname, 'postcss.config.cjs'),
  },
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
}))
