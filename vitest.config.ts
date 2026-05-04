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
        statements: 70,
        branches: 50,
        functions: 75,
        lines: 70,
      },
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
});
