/**
 * Jest config — Storage Rules Tests (ADR-301)
 *
 * Dedicated config for `tests/storage-rules/suites/**` because:
 *   1. The root `jest.config.js` excludes `tests/storage-rules` via
 *      `testPathIgnorePatterns`.
 *   2. Storage rules tests require `testEnvironment: 'node'` (compat
 *      `@firebase/rules-unit-testing` + `firebase/compat/storage` both
 *      require a real Node.js environment, not jsdom).
 *   3. Emulator state is shared process-wide — `maxWorkers: 1` ensures
 *      tests never race against each other.
 *
 * Run with: `pnpm test:storage-rules`
 * With emulator auto-start: `pnpm test:storage-rules:emulator`
 *
 * @see jest.config.js (main app tests — excluded here)
 * @see jest.config.firestore-rules.js (Firestore rules — analogous config)
 * @see adrs/ADR-301-storage-rules-test-coverage-ssot.md
 */

/** @type {import('jest').Config} */
const config = {
  displayName: 'storage-rules',
  testEnvironment: 'node',
  rootDir: __dirname,
  testMatch: ['<rootDir>/tests/storage-rules/suites/**/*.storage.test.ts'],
  transform: {
    '^.+\\.(t|j)sx?$': [
      '@swc/jest',
      {
        jsc: {
          parser: {
            syntax: 'typescript',
            tsx: false,
            decorators: true,
          },
          target: 'es2022',
        },
      },
    ],
  },
  // No setupFilesAfterEach / moduleNameMapper — rules tests only use
  // relative imports and `@firebase/rules-unit-testing`, nothing that
  // needs path-alias resolution or browser globals.
  testTimeout: 30000,
  // Storage emulator state is shared process-wide; always run serially.
  maxWorkers: 1,
};

module.exports = config;
