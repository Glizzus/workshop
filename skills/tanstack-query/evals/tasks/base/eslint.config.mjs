// ESLint flat config for Vue + TypeScript with the official TanStack Query plugin.
// Install: npm i -D eslint typescript-eslint eslint-plugin-vue @tanstack/eslint-plugin-query
//
// Already have an eslint.config? Add only the two marked blocks (A and B) to it.
// The plugin's no-void-query-fn rule needs type information (the projectService block).
import { defineConfig } from 'eslint/config'
import pluginQuery from '@tanstack/eslint-plugin-query'
import pluginVue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'

export default defineConfig(
  { ignores: ['dist/**', 'coverage/**', '.agents/**', '.claude/**'] }, // also skip agent skill folders
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/essential'],
  {
    files: ['**/*.{ts,mts,vue}'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser, // lets eslint-plugin-vue parse <script lang="ts">
        projectService: true, // type information, needed by no-void-query-fn and no-floating-promises
        tsconfigRootDir: import.meta.dirname,
        extraFileExtensions: ['.vue'],
      },
    },
  },
  // (A) TanStack Query rules, strict preset (includes prefer-query-options)
  ...pluginQuery.configs['flat/recommended-strict'],
  // (B) Adjustments for Vue
  {
    rules: {
      // Its warning is about React re-renders; rest-destructuring a Vue Query result is harmless
      '@tanstack/query/no-rest-destructuring': 'off',
      // Catches un-awaited mutateAsync() and other floating promises
      '@typescript-eslint/no-floating-promises': 'error',
    },
  },
  {
    files: ['eslint.config.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
  },
)
