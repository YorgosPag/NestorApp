/**
 * Firestore Rules — `subcontract_agreement_counters` (ADR-928 Φ2 απόφαση 7)
 *
 * Σχήμα κανόνα: read = `if false` · write = `if false`. Ο μετρητής αριθμών εγγράφου αυξάνεται ΜΟΝΟ μέσα στη συναλλαγή
 * του γραφέα που γράφει το έγγραφο — πελάτης που θα τον άλλαζε θα έδινε διπλό ή χαμένο αριθμό.
 * @since 2026-11-03 (ADR-928 Φ2)
 */

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import {
  defineServerOnlyTenantAnchors,
  defineServerWrittenTenantCell,
  useServerWrittenTenantEmulator,
  type TenantPayload,
} from '../_harness/server-written-tenant-suite';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'subcontract_agreement_counters')!;

const payload: TenantPayload = (companyId) => ({
  companyId,
  sequences: { 'offer:2026': 7, 'agreement:2026': 3 },
  revision: 1,
});

describe('subcontract_agreement_counters.rules — διαβάζει ΚΑΙ γράφει ΜΟΝΟ ο ΔΙΑΚΟΜΙΣΤΗΣ', () => {
  const env = useServerWrittenTenantEmulator();
  for (const cell of COVERAGE.matrix) {
    defineServerWrittenTenantCell(env, cell, COVERAGE.collection, payload);
  }
  defineServerOnlyTenantAnchors(env, COVERAGE.collection, payload);
});
