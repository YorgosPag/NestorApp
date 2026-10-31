/**
 * Firestore Rules — `catalog_import_profiles` (ADR-923 §5.5.1 · αποθηκευμένες αντιστοιχίσεις)
 *
 * Σχήμα κανόνα: read = `if false` · write = `if false`: ό,τι ανήκει στον αγωγό εισαγωγής περνά από τον κριτή του διακομιστή.
 * @since 2026-10-31 (ADR-923 Φ4)
 */

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import {
  defineServerOnlyTenantAnchors,
  defineServerWrittenTenantCell,
  useServerWrittenTenantEmulator,
  type TenantPayload,
} from '../_harness/server-written-tenant-suite';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'catalog_import_profiles')!;

const payload: TenantPayload = (companyId) => ({
  companyId,
  code: 'aries_prices', label: 'Aries', purpose: 'priceLines', supplierContactId: null, familyId: null, skipRows: 0, sheetIndex: 0, columns: [],
  revision: 1,
  isDeleted: false,
});

describe('catalog_import_profiles.rules — διαβάζει ΚΑΙ γράφει ΜΟΝΟ ο ΔΙΑΚΟΜΙΣΤΗΣ', () => {
  const env = useServerWrittenTenantEmulator();
  for (const cell of COVERAGE.matrix) {
    defineServerWrittenTenantCell(env, cell, COVERAGE.collection, payload);
  }
  defineServerOnlyTenantAnchors(env, COVERAGE.collection, payload);
});
