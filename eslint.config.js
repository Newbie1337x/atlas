// @ts-check
import tseslint from 'typescript-eslint';
import angular from 'angular-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', '.angular/**', 'node_modules/**', 'coverage/**', 'ios/**', 'android/**'],
  },

  // TypeScript files — strict type-checked config + our overrides
  {
    files: ['**/*.ts'],
    extends: [
      ...tseslint.configs.recommendedTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      '@angular-eslint': angular.tsPlugin,
    },
    rules: {
      // Baseline overrides — we let some strict rules WARN not error
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/restrict-template-expressions': 'off',

      // Rules that catch real bugs in signals + rxjs + async code
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/require-await': 'warn',

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
              'Direct HttpClient use bypasses the auth + tenant + error-transform interceptors. See ARCHITECTURE.md §5.',
          },
        ],
      }],
    },
  },

  // Core is exempt from HttpClient block — the only place allowed to build it
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
);
