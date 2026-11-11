/**
 * Firestore Rules — συλλογή `accounting_payment_checkouts` (ADR-ACC-030)
 *
 * Σχήμα κανόνα: `read: if false` · `write: if false` — γράφουν **μόνο** το checkout endpoint και το webhook.
 *
 * 🔴 **ΤΑ ΚΕΛΙΑ ΠΟΥ ΕΧΟΥΝ ΣΗΜΑΣΙΑ**:
 * - **γραφή από πελάτη** — `status: 'paid'` χωρίς χρήματα, ή συνεδρία με ποσό της επιλογής του·
 * - **ανάγνωση** — ποσά και αναφορές παρόχου όλων των συνδέσμων πληρωμής.
 *
 * @since 2026-11-11 (ADR-ACC-030)
 */

import { assertFails } from '@firebase/rules-unit-testing';

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';
import { getContext } from '../_harness/auth-contexts';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'accounting_payment_checkouts')!;

describe('accounting_payment_checkouts.rules — τη συνεδρία πληρωμής τη γράφει μόνο ο διακομιστής', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    defineDenyAllCell(env, cell, COVERAGE.collection);
  }

  describe('🔴 ούτε διαχειριστής μισθωτή', () => {
    it('ΔΕΝ γράφει «πληρώθηκε» σε συνεδρία — θα εξοφλούσε τιμολόγιο χωρίς χρήματα', async () => {
      const admin = getContext(env(), 'same_tenant_admin');
      await assertFails(
        admin.firestore().collection('accounting_payment_checkouts').doc(`pchk_${'a'.repeat(32)}`).set({
          companyId: SAME_TENANT_COMPANY_ID, invoiceId: 'inv_x', status: 'paid', amountMinor: 1,
        }),
      );
    });
  });
});
