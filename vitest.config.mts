import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

const dirname = import.meta.dirname

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve(dirname, 'shared'),
      '@': resolve(dirname, 'src')
    }
  },
  test: {
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    environment: 'node',
    // globals:true lets @testing-library/react register its automatic DOM
    // cleanup between tests (it hooks the global afterEach).
    globals: true,
    // Component tests need a DOM: they declare `@vitest-environment jsdom`
    // (environmentMatchGlobs was removed in Vitest 5).
    setupFiles: ['tests/setup.ts']
  }
})
