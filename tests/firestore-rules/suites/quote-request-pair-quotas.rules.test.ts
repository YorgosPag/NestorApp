/**
 * Firestore Rules — `quote_request_pair_quotas` (ADR-923 §5.13 Τ5)
 *
 * Σχήμα κανόνα: read = `if false` · write = `if false`. Η ημερήσια ποσόστωση αιτημάτων προσφοράς ανά ζεύγος (αγοραστής,
 * προμηθευτής) αυξάνεται ΜΟΝΟ μέσα στη συναλλαγή του διακομιστή — πελάτης που θα τη μηδένιζε θα παρέκαμπτε το όριο.
 * @since 2026-11-04 (ADR-923 κύμα 3)
 */

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import {
  defineServerOnlyTenantAnchors,
  defineServerWrittenTenantCell,
  useServerWrittenTenantEmulator,
  type TenantPayload,
} from '../_harness/server-written-tenant-suite';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'quote_request_pair_quotas')!;

const payload: TenantPayload = (companyId) => ({
  companyId,
  window: 20761,
  pairs: { comp_aries: 3 },
});

describe('quote_request_pair_quotas.rules — διαβάζει ΚΑΙ γράφει ΜΟΝΟ ο ΔΙΑΚΟΜΙΣΤΗΣ', () => {
  const env = useServerWrittenTenantEmulator();
  for (const cell of COVERAGE.matrix) {
    defineServerWrittenTenantCell(env, cell, COVERAGE.collection, payload);
  }
  defineServerOnlyTenantAnchors(env, COVERAGE.collection, payload);
});
