// @ts-check
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import angular from 'angular-eslint';

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: ['dist/**', '.angular/**', 'node_modules/**', 'coverage/**', 'ios/**', 'android/**'],
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      '@angular-eslint': angular.tsPlugin,
    },
    rules: {
      // Baseline TS rules
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'off',

      // Angular naming
      '@angular-eslint/directive-selector': ['error', { type: 'attribute', prefix: 'app', style: 'camelCase' }],
      '@angular-eslint/component-selector': ['error', { type: 'element', prefix: ['app', 'page'], style: 'kebab-case' }],

      // Architectural boundaries — see ARCHITECTURE.md §1
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['@features/*/*'],
            message:
              'Cross-feature imports are forbidden. features/foo cannot import features/bar. ' +
              'Move the shared piece to @shared/* (UI) or @core/* (infra). See ARCHITECTURE.md §1.',
          },
          {
            group: ['**/environments/*'],
            message: 'Import environment via the @env alias, never via a deep path.',
          },
          {
            group: ['@angular/common/http'],
            importNames: ['HttpClient'],
            message:
              'Features MUST call the API via @core/api/ApiClient (or @core/auth/AuthApi for auth endpoints). ' +
              'Direct HttpClient use bypasses the auth + tenant interceptor. See ARCHITECTURE.md §5.',
          },
        ],
      }],
    },
  },
  // Core is the one place allowed to construct HttpClient
  {
    files: ['src/app/core/**/*.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  // Angular templates
  {
    files: ['**/*.html'],
    languageOptions: {
      parser: angular.templateParser,
    },
    plugins: {
      '@angular-eslint/template': angular.templatePlugin,
    },
    rules: {
      '@angular-eslint/template/no-inline-styles': 'error',
      '@angular-eslint/template/alt-text': 'error',
    },
  },
];
