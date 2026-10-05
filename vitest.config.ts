import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['server/__tests__/**/*.test.ts'],
    exclude: ['node_modules/**'],
    hookTimeout: 20000,
    testTimeout: 20000,
  },
});
