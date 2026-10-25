/**
 * Firestore Rules — `catalog_attribute_groups` (ADR-923 §5.2 · ομάδες ιδιοτήτων)
 *
 * Σχήμα κανόνα: read = `isInternalUserOfCompany(companyId)` · write = `if false` (μόνο `src/server/catalog/**`).
 * @since 2026-10-25 (ADR-923 Φ1β)
 */

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import {
  defineServerWrittenTenantAnchors,
  defineServerWrittenTenantCell,
  useServerWrittenTenantEmulator,
  type TenantPayload,
} from '../_harness/server-written-tenant-suite';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'catalog_attribute_groups')!;

const payload: TenantPayload = (companyId) => ({
  companyId,
  code: 'cooling',
  labels: { el: 'Ψύξη' },
  orderKey: 'a0',
  revision: 1,
  isDeleted: false,
});

describe('catalog_attribute_groups.rules — διαβάζει ο χώρος, γράφει ο ΔΙΑΚΟΜΙΣΤΗΣ', () => {
  const env = useServerWrittenTenantEmulator();
  for (const cell of COVERAGE.matrix) {
    defineServerWrittenTenantCell(env, cell, COVERAGE.collection, payload);
  }
  defineServerWrittenTenantAnchors(env, COVERAGE.collection, payload);
});
