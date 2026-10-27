/**
 * Firestore Rules — `catalog_discount_groups` (ADR-923 §5.11 «3β» · ομάδες έκπτωσης)
 *
 * Σχήμα κανόνα: read = `isInternalUserOfCompany(companyId)` · write = `if false` (μόνο `src/server/catalog/**`).
 * 🔑 Διαγραφή μόνο όταν καμία γραμμή/συνθήκη δεν τη φέρει.
 * @since 2026-10-27 (ADR-923 Φ3β)
 */

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import {
  defineServerWrittenTenantAnchors,
  defineServerWrittenTenantCell,
  useServerWrittenTenantEmulator,
  type TenantPayload,
} from '../_harness/server-written-tenant-suite';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'catalog_discount_groups')!;

const payload: TenantPayload = (companyId) => ({
  companyId,
  code: 'tosh_carr', labels: { el: 'TOSH-CARR' },
  revision: 1,
  isDeleted: false,
});

describe('catalog_discount_groups.rules — διαβάζει ο χώρος, γράφει ο ΔΙΑΚΟΜΙΣΤΗΣ', () => {
  const env = useServerWrittenTenantEmulator();
  for (const cell of COVERAGE.matrix) {
    defineServerWrittenTenantCell(env, cell, COVERAGE.collection, payload);
  }
  defineServerWrittenTenantAnchors(env, COVERAGE.collection, payload);
});
