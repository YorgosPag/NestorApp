/**
 * Firestore Rules — `catalog_import_page_readings` (ADR-923 §5.5.1 Ε6 · οι ακατέργαστες απαντήσεις του μοντέλου)
 *
 * Σχήμα κανόνα: read = `if false` · write = `if false`. Οι απαντήσεις κουβαλούν ό,τι τυπώνει ο κατάλογος του προμηθευτή, και η
 * μόνη τους δουλειά είναι να εξηγούν μια αστοχία στον διακομιστή.
 * @since 2026-11-01 (ADR-923 Φ4)
 */

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import {
  defineServerOnlyTenantAnchors,
  defineServerWrittenTenantCell,
  useServerWrittenTenantEmulator,
  type TenantPayload,
} from '../_harness/server-written-tenant-suite';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'catalog_import_page_readings')!;

const payload: TenantPayload = (companyId) => ({
  companyId,
  batchId: 'cibat_1', page: 85, route: 'table', attempt: 0, model: 'gpt-4o', rawText: '{}', outcome: 'read',
});

describe('catalog_import_page_readings.rules — διαβάζει ΚΑΙ γράφει ΜΟΝΟ ο ΔΙΑΚΟΜΙΣΤΗΣ', () => {
  const env = useServerWrittenTenantEmulator();
  for (const cell of COVERAGE.matrix) {
    defineServerWrittenTenantCell(env, cell, COVERAGE.collection, payload);
  }
  defineServerOnlyTenantAnchors(env, COVERAGE.collection, payload);
});
