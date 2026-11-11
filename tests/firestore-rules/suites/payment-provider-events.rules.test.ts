/**
 * Firestore Rules — συλλογή `payment_provider_events` (ADR-ACC-030)
 *
 * Σχήμα κανόνα: `read: if false` · `write: if false` — γράφει **μόνο** το υπογεγραμμένο webhook.
 *
 * 🔴 **ΤΟ ΚΕΛΙ ΠΟΥ ΕΧΕΙ ΣΗΜΑΣΙΑ**: **γραφή από πελάτη** — προ-«κατανάλωση» του id ενός αληθινού συμβάντος ⇒ το
 * webhook θα το έβλεπε ως διπλό και η πληρωμή δεν θα καταγραφόταν ποτέ.
 *
 * @since 2026-11-11 (ADR-ACC-030)
 */

import { assertFails } from '@firebase/rules-unit-testing';

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';
import { getContext } from '../_harness/auth-contexts';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'payment_provider_events')!;

describe('payment_provider_events.rules — τα συμβάντα παρόχου τα γράφει μόνο το webhook', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    defineDenyAllCell(env, cell, COVERAGE.collection);
  }

  describe('🔴 ούτε διαχειριστής μισθωτή', () => {
    it('ΔΕΝ «καταναλώνει» το id αληθινού συμβάντος — η πληρωμή θα χανόταν ως «διπλή»', async () => {
      const admin = getContext(env(), 'same_tenant_admin');
      await assertFails(
        admin.firestore().collection('payment_provider_events').doc(`pevt_${'b'.repeat(32)}`).set({
          provider: 'everypay', state: 'processed',
        }),
      );
    });
  });
});
