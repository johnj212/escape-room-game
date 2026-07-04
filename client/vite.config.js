import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true
  },
  test: {
    // Vitest runs unit tests only; Playwright owns e2e/ (its test.describe
    // is incompatible with the vitest runner). See STATUS.md.
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**']
  }
})
