import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vitest/config';

// Unit tests run on their own config, not vite.config.ts: the Hydrogen,
// Oxygen and React Router plugins boot a worker runtime and route tree that
// pure-function tests don't need. Only the `~` alias is shared.
export default defineConfig({
  resolve: {
    alias: {'~': fileURLToPath(new URL('./app', import.meta.url))},
  },
  test: {
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    // Node by default; a test that needs a DOM opts in per file.
    environment: 'node',
    restoreMocks: true,
    unstubGlobals: true,
    coverage: {
      provider: 'v8',
      include: ['app/lib/**/*.{ts,tsx}'],
      exclude: ['app/lib/**/*.d.ts', 'app/lib/i18n/**'],
      reporter: ['text-summary', 'text', 'html'],
      reportsDirectory: 'coverage',
    },
  },
});
