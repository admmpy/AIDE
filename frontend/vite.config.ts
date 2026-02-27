import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    include: ['src/__tests__/**/*.test.ts', 'src/__tests__/**/*.test.tsx'],
    exclude: ['src/__tests__/**/*.browser.test.tsx'],
  },
})
