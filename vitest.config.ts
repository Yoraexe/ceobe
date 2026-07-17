// Tujuan: Mengonfigurasi vitest untuk menjalankan unit testing dan menetapkan batas minimum cakupan kode (coverage threshold) sebesar 80%.
// Caller: Dijalankan oleh npm run test / developer CLI.
// Dependensi: vitest/config, path
// Main Functions: default export defineConfig
// Side Effects: Tidak ada.

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'scripts/**', 
        'src/index.ts', 
        'dist/**', 
        '**/*.test.ts'
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
});
