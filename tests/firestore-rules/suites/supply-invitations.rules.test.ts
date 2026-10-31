/**
 * Firestore Rules — `supply_invitations` (ADR-923 §5.12)
 *
 * Σχήμα κανόνα: read = `if false` · write = `if false`. 🔴 Ανάγνωση θα έδινε το `nonceHash`, δηλαδή τη θέση του παραλήπτη.
 * @since 2026-10-31 (ADR-923 Φ6α)
 */

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import {
  defineServerOnlyTenantAnchors,
  defineServerWrittenTenantCell,
  useServerWrittenTenantEmulator,
  type TenantPayload,
} from '../_harness/server-written-tenant-suite';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'supply_invitations')!;

const payload: TenantPayload = (companyId) => ({
  companyId,
  contactId: 'cont_anchor',
  inviteeEmail: 'buyer.seed@example.gr',
  nonceHash: 'seed-hash',
  state: 'pending',
});

describe('supply_invitations.rules — διαβάζει ΚΑΙ γράφει ΜΟΝΟ ο ΔΙΑΚΟΜΙΣΤΗΣ', () => {
  const env = useServerWrittenTenantEmulator();
  for (const cell of COVERAGE.matrix) {
    defineServerWrittenTenantCell(env, cell, COVERAGE.collection, payload);
  }
  defineServerOnlyTenantAnchors(env, COVERAGE.collection, payload);
});
