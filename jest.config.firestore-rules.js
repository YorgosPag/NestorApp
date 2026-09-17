/**
 * Jest config — Firestore Rules Tests (ADR-298)
 *
 * Dedicated config for `tests/firestore-rules/suites/**` because the root
 * `jest.config.js`:
 *   1. Explicitly excludes `tests/firestore-rules` via `testPathIgnorePatterns`
 *   2. Uses `testEnvironment: 'jsdom'` which is incompatible with
 *      `@firebase/rules-unit-testing` + `firebase-admin` (both require `node`)
 *   3. Loads `jest.setup.js` which pulls in `@testing-library/jest-dom` and
 *      browser-only globals that rules tests do not need
 *
 * Keeping this config isolated avoids polluting the main jest run with an
 * extra project and keeps the rules suite runnable via a single command
 * (`pnpm test:firestore-rules`) that does one thing reliably.
 *
 * @see jest.config.js (main app tests — excluded here)
 * @see tests/firestore-rules/README.md
 */

/** @type {import('jest').Config} */
const config = {
  displayName: 'firestore-rules',
  testEnvironment: 'node',
  rootDir: __dirname,
  testMatch: ['<rootDir>/tests/firestore-rules/suites/**/*.rules.test.ts'],
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
  // No setupFilesAfterEach — no browser globals needed.
  // `@/` alias (ίδιο με το `jest.config.js`, SSoT tsconfig): ADR-866 §2.6.8 — μια σουίτα κανόνων
  // πρέπει να μπορεί να στείλει στον emulator το φορτίο του ΠΡΑΓΜΑΤΙΚΟΥ builder
  // (`buildPendingFileRecordData`), αλλιώς «κώδικας και κανόνας συμφωνούν» αποδεικνύεται μόνο
  // με χειρόγραφο αντίγραφο του σχήματος — που μπορεί να αποκλίνει σιωπηλά.
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testTimeout: 30000,
  // Emulator state is shared process-wide; always run serially.
  maxWorkers: 1,
};

module.exports = config;
