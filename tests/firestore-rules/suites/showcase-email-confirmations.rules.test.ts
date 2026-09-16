/**
 * Firestore Rules — συλλογή `showcase_email_confirmations` (ADR-841 §7 Α21.18)
 *
 * Σχήμα κανόνα: `read: if false` · `write: if false` — **και οι δύο πλευρές** ανήκουν
 * αποκλειστικά στον διακομιστή.
 *
 * 🔴 **ΤΑ ΔΥΟ ΚΕΛΙΑ ΠΟΥ ΕΧΟΥΝ ΣΗΜΑΣΙΑ ΕΙΝΑΙ ΤΟΥ ΙΔΙΟΚΤΗΤΗ**:
 * - **ανάγνωση** — το αίτημα κρατά διεύθυνση email και το `nonce` του συνδέσμου· «μα είναι το ΔΙΚΟ
 *   του αίτημα» θα άνοιγε τα email της κάρτας χωρίς όριο ρυθμού·
 * - **γραφή** — `state: 'confirmed'` από τον ίδιο = σήμα «λαμβάνει» χωρίς να πατηθεί ποτέ σύνδεσμος.
 *
 * @since 2026-09-14 (ADR-841 §7 Α21.18)
 */

import { assertFails } from '@firebase/rules-unit-testing';

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';
import { getContext } from '../_harness/auth-contexts';
import { seedShowcaseEmailConfirmation } from '../_harness/seed-helpers-mandate';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'showcase_email_confirmations',
)!;

describe('showcase_email_confirmations.rules — η επιβεβαίωση γράφεται μόνο από τον διακομιστή', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    defineDenyAllCell(env, cell, COVERAGE.collection);
  }

  describe('🔴 ούτε ο ΙΔΙΟΣ ο επαγγελματίας', () => {
    it('ο ιδιοκτήτης ΔΕΝ διαβάζει το αίτημά του απευθείας', async () => {
      const id = await seedShowcaseEmailConfirmation(env(), SAME_TENANT_COMPANY_ID);

      const owner = getContext(env(), 'same_tenant_admin');

      await assertFails(owner.firestore().collection('showcase_email_confirmations').doc(id).get());
    });

    it('🔴 ο ιδιοκτήτης ΔΕΝ επιβεβαιώνει μόνος του — αλλιώς το σήμα δεν αποδεικνύει τίποτα', async () => {
      const id = await seedShowcaseEmailConfirmation(env(), SAME_TENANT_COMPANY_ID);

      const owner = getContext(env(), 'same_tenant_admin');

      await assertFails(
        owner.firestore().collection('showcase_email_confirmations').doc(id).update({ state: 'confirmed' }),
      );
    });

    it('🔑 ούτε ανώνυμος — ο σύνδεσμος εξαργυρώνεται μόνο μέσω της διαδρομής με όριο ρυθμού', async () => {
      const id = await seedShowcaseEmailConfirmation(env(), SAME_TENANT_COMPANY_ID);

      const anonymous = getContext(env(), 'anonymous');

      await assertFails(anonymous.firestore().collection('showcase_email_confirmations').doc(id).get());
    });
  });
});
