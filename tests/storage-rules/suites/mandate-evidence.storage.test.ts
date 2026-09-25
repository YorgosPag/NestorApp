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
 * See ADR-301 §3.3 (harness) + ADR-864 §19. Κοινό σώμα: `_harness/sealed-suite.ts`.
 */

import { defineSealedStorageCell, useSealedStorageEmulator } from '../_harness/sealed-suite';
import { STORAGE_RULES_COVERAGE } from '../_registry/coverage-manifest';

export const COVERAGE = STORAGE_RULES_COVERAGE.find((c) => c.pathId === 'mandate_evidence')!;

const TEST_PATH = 'mandate-evidence/ownp_a/mevd_1';

describe('mandate-evidence.storage — server_only_sealed pattern', () => {
  const env = useSealedStorageEmulator();
  for (const cell of COVERAGE.matrix) {
    defineSealedStorageCell(env, cell, TEST_PATH);
  }
});
