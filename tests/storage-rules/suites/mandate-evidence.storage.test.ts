/**
 * Storage Rules — Παγωμένα αποδεικτικά βεβαίωσης (ADR-864 §19)
 *
 * Pattern: server_only_sealed
 *
 * Path: /mandate-evidence/{ownerPropertyId}/{evidenceId}
 *
 * Rules:
 *   read / write / delete: `if false` → ΚΑΝΕΝΑΣ client, ούτε ο super_admin
 *
 * Τι φυλάει αυτό το suite:
 *   Το υπογεγραμμένο έντυπο που βεβαίωσε ένα γραφείο στο όνομα ιδιοκτήτη. Αν το `allow delete` χαλαρώσει έστω
 *   σε `belongsToCompany`, το γραφείο σβήνει την απόδειξη που ο ιδιοκτήτης χρειάζεται για να την αμφισβητήσει·
 *   αν χαλαρώσει το `allow read`, ο κριτής «είσαι μέρος της εντολής;» παρακάμπτεται με σκέτο Storage URL.
 *
 * See ADR-301 §3.3 (harness) + ADR-864 §19.
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

export const COVERAGE = STORAGE_RULES_COVERAGE.find((c) => c.pathId === 'mandate_evidence')!;

const TEST_PATH = 'mandate-evidence/ownp_a/mevd_1';

describe('mandate-evidence.storage — server_only_sealed pattern', () => {
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
        // Το αρχείο υπάρχει για read/delete, ώστε το deny να είναι permission-denied και όχι object-not-found.
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
