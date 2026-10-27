/**
 * Firestore Rules — `catalog_pricing_slots` (ADR-923 §5.11 «3β» · υποδοχές ασάφειας)
 *
 * Σχήμα κανόνα: read = `isInternalUserOfCompany(companyId)` · write = `if false` (μόνο `src/server/catalog/**`).
 * 🔑 Ευρετήριο του γραφέα, όχι οντότητα: γράφεται ΜΟΝΟ στην ίδια συναλλαγή με τη συνθήκη/λίστα.
 * @since 2026-10-27 (ADR-923 Φ3β)
 */

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import {
  defineServerWrittenTenantAnchors,
  defineServerWrittenTenantCell,
  useServerWrittenTenantEmulator,
  type TenantPayload,
} from '../_harness/server-written-tenant-suite';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'catalog_pricing_slots')!;

const payload: TenantPayload = (companyId) => ({
  companyId,
  slotKey: 'condition:*:anonymous', members: [{ holderId: 'cdcnd_1', validFrom: null, validUntil: null }],
});

describe('catalog_pricing_slots.rules — διαβάζει ο χώρος, γράφει ο ΔΙΑΚΟΜΙΣΤΗΣ', () => {
  const env = useServerWrittenTenantEmulator();
  for (const cell of COVERAGE.matrix) {
    defineServerWrittenTenantCell(env, cell, COVERAGE.collection, payload);
  }
  defineServerWrittenTenantAnchors(env, COVERAGE.collection, payload);
});
