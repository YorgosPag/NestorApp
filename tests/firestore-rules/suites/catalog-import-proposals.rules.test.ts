/**
 * Firestore Rules — `catalog_import_proposals` (ADR-923 §5.5.1 · προτάσεις με διαφορά ανά πεδίο)
 *
 * Σχήμα κανόνα: read = `if false` · write = `if false`. 🔒 Οι προτάσεις της ροής «μόνο τιμές» κουβαλούν **τιμές**: ισχύει η
 * απόφαση της τιμολόγησης (ADR-923 §5.11 «3δ» Ζ), η προβολή κρίνεται μόνο στον διακομιστή.
 * @since 2026-10-31 (ADR-923 Φ4)
 */

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import {
  defineServerOnlyTenantAnchors,
  defineServerWrittenTenantCell,
  useServerWrittenTenantEmulator,
  type TenantPayload,
} from '../_harness/server-written-tenant-suite';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'catalog_import_proposals')!;

const payload: TenantPayload = (companyId) => ({
  companyId,
  batchId: 'cibat_1', groupKey: 'prices:0', purpose: 'priceLines', status: 'pending', rows: [], violations: [],
  revision: 1,
  isDeleted: false,
});

describe('catalog_import_proposals.rules — διαβάζει ΚΑΙ γράφει ΜΟΝΟ ο ΔΙΑΚΟΜΙΣΤΗΣ', () => {
  const env = useServerWrittenTenantEmulator();
  for (const cell of COVERAGE.matrix) {
    defineServerWrittenTenantCell(env, cell, COVERAGE.collection, payload);
  }
  defineServerOnlyTenantAnchors(env, COVERAGE.collection, payload);
});
