/**
 * Jest config — service integration tests against a live Firestore emulator
 * with `firestore.rules` **enforced** (ADR-745 §4 G3).
 *
 * ## The gap this closes
 *
 * The repo already had both halves and neither ever met the other:
 *   - `tests/firestore-rules/**` exercises the rules, but seeds documents
 *     *directly* — the production converter never runs.
 *   - `src/**\/__tests__/**` exercises the services with Firestore mocked —
 *     the rules never run.
 *
 * So "the converter emits bytes the rules accept" was asserted by nobody, in a
 * codebase where `contact_links` holds **0 documents** — the flow has never
 * been executed, by a test or by a human. This config runs production service
 * code, unmodified, against real rules and a real emulator.
 *
 * ## Why a custom environment and not plain `jsdom`
 *
 * jsdom omits Node's web globals (`fetch`, `Response`, `TextEncoder`, …), and
 * `@firebase/rules-unit-testing` needs them to upload the rules. See
 * `_harness/jsdom-with-node-globals.js` for the measurement and the two
 * alternatives that were rejected.
 *
 * ## Why `jsdom` and not `node` (the sibling configs both use `node`)
 *
 * The code under test is client code. `contact-link.service.ts` imports the
 * **browser** Firestore SDK and dispatches through `RealtimeService`, whose
 * `dispatch()` calls `window.dispatchEvent` unguarded. Under `node` that
 * throws, and `linkContactToEntity`'s catch-all converts it into
 * `{ success: false }` — *after* the document is already written. The suite
 * would then be measuring a runtime the browser never has, and would report
 * failure for a write that succeeded.
 *
 * `jest.config.firestore-rules.js` picks `node` for the opposite reason and its
 * header says jsdom is "incompatible with `@firebase/rules-unit-testing` +
 * `firebase-admin`". That is true of **`firebase-admin`**, which needs node
 * APIs and which this suite never loads. `rules-unit-testing` itself only
 * wraps the browser SDK — jsdom is its native habitat. Verified by running it.
 *
 * ## Why not `jest.setup.js`
 *
 * It replaces `localStorage` with `jest.fn()` stubs that store nothing.
 * `RealtimeService` writes there for cross-tab sync, so with those stubs the
 * realtime path would appear to work while persisting nothing — the exact
 * class of false green this suite exists to catch. `setup-env.ts` installs a
 * real in-memory implementation instead.
 *
 * @see jest.config.functions-integration.js (Admin SDK, rules bypassed — the sibling shape)
 * @see jest.config.firestore-rules.js (rules only, no production code)
 * @see tests/service-integration/_harness/firestore-seam.ts
 */

/** @type {import('jest').Config} */
const config = {
  displayName: 'service-integration',
  testEnvironment: '<rootDir>/tests/service-integration/_harness/jsdom-with-node-globals.js',
  rootDir: __dirname,
  testMatch: ['<rootDir>/tests/service-integration/suites/**/*.integration.test.ts'],
  transform: {
    '^.+\\.(t|j)sx?$': [
      '@swc/jest',
      {
        jsc: {
          parser: {
            syntax: 'typescript',
            tsx: true,
            decorators: true,
          },
          transform: {
            react: { runtime: 'automatic' },
          },
          target: 'es2022',
        },
      },
    ],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFiles: ['<rootDir>/tests/service-integration/_harness/setup-env.ts'],
  setupFilesAfterEnv: ['<rootDir>/tests/service-integration/_harness/setup-after-env.ts'],
  testTimeout: 30000,
  // Emulator state is process-wide; parallel suites would clobber each other.
  maxWorkers: 1,
};

module.exports = config;
