/**
 * @file eslint.config.js
 * @author Dante Loi
 * @date 2026-05-14
 * @brief ESLint flat configuration for FidoCadJS
 * @copyright Copyright 2026 Dante Loi - GPL v3
 *
 * Minimal config: catches real errors without drowning in style warnings.
 * Full clean-up of 'any' casts and naming happens in Phase 3.
 */

import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
    ...tseslint.configs.recommended,
    prettierConfig,
    {
        ignores: ['dist/', 'node_modules/', 'coverage/', 'test/e2e/report/', '*.js', '*.cjs'],
    },
    {
        rules: {
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            '@typescript-eslint/no-explicit-any': 'off', // cleaned in Phase 3
            'no-console': 'off',
            'prefer-const': 'warn',
        },
    },
);
