/**
 * Firestore Rules — `catalog_price_list_lines` (ADR-923 §5.11 «3β» · γραμμές τιμοκαταλόγου)
 *
 * Σχήμα κανόνα: read = `isInternalUserOfCompany(companyId)` · write = `if false` (μόνο `src/server/catalog/**`).
 * 🔑 Γραμμή σε μη πρόχειρη έκδοση αρνείται ο γραφέας (η έκδοση κλειδώνει τις γραμμές της).
 * @since 2026-10-27 (ADR-923 Φ3β)
 */

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import {
  defineServerWrittenTenantAnchors,
  defineServerWrittenTenantCell,
  useServerWrittenTenantEmulator,
  type TenantPayload,
} from '../_harness/server-written-tenant-suite';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'catalog_price_list_lines')!;

const payload: TenantPayload = (companyId) => ({
  companyId,
  versionId: 'cplv_gen_1', subject: { kind: 'variant', variantId: 'cprod_1' }, netPrice: 52000, priceQuantity: 1, unitCode: 'pcs', discountGroupId: null, breakdown: null,
  revision: 1,
  isDeleted: false,
});

describe('catalog_price_list_lines.rules — διαβάζει ο χώρος, γράφει ο ΔΙΑΚΟΜΙΣΤΗΣ', () => {
  const env = useServerWrittenTenantEmulator();
  for (const cell of COVERAGE.matrix) {
    defineServerWrittenTenantCell(env, cell, COVERAGE.collection, payload);
  }
  defineServerWrittenTenantAnchors(env, COVERAGE.collection, payload);
});
