import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const rootDir = dirname(fileURLToPath(import.meta.url));

/**
 * `eslint-config-next` (v15) masih berformat eslintrc. FlatCompat menjembatani
 * sampai Next merilis ekspor flat native. `baseDirectory` diarahkan ke `apps/web`
 * karena preset Next mengasumsikan root project adalah aplikasi Next itu sendiri.
 */
const nextCompat = new FlatCompat({
  baseDirectory: join(rootDir, 'apps/web'),
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

/** Aturan yang berlaku di semua paket TypeScript. */
const sharedTsRules = {
  // PRD Bab 10.10: DILARANG ada jalur eksekusi shell atau proses arbitrer.
  'no-restricted-imports': [
    'error',
    {
      paths: [
        {
          name: 'child_process',
          message:
            'Eksekusi proses arbitrer dilarang (PRD Bab 10.10). Gunakan command Tauri/Rust yang tervalidasi.',
        },
        {
          name: 'node:child_process',
          message:
            'Eksekusi proses arbitrer dilarang (PRD Bab 10.10). Gunakan command Tauri/Rust yang tervalidasi.',
        },
      ],
    },
  ],
  // `any` membatalkan jaminan TypeScript strict.
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/no-unused-vars': [
    'error',
    {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_',
      ignoreRestSiblings: true,
    },
  ],
  eqeqeq: ['error', 'always', { null: 'ignore' }],
  'no-console': ['warn', { allow: ['warn', 'error'] }],
};

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/build/**',
      '**/out/**',
      '**/coverage/**',
      '**/.turbo/**',
      '**/target/**',
      '**/next-env.d.ts',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: sharedTsRules,
  },

  // Preset Next hanya untuk aplikasi web: react-hooks, jsx-a11y, import resolver.
  // FlatCompat mengembalikan array config, jadi disebar langsung, bukan lewat `extends`.
  ...nextCompat.extends('next/core-web-vitals', 'next/typescript').map((config) => ({
    ...config,
    files: ['apps/web/**/*.{ts,tsx}'],
  })),

  // Skrip build & config Node: `console` wajar dipakai untuk melaporkan progres.
  {
    files: ['**/*.config.{ts,mts,js,mjs}', '**/seed.ts'],
    rules: { 'no-console': 'off' },
  },

  // Harus paling akhir: mematikan aturan yang bentrok dengan Prettier.
  prettier,
];
