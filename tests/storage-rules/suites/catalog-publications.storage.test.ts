/**
 * Storage Rules — PDF εκδόσεων καταλόγου (ADR-923 §5.6)
 *
 * Pattern: server_only_sealed · Path: /catalog-publications/**
 *
 * Τι φυλάει:
 *   Μια έκδοση μπορεί να περιέχει τιμές ενός κοινού (§12). Τη σερβίρει ΜΟΝΟ η διαδρομή λήψης με κριτή `catalog:pricing:view`·
 *   ένα `allow read` εδώ θα έκανε τις τιμές συνεργάτη ζήτημα ονομασίας αρχείου.
 *
 * Κοινό σώμα: `_harness/sealed-suite.ts`.
 */

import { defineSealedStorageCell, useSealedStorageEmulator } from '../_harness/sealed-suite';
import { STORAGE_RULES_COVERAGE } from '../_registry/coverage-manifest';

export const COVERAGE = STORAGE_RULES_COVERAGE.find((c) => c.pathId === 'catalog_publications')!;

const TEST_PATH = 'catalog-publications/comp_1/cpubx_1/print.pdf';

describe('catalog-publications.storage — server_only_sealed pattern', () => {
  const env = useSealedStorageEmulator();
  for (const cell of COVERAGE.matrix) {
    defineSealedStorageCell(env, cell, TEST_PATH);
  }
});
