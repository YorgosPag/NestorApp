/**
 * Firestore Rules — συλλογή `holiday_hours_questions` (ADR-841 §7 Α21.21 Φάση Β)
 *
 * Σχήμα κανόνα: `read: if false` · `write: if false` — **και οι δύο πλευρές** ανήκουν αποκλειστικά στον διακομιστή.
 *
 * 🔴 **ΤΑ ΚΕΛΙΑ ΠΟΥ ΕΧΟΥΝ ΣΗΜΑΣΙΑ ΕΙΝΑΙ ΤΟΥ ΔΙΑΧΕΙΡΙΣΤΗ**:
 * - **ανάγνωση** — η ερώτηση κρατά το `nonce` των συνδέσμων· «μα είναι του ΔΙΚΟΥ του γραφείου» θα έδινε συνδέσμους
 *   χωρίς όριο ρυθμού·
 * - **γραφή** — `state: 'answered'` από τον ίδιο = ερώτηση που «απαντήθηκε» χωρίς να γραφτεί ποτέ ειδική μέρα.
 *
 * @since 2026-09-15 (ADR-841 §7 Α21.21 Φάση Β)
 */

import { assertFails } from '@firebase/rules-unit-testing';

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';
import { getContext } from '../_harness/auth-contexts';
import { seedHolidayHoursQuestion } from '../_harness/seed-helpers-mandate';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'holiday_hours_questions',
)!;

describe('holiday_hours_questions.rules — η ερώτηση αργιών απαντιέται μόνο από τον διακομιστή', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    defineDenyAllCell(env, cell, COVERAGE.collection);
  }

  describe('τα κελιά που έχουν σημασία', () => {
    it('🔴 ο διαχειριστής ΔΕΝ διαβάζει την ερώτηση του γραφείου του — κρατά το nonce των συνδέσμων', async () => {
      const id = await seedHolidayHoursQuestion(env(), SAME_TENANT_COMPANY_ID);

      const admin = getContext(env(), 'same_tenant_admin');

      await assertFails(admin.firestore().collection('holiday_hours_questions').doc(id).get());
    });

    it('🔴 ο διαχειριστής ΔΕΝ τη σημειώνει «απαντημένη» μόνος του — θα έσβηνε ερώτηση χωρίς ειδική μέρα', async () => {
      const id = await seedHolidayHoursQuestion(env(), SAME_TENANT_COMPANY_ID);

      const admin = getContext(env(), 'same_tenant_admin');

      await assertFails(
        admin.firestore().collection('holiday_hours_questions').doc(id).update({ state: 'answered' }),
      );
    });

    it('🔑 ούτε ανώνυμος — η απάντηση περνά μόνο από τη διαδρομή με όριο ρυθμού', async () => {
      const id = await seedHolidayHoursQuestion(env(), SAME_TENANT_COMPANY_ID);

      const anonymous = getContext(env(), 'unauthenticated');

      await assertFails(anonymous.firestore().collection('holiday_hours_questions').doc(id).get());
    });
  });
});
