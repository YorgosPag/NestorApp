/**
 * Firestore Rules — συλλογή `document_obligor_designations` (ADR-915 §26)
 *
 * Σχήμα κανόνα: `read: if false` · `write: if false` — **και οι δύο πλευρές** ανήκουν αποκλειστικά στο
 * `PUT /api/document-registry/obligor-designations`.
 *
 * 🔴 **Το κελί που έχει σημασία είναι του ΙΔΙΟΚΤΗΤΗ.** Ο `denyAllMatrix` αρνείται σε όλους, οπότε χωρίς σπαρμένο
 * έγγραφο του **ίδιου** μισθωτή η μετάλλαξη `allow write: if resource.data.companyId == getUserCompanyId()` — το
 * «λογικό» χαλάρωμα — **δεν** θα κοκκίνιζε. Και εκείνη η εγγραφή είναι ακριβώς η ζημιά: «υπεύθυνος» ένας **μη**
 * ιδιοκτήτης (ο έλεγχος ζει μόνο στο API), χωρίς ίχνος στο ιστορικό.
 *
 * @since 2026-10-17 (ADR-915 §26)
 */

import { assertFails } from '@firebase/rules-unit-testing';

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';
import { getContext, withSeedContext } from '../_harness/auth-contexts';

const COLLECTION = 'document_obligor_designations';
const DOC_ID = 'dobd_seed_0001';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'document_obligor_designations')!;

const DESIGNATION = {
  id: DOC_ID,
  companyId: SAME_TENANT_COMPANY_ID,
  propertyId: 'prop_seed_0001',
  scope: 'property',
  contactId: 'cont_seed_0001',
  designatedByUid: 'uid_seed_0001',
  designatedAt: '2026-10-17T09:00:00.000Z',
};

describe('document_obligor_designations.rules — ο υπεύθυνος ορίζεται ΜΟΝΟ από το API, ΚΑΙ ΣΤΙΣ ΔΥΟ ΠΛΕΥΡΕΣ', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    defineDenyAllCell(env, cell, COVERAGE.collection);
  }

  describe('🔴 ούτε ο ΙΔΙΟΣ ο μισθωτής', () => {
    beforeEach(async () => {
      await withSeedContext(env(), async (ctx) => {
        await ctx.firestore().collection(COLLECTION).doc(DOC_ID).set(DESIGNATION);
      });
    });

    it('ο διαχειριστής του γραφείου ΔΕΝ διαβάζει τον ορισμό απευθείας', async () => {
      const owner = getContext(env(), 'same_tenant_admin');
      await assertFails(owner.firestore().collection(COLLECTION).doc(DOC_ID).get());
    });

    it('🔴 ούτε ΓΡΑΦΕΙ — αλλιώς «υπεύθυνος» γίνεται κάποιος που ΔΕΝ είναι ιδιοκτήτης, χωρίς ιστορικό', async () => {
      const owner = getContext(env(), 'same_tenant_admin');
      await assertFails(owner.firestore().collection(COLLECTION).doc(DOC_ID).set({ ...DESIGNATION, contactId: 'cont_not_owner' }));
    });

    it('ούτε σβήνει — η επαναφορά στην αυτόματη επιλογή είναι κι αυτή αλλαγή με ίχνος', async () => {
      const owner = getContext(env(), 'same_tenant_admin');
      await assertFails(owner.firestore().collection(COLLECTION).doc(DOC_ID).delete());
    });
  });
});
