/**
 * @file .eslintrc.cjs
 * @author Dante Loi
 * @date 2026-05-14
 * @brief ESLint configuration for FidoCadJS
 * @copyright Copyright 2026 Dante Loi - GPL v3
 */

module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  rules: {
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
    'no-console': 'off',
    'prefer-const': 'warn',
  },
  ignorePatterns: ['dist/', 'node_modules/', 'coverage/', 'test/e2e/report/'],
};
