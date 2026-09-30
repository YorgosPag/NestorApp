/**
 * Jest config — **verified fake** του Firestore (ADR-742 §7sexdecies)
 *
 * Τρέχει τη σουίτα συμβολαίου `src/test-utils/fake-firestore/contract/firestore-contract.ts` πάνω στον **πραγματικό**
 * Firestore emulator με το Admin SDK. Η **ίδια** σουίτα τρέχει στο `FakeFirestore` μέσα στο κανονικό jest· αν ένας
 * ισχυρισμός περνά εκεί και κοκκινίζει εδώ, το fake λέει ψέματα — και κάθε test πάνω του κρίνει κώδικα που η
 * παραγωγή δεν εκτελεί.
 *
 * Χωριστό config για τους ίδιους λόγους με το αδελφό `jest.config.functions-integration.js`:
 *   1. `node` — το `firebase-admin` δεν τρέχει σε jsdom·
 *   2. `maxWorkers: 1` — η κατάσταση του emulator είναι κοινή ανά διεργασία·
 *   3. το κύριο `jest.config.js` αγνοεί αυτό το `testMatch` **παραγωγικά** (ιδιοκτησία αδελφών configs).
 *
 * Εκτέλεση: `pnpm test:firestore-contract:emulator` (σηκώνει και ρίχνει τον emulator μόνο του).
 *
 * @see jest.config.functions-integration.js
 * @see tests/firestore-contract/suites/fake-parity.integration.test.ts
 */

/** @type {import('jest').Config} */
const config = {
  displayName: 'firestore-contract',
  testEnvironment: 'node',
  rootDir: __dirname,
  testMatch: ['<rootDir>/tests/firestore-contract/suites/**/*.integration.test.ts'],
  transform: {
    '^.+\\.(t|j)sx?$': [
      '@swc/jest',
      {
        jsc: {
          parser: { syntax: 'typescript', tsx: false, decorators: true },
          target: 'es2022',
        },
      },
    ],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFiles: ['<rootDir>/tests/firestore-contract/_harness/setup-env.ts'],
  testTimeout: 30000,
  maxWorkers: 1,
};

module.exports = config;
