/// <reference types="vitest/config" />
// Vite config with the Vitest settings in the same file (Vitest reads vite.config.ts).
// Existing vite.config.ts? Add the reference line above and the `test` block below to it.
// Install: npm i -D vitest jsdom msw @testing-library/vue @testing-library/user-event @testing-library/jest-dom @vue/test-utils
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
  },
})
