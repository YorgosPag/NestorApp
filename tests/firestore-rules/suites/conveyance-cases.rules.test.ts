/**
 * Firestore Rules — συλλογή `conveyance_cases` (ADR-901 Φ1)
 *
 * Σχήμα κανόνα: `read: if false` · `write: if false` — η υπόθεση μεταβίβασης ανήκει
 * στον διακομιστή (`/api/conveyance-cases`).
 *
 * 🔴 Το κελί που έχει σημασία είναι του **ίδιου μισθωτή**: ο `denyAllMatrix` αρνείται σε
 * όλους, αλλά αν κανένα σπαρμένο έγγραφο δεν ανήκει στο `company-a`, η «λογική» μετάλλαξη
 *
 *     allow read: if resource.data.companyId == getUserCompanyId();
 *
 * δεν θα κοκκίνιζε ποτέ. Γι' αυτό η σουίτα σπέρνει υπόθεση του `company-a` και ρωτά
 * ρητά τον διαχειριστή του — σημειακά **και** με ερώτημα.
 *
 * @since 2026-10-02 (ADR-901 Φ1)
 */

import { assertFails } from '@firebase/rules-unit-testing';

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';
import { getContext, withSeedContext } from '../_harness/auth-contexts';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'conveyance_cases',
)!;

const CASE_ID = 'cvc_anchor_0001';

describe('conveyance_cases.rules — η υπόθεση μεταβίβασης ανήκει στον διακομιστή', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    defineDenyAllCell(env, cell, COVERAGE.collection);
  }

  describe('🔴 ούτε ο διαχειριστής του ΙΔΙΟΥ μισθωτή', () => {
    beforeEach(async () => {
      await withSeedContext(env(), async (ctx) => {
        await ctx.firestore().collection('conveyance_cases').doc(CASE_ID).set({
          id: CASE_ID,
          companyId: SAME_TENANT_COMPANY_ID,
          subject: { kind: 'property', propertyId: 'prop_anchor', buildingId: null, projectId: null, appurtenances: [] },
          storedState: 'open',
          version: 0,
        });
      });
    });

    it('σημειακή ανάγνωση της δικής του υπόθεσης ⇒ άρνηση', async () => {
      const admin = getContext(env(), 'same_tenant_admin');
      await assertFails(admin.firestore().collection('conveyance_cases').doc(CASE_ID).get());
    });

    it('ερώτημα φιλτραρισμένο στον δικό του μισθωτή ⇒ άρνηση', async () => {
      const admin = getContext(env(), 'same_tenant_admin');
      await assertFails(
        admin.firestore().collection('conveyance_cases').where('companyId', '==', SAME_TENANT_COMPANY_ID).get(),
      );
    });

    it('εγγραφή (π.χ. «ελέγχθηκε» χωρίς CAS/ίχνος) ⇒ άρνηση', async () => {
      const admin = getContext(env(), 'same_tenant_admin');
      await assertFails(
        admin.firestore().collection('conveyance_cases').doc(CASE_ID).update({ storedState: 'cancelled' }),
      );
    });
  });
});
