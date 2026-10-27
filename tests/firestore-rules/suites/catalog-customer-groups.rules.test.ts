/**
 * Firestore Rules — `catalog_customer_groups` (ADR-923 §5.11 «3β» · ομάδες πελάτη)
 *
 * Σχήμα κανόνα: read = `isInternalUserOfCompany(companyId)` · write = `if false` (μόνο `src/server/catalog/**`).
 * 🔑 Ποιος ανήκει σε ποια ομάδα είναι εμπορικό απόρρητο του προμηθευτή.
 * @since 2026-10-27 (ADR-923 Φ3β)
 */

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import {
  defineServerWrittenTenantAnchors,
  defineServerWrittenTenantCell,
  useServerWrittenTenantEmulator,
  type TenantPayload,
} from '../_harness/server-written-tenant-suite';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'catalog_customer_groups')!;

const payload: TenantPayload = (companyId) => ({
  companyId,
  code: 'wholesale', labels: { el: 'Χονδρέμπορος' },
  revision: 1,
  isDeleted: false,
});

describe('catalog_customer_groups.rules — διαβάζει ο χώρος, γράφει ο ΔΙΑΚΟΜΙΣΤΗΣ', () => {
  const env = useServerWrittenTenantEmulator();
  for (const cell of COVERAGE.matrix) {
    defineServerWrittenTenantCell(env, cell, COVERAGE.collection, payload);
  }
  defineServerWrittenTenantAnchors(env, COVERAGE.collection, payload);
});
