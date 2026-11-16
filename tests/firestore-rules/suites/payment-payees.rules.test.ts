/**
 * Firestore Rules — συλλογή `payment_payees` (ADR-943 §5.7)
 *
 * Σχήμα κανόνα: `read: if false` · `write: if false` — γράφει **μόνο** ο διακομιστής (εγγραφή δικαιούχου, webhook KYC,
 * συμφιλίωση).
 *
 * 🔴 **ΤΟ ΚΕΛΙ ΠΟΥ ΕΧΕΙ ΣΗΜΑΣΙΑ**: **γραφή από πελάτη** — ένας μηχανικός θα δήλωνε τον εαυτό του «εξουσιοδοτημένο» χωρίς
 * KYC του PSP, ή θα έδενε τον λογαριασμό του με **ξένο** πωλητή ⇒ η προκαταβολή άλλου θα μεταφερόταν σε λάθος λογαριασμό.
 *
 * @since 2026-11-16 (ADR-943 Φ3)
 */

import { assertFails } from '@firebase/rules-unit-testing';

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';
import { getContext } from '../_harness/auth-contexts';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'payment_payees')!;

describe('payment_payees.rules — τον δικαιούχο marketplace τον γράφει μόνο ο διακομιστής', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    defineDenyAllCell(env, cell, COVERAGE.collection);
  }

  describe('🔴 ούτε διαχειριστής μισθωτή', () => {
    it('ΔΕΝ δηλώνει «εξουσιοδοτημένο» δικαιούχο με αναφορά πωλητή της επιλογής του', async () => {
      const admin = getContext(env(), 'same_tenant_admin');
      await assertFails(
        admin.firestore().collection('payment_payees').doc(`ppye_${'c'.repeat(32)}`).set({
          provider: 'everypay', providerReference: 'sel_foreign', status: 'authorized',
        }),
      );
    });
  });
});
