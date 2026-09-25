/**
 * Storage Rules Test Harness — `server_only_sealed` suite building blocks (ADR-301)
 *
 * Το σχήμα `allow read, write: if false` έχει **ένα** δυνατό σώμα test: κάθε κελί (persona × πράξη) αποτυγχάνει,
 * με το αρχείο **σπαρμένο** για read/delete ώστε η άρνηση να είναι permission-denied και όχι object-not-found.
 * Γραμμένο inline σε κάθε σουίτα γεννά αδελφούς κλώνους (CHECK 3.28)· εδώ ζει **μία** φορά — πρώτο με το
 * `mandate-evidence` (ADR-864 §19), μετά τα `tour-ingest` / `tour-tiles` (ADR-884 Φ0.9).
 *
 * ⚠️ Ο βρόχος `for (const cell of COVERAGE.matrix)` **μένει στη σουίτα** (CHECK 3.19 Validation D), όπως στο
 * `tests/firestore-rules/_harness/deny-all-suite.ts`· εδώ μετακινείται μόνο το σώμα του.
 */

import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

import type { StorageCoverageCell } from '../_registry/coverage-manifest';
import { assertStorageCell } from './assertions';
import { getStorageContext } from './auth-contexts';
import { initStorageEmulator, resetStorageData, teardownStorageEmulator } from './emulator';
import { seedStorageFile } from './seed-helpers';

/** Accessor του ζωντανού περιβάλλοντος — έγκυρο μόνο μέσα σε `it`/`beforeEach`. */
export type StorageEnvAccessor = () => RulesTestEnvironment;

/** Ο κύκλος ζωής του emulator για μια σφραγισμένη σουίτα. */
export function useSealedStorageEmulator(): StorageEnvAccessor {
  let env: RulesTestEnvironment;
  beforeAll(async () => {
    env = await initStorageEmulator();
  });
  afterAll(async () => {
    await teardownStorageEmulator(env);
  });
  afterEach(async () => {
    await resetStorageData(env);
  });
  return () => env;
}

/** Ένα κελί της μήτρας πάνω σε σφραγισμένη διαδρομή. */
export function defineSealedStorageCell(env: StorageEnvAccessor, cell: StorageCoverageCell, path: string): void {
  describe(`${cell.persona} × ${cell.operation}`, () => {
    it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
      if (cell.operation === 'read' || cell.operation === 'delete') {
        await seedStorageFile(env(), path);
      }
      await assertStorageCell(getStorageContext(env(), cell.persona), cell, { path });
    });
  });
}
