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
    environment: 'node'
  }
})
