/**
 * Storage Rules — Asset packs (ADR-655, gated content libraries)
 *
 * Pattern: server_only_read_superadmin_curation
 *
 * Path: /asset-packs/{packId}/{version}/{assetId}.webp
 *
 * Rules:
 *   read:   `if false`                              → ΚΑΝΕΝΑΣ client, ούτε ο super_admin
 *   write:  `isSuperAdmin() && isValidFileSize()`   → curation μόνο
 *   delete: `isSuperAdmin()`                        → curation μόνο
 *
 * Τι φυλάει αυτό το suite:
 *   Το περιεχόμενο είναι **αδειοδοτημένο** — η πρόσβαση κρίνεται από την πύλη
 *   (entitlement εταιρείας + RBAC + kill switch) σε server code, και σερβίρεται από το
 *   /api/asset-packs proxy με Admin SDK. Αν το `allow read` χαλαρώσει έστω σε
 *   `isAuthenticated()`, ΟΛΗ η πύλη παρακάμπτεται με σκέτο Storage URL. Γι' αυτό το
 *   `super_admin × read` είναι εδώ ΡΗΤΑ `deny`: η μόνη ανάγνωση είναι η server-side.
 *
 * See ADR-301 §3.3 (harness) + ADR-655 (asset packs).
 */

import {
  initStorageEmulator,
  teardownStorageEmulator,
  resetStorageData,
} from '../_harness/emulator';
import { getStorageContext } from '../_harness/auth-contexts';
import { assertStorageCell, type AssertStorageTarget } from '../_harness/assertions';
import { seedStorageFile } from '../_harness/seed-helpers';
import { STORAGE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = STORAGE_RULES_COVERAGE.find((c) => c.pathId === 'asset_packs')!;

const TEST_PATH = 'asset-packs/furniture-plan-2d/1/sofa-2seat.webp';

describe('asset-packs.storage — server_only_read_superadmin_curation pattern', () => {
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

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        // Το αρχείο πρέπει να υπάρχει για read/delete, ώστε ένα deny να είναι όντως
        // permission-denied και όχι object-not-found.
        if (cell.operation === 'read' || cell.operation === 'delete') {
          await seedStorageFile(env, TEST_PATH);
        }

        const ctx = getStorageContext(env, cell.persona);
        const target: AssertStorageTarget = { path: TEST_PATH };

        await assertStorageCell(ctx, cell, target);
      });
    });
  }
});
