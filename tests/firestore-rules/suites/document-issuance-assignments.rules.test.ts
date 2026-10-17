/**
 * Firestore Rules — συλλογή `document_issuance_assignments` (ADR-915 §27)
 *
 * Σχήμα κανόνα: `read: if false` · `write: if false` — **και οι δύο πλευρές** ανήκουν αποκλειστικά στο
 * `PUT /api/document-registry/issuance-assignments`.
 *
 * 🔴 **Το κελί που έχει σημασία είναι του ΙΔΙΟΥ μισθωτή.** Χωρίς σπαρμένο έγγραφο του **ίδιου** γραφείου, η μετάλλαξη
 * `allow write: if resource.data.companyId == getUserCompanyId()` — το «λογικό» χαλάρωμα — **δεν** θα κοκκίνιζε. Και
 * εκείνη η εγγραφή είναι ακριβώς η ζημιά: `decision` χωρίς απόφαση του υπευθύνου ιδιοκτήτη ⇒ η οθόνη γράφει
 * «Ανατέθηκε», χωρίς ίχνος στο ιστορικό.
 *
 * @since 2026-10-17 (ADR-915 §27)
 */

import { assertFails } from '@firebase/rules-unit-testing';

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';
import { getContext, withSeedContext } from '../_harness/auth-contexts';

const COLLECTION = 'document_issuance_assignments';
const DOC_ID = 'dias_seed_0001';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'document_issuance_assignments')!;

const ASSIGNMENT = {
  id: DOC_ID,
  companyId: SAME_TENANT_COMPANY_ID,
  propertyId: 'prop_seed_0001',
  scope: 'property',
  documentKind: 'energy-certificate',
  professionalContactId: 'cont_seed_0001',
  credential: { qualification: 'energy-inspector-registered', registryNumber: null },
  proposedAt: '2026-10-17T09:00:00.000Z',
  proposedByUid: 'uid_seed_0001',
  decision: null,
  notice: null,
  response: null,
  cancellation: null,
  updatedAt: '2026-10-17T09:00:00.000Z',
};

const FORGED_DECISION = {
  outcome: 'approved',
  ownerContactId: 'cont_not_the_lead',
  basis: 'recorded-instruction',
  channel: 'phone',
  note: null,
  recordedByUid: 'uid_seed_0001',
  at: '2026-10-17T10:00:00.000Z',
};

describe('document_issuance_assignments.rules — η ανάθεση γράφεται ΜΟΝΟ από το API, ΚΑΙ ΣΤΙΣ ΔΥΟ ΠΛΕΥΡΕΣ', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    defineDenyAllCell(env, cell, COVERAGE.collection);
  }

  describe('🔴 ούτε ο ΙΔΙΟΣ ο μισθωτής', () => {
    beforeEach(async () => {
      await withSeedContext(env(), async (ctx) => {
        await ctx.firestore().collection(COLLECTION).doc(DOC_ID).set(ASSIGNMENT);
      });
    });

    it('ο διαχειριστής του γραφείου ΔΕΝ διαβάζει την ανάθεση απευθείας', async () => {
      const admin = getContext(env(), 'same_tenant_admin');
      await assertFails(admin.firestore().collection(COLLECTION).doc(DOC_ID).get());
    });

    it('🔴 ούτε ΓΡΑΦΕΙ απόφαση — αλλιώς «Ανατέθηκε» χωρίς τον υπεύθυνο ιδιοκτήτη, χωρίς ιστορικό', async () => {
      const admin = getContext(env(), 'same_tenant_admin');
      await assertFails(admin.firestore().collection(COLLECTION).doc(DOC_ID).update({ decision: FORGED_DECISION }));
    });

    it('ούτε σβήνει — μια ακύρωση είναι κι αυτή γεγονός με ίχνος', async () => {
      const admin = getContext(env(), 'same_tenant_admin');
      await assertFails(admin.firestore().collection(COLLECTION).doc(DOC_ID).delete());
    });
  });
});
