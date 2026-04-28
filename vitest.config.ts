import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration — keeps tests scoped to pure helpers under src/lib
 * so we don't pull in React, Firebase, or PWA plugins. Heavy
 * environments (jsdom, msw) can be added later when we start testing
 * components.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/lib/**/*.test.ts', 'src/lib/**/*.spec.ts', 'tests/**/*.test.ts'],
    exclude: ['node_modules', 'dist', '.vercel'],
    reporters: ['default'],
  },
});
