/**
 * Firestore Rules — `supply_relationships` (ADR-923 §5.12)
 *
 * Σχήμα κανόνα: read = `if false` · write = `if false`. Και οι δύο πλευρές περνούν από τον διακομιστή: ούτε ο προμηθευτής ούτε ο αγοραστής βλέπουν το έγγραφο.
 * @since 2026-10-31 (ADR-923 Φ6α)
 */

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import {
  defineServerOnlyTenantAnchors,
  defineServerWrittenTenantCell,
  useServerWrittenTenantEmulator,
  type TenantPayload,
} from '../_harness/server-written-tenant-suite';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'supply_relationships')!;

const payload: TenantPayload = (companyId) => ({
  companyId,
  buyerCompanyId: 'company-buyer',
  state: 'active',
  revision: 1,
});

describe('supply_relationships.rules — διαβάζει ΚΑΙ γράφει ΜΟΝΟ ο ΔΙΑΚΟΜΙΣΤΗΣ', () => {
  const env = useServerWrittenTenantEmulator();
  for (const cell of COVERAGE.matrix) {
    defineServerWrittenTenantCell(env, cell, COVERAGE.collection, payload);
  }
  defineServerOnlyTenantAnchors(env, COVERAGE.collection, payload);
});
