/**
 * Firestore Rules — συλλογή `email_recipient_standing` (ADR-841 §7 Α21.20)
 *
 * Σχήμα κανόνα: `read: if false` · `write: if false`.
 *
 * 🔴 **ΤΟ ΚΕΛΙ ΠΟΥ ΕΧΕΙ ΣΗΜΑΣΙΑ ΕΙΝΑΙ Η ΔΙΑΓΡΑΦΗ/ΕΠΑΝΕΓΓΡΑΦΗ**: ο επαγγελματίας που «καθαρίζει» μόνος
 * του την κατάσταση θα ξανάπαιρνε σήμα σε γραμματοκιβώτιο που **αποδεδειγμένα** δεν υπάρχει. Η θεραπεία
 * είναι νέα επιβεβαίωση μέσω συνδέσμου — ποτέ γραφή πελάτη.
 *
 * @since 2026-09-14 (ADR-841 §7 Α21.20)
 */

import { assertFails } from '@firebase/rules-unit-testing';

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';
import { getContext } from '../_harness/auth-contexts';
import { seedRecipientStanding } from '../_harness/seed-helpers-email-delivery';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'email_recipient_standing')!;

describe('email_recipient_standing.rules — η κατάσταση διεύθυνσης προκύπτει μόνο από συμβάντα', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    defineDenyAllCell(env, cell, COVERAGE.collection);
  }

  describe('🔴 ούτε διαχειριστής μισθωτή', () => {
    it('ΔΕΝ διαβάζει την κατάσταση — ούτε της δικής του διεύθυνσης', async () => {
      const id = await seedRecipientStanding(env());
      const admin = getContext(env(), 'same_tenant_admin');
      await assertFails(admin.firestore().collection('email_recipient_standing').doc(id).get());
    });

    it('🔴 ΔΕΝ «καθαρίζει» μόνος του την απόδειξη', async () => {
      const id = await seedRecipientStanding(env());
      const admin = getContext(env(), 'same_tenant_admin');
      await assertFails(admin.firestore().collection('email_recipient_standing').doc(id).delete());
      await assertFails(admin.firestore().collection('email_recipient_standing').doc(id).update({ mailboxAbsentAt: null }));
    });
  });
});
