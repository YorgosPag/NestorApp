/**
 * Jest config — Cloud Functions integration tests (ADR-327 Layer 4)
 *
 * Runs tests in `tests/functions-integration/suites/**` against a live
 * Firebase emulator suite (firestore + storage + functions). Tests verify
 * cross-cutting invariants — currently the orphan-cleanup race fix from
 * ADR-327: `uploadPublicFile()` must produce a file that survives
 * `onStorageFinalize`.
 *
 * Why a separate config:
 *   1. testEnvironment must be `node` — `firebase-admin` doesn't run in jsdom.
 *   2. testTimeout must accommodate emulator latency + async onFinalize fire
 *      (~3-8s typical on the local emulator, sometimes longer in CI).
 *   3. maxWorkers must be 1 — emulator state is shared per-process, so any
 *      parallel suite would clobber another's data.
 *   4. The main `jest.config.js` ignores `tests/firestore-rules` and similar;
 *      this config explicitly opts in for `tests/functions-integration`.
 *
 * @see jest.config.firestore-rules.js (the closest sibling — same shape)
 * @see firebase.json (emulator ports must match the harness constants)
 * @see tests/functions-integration/_harness/emulator.ts
 */

/** @type {import('jest').Config} */
const config = {
  displayName: 'functions-integration',
  testEnvironment: 'node',
  rootDir: __dirname,
  testMatch: ['<rootDir>/tests/functions-integration/suites/**/*.integration.test.ts'],
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
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^server-only$': '<rootDir>/src/services/ai-pipeline/tools/__tests__/test-utils/server-only-mock.ts',
  },
  setupFiles: ['<rootDir>/tests/functions-integration/_harness/setup-env.ts'],
  testTimeout: 60000,
  maxWorkers: 1,
};

module.exports = config;
