import { defineConfig } from 'vitest/config';

export const vitestNode = defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    globals: true,
    reporters: ['default'],
  },
});

export const vitestJsdom = defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    reporters: ['default'],
  },
});

export const vitestConfig = vitestNode;
export default vitestNode;