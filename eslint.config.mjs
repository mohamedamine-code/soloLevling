import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'

export default tseslint.config(
  {
    ignores: ['out/**', 'node_modules/**', 'dist/**', 'build/**']
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.cjs'],
    languageOptions: {
      globals: globals.node
    }
  },
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: globals.node
    }
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks
    },
    languageOptions: {
      globals: globals.browser
    },
    rules: {
      ...reactHooks.configs.recommended.rules
    }
  },
  {
    files: ['electron/**/*.ts'],
    languageOptions: {
      globals: globals.node
    }
  },
  {
    // TypeScript handles undefined globals; avoid no-undef false positives in TS sources.
    files: ['**/*.{ts,tsx}'],
    rules: {
      'no-undef': 'off'
    }
  }
)
