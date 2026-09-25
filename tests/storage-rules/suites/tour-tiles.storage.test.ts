/**
 * Storage Rules — Ιδιωτικά πλακίδια περιήγησης (ADR-884 Φ0.4 · Φ0.9)
 *
 * Pattern: server_only_sealed · Path: /tour-tiles/**
 *
 * Τι φυλάει:
 *   Τα πλακίδια περιήγησης `on-request` / `link-only`. Τα σερβίρει ΜΟΝΟ η διαδρομή που επαληθεύει κουπόνι θέασης
 *   (Φ0.4)· ένα `allow read` εδώ θα έκανε την ορατότητα ζήτημα ονομασίας αρχείου.
 *
 * Κοινό σώμα: `_harness/sealed-suite.ts`.
 */

import { defineSealedStorageCell, useSealedStorageEmulator } from '../_harness/sealed-suite';
import { STORAGE_RULES_COVERAGE } from '../_registry/coverage-manifest';

export const COVERAGE = STORAGE_RULES_COVERAGE.find((c) => c.pathId === 'tour_tiles')!;

const TEST_PATH = 'tour-tiles/stour_1/tcap_1/0/0_0.jpg';

describe('tour-tiles.storage — server_only_sealed pattern', () => {
  const env = useSealedStorageEmulator();
  for (const cell of COVERAGE.matrix) {
    defineSealedStorageCell(env, cell, TEST_PATH);
  }
});
