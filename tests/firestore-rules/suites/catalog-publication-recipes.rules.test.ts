/**
 * Firestore Rules — `catalog_publication_recipes` (ADR-923 §5.6 · εκδότης καταλόγου)
 *
 * Σχήμα κανόνα: read = `if false` · write = `if false` — **και οι δύο** μόνο στον διακομιστή: μια έκδοση μπορεί να περιέχει
 * τιμές κοινού, άρα ισχύει ο κριτής `pricingView` του §5.11 «3δ» Ζ.
 * @since 2026-10-31 (ADR-923 Φ5)
 */

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import {
  defineServerOnlyTenantAnchors,
  defineServerWrittenTenantCell,
  useServerWrittenTenantEmulator,
  type TenantPayload,
} from '../_harness/server-written-tenant-suite';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'catalog_publication_recipes')!;

const payload: TenantPayload = (companyId) => ({
  companyId,
  code: 'general', labels: { el: 'Γενικός' },
  revision: 1,
  isDeleted: false,
});

describe('catalog_publication_recipes.rules — διαβάζει ΚΑΙ γράφει ΜΟΝΟ ο ΔΙΑΚΟΜΙΣΤΗΣ', () => {
  const env = useServerWrittenTenantEmulator();
  for (const cell of COVERAGE.matrix) {
    defineServerWrittenTenantCell(env, cell, COVERAGE.collection, payload);
  }
  defineServerOnlyTenantAnchors(env, COVERAGE.collection, payload);
});
