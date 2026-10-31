/**
 * Firestore Rules — `catalog_import_batches` (ADR-923 §5.5.1 · παρτίδες εισαγωγής)
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

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'catalog_import_batches')!;

const payload: TenantPayload = (companyId) => ({
  companyId,
  code: 'abc|prices:cplv_1|none|0', sourceKind: 'spreadsheet', contentSha256: 'abc', fileName: 'τιμές.xlsx', sizeBytes: 100, fileId: null, status: 'awaitingFile',
  revision: 1,
  isDeleted: false,
});

describe('catalog_import_batches.rules — διαβάζει ΚΑΙ γράφει ΜΟΝΟ ο ΔΙΑΚΟΜΙΣΤΗΣ', () => {
  const env = useServerWrittenTenantEmulator();
  for (const cell of COVERAGE.matrix) {
    defineServerWrittenTenantCell(env, cell, COVERAGE.collection, payload);
  }
  defineServerOnlyTenantAnchors(env, COVERAGE.collection, payload);
});
