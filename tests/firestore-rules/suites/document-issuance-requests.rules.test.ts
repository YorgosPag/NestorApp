/**
 * Firestore Rules — συλλογή `document_issuance_requests` (ADR-945 §7.2)
 *
 * Σχήμα κανόνα: `read: if false` · `write: if false` — **και οι δύο πλευρές** ανήκουν αποκλειστικά στο API των αιτημάτων
 * προσφορών (`/api/document-registry/issuance-requests`).
 *
 * 🔴 **Τα κελιά που έχουν σημασία είναι του ΙΔΙΟΥ κατόχου.** Χωρίς σπαρμένο αίτημα του **ίδιου** γραφείου και αίτημα του
 * **ίδιου** ιδιώτη, οι μεταλλάξεις `allow write: if resource.data.companyId == getUserCompanyId()` και
 * `… resource.data.userId == request.auth.uid` — τα «λογικά» χαλαρώματα — **δεν** θα κοκκίνιζαν. Και εκείνη η εγγραφή
 * είναι ακριβώς η ζημιά: `award` χωρίς απόφαση στη νικήτρια, ή τέταρτη προσφορά, χωρίς ίχνος.
 *
 * @since 2026-11-18 (ADR-945 §7.2)
 */

import { assertFails } from '@firebase/rules-unit-testing';

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { PERSONA_CLAIMS, SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';
import { getContext, withSeedContext } from '../_harness/auth-contexts';

const COLLECTION = 'document_issuance_requests';
const OFFICE_DOC_ID = 'disr_seed_0001';
const PERSONAL_DOC_ID = 'disr_seed_0002';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'document_issuance_requests')!;

const BASE = {
  propertyId: 'prop_seed_0001',
  scope: 'property',
  documentKind: 'energy-certificate',
  cycle: 1,
  bids: [{
    bidId: 'dibd_seed_0001',
    professional: { kind: 'workspace', companyId: 'comp_seed_pro_0001' },
    invitedAt: '2026-11-18T09:00:00.000Z',
    invitedByUid: 'uid_seed_0001',
  }],
  award: null,
  closure: null,
  updatedAt: '2026-11-18T09:00:00.000Z',
};

const OFFICE_REQUEST = { ...BASE, id: OFFICE_DOC_ID, companyId: SAME_TENANT_COMPANY_ID };
/** Ο κάτοχος είναι ο ίδιος ο χρήστης της persona — το κελί που θα άνοιγε το χαλάρωμα `userId == auth.uid`. */
const PERSONAL_REQUEST = { ...BASE, id: PERSONAL_DOC_ID, userId: PERSONA_CLAIMS.same_tenant_user.uid };

const FORGED_AWARD = { bidId: 'dibd_seed_0001', at: '2026-11-18T10:00:00.000Z', byUid: 'uid_seed_0001' };

describe('document_issuance_requests.rules — το αίτημα γράφεται ΜΟΝΟ από το API, ΚΑΙ ΣΤΙΣ ΔΥΟ ΠΛΕΥΡΕΣ', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    defineDenyAllCell(env, cell, COVERAGE.collection);
  }

  describe('🔴 ούτε ο ΙΔΙΟΣ ο κάτοχος', () => {
    beforeEach(async () => {
      await withSeedContext(env(), async (ctx) => {
        await ctx.firestore().collection(COLLECTION).doc(OFFICE_DOC_ID).set(OFFICE_REQUEST);
        await ctx.firestore().collection(COLLECTION).doc(PERSONAL_DOC_ID).set(PERSONAL_REQUEST);
      });
    });

    it('ο διαχειριστής του γραφείου ΔΕΝ διαβάζει το αίτημα απευθείας', async () => {
      const admin = getContext(env(), 'same_tenant_admin');
      await assertFails(admin.firestore().collection(COLLECTION).doc(OFFICE_DOC_ID).get());
    });

    it('🔴 ούτε ΓΡΑΦΕΙ νικήτρια — αλλιώς «Ανατέθηκε» χωρίς απόφαση στην προσφορά, χωρίς ιστορικό', async () => {
      const admin = getContext(env(), 'same_tenant_admin');
      await assertFails(admin.firestore().collection(COLLECTION).doc(OFFICE_DOC_ID).update({ award: FORGED_AWARD }));
    });

    it('🔴 ο ιδιώτης ΔΕΝ διαβάζει ούτε το ΔΙΚΟ του αίτημα απευθείας', async () => {
      const owner = getContext(env(), 'same_tenant_user');
      await assertFails(owner.firestore().collection(COLLECTION).doc(PERSONAL_DOC_ID).get());
    });

    it('🔴 ούτε προσθέτει τέταρτη προσφορά στο δικό του αίτημα', async () => {
      const owner = getContext(env(), 'same_tenant_user');
      await assertFails(owner.firestore().collection(COLLECTION).doc(PERSONAL_DOC_ID).update({ bids: [...BASE.bids, ...BASE.bids, ...BASE.bids, ...BASE.bids] }));
    });

    it('ούτε σβήνει — η ακύρωση αιτήματος κλείνει και τις προσφορές, με ίχνος', async () => {
      const owner = getContext(env(), 'same_tenant_user');
      await assertFails(owner.firestore().collection(COLLECTION).doc(PERSONAL_DOC_ID).delete());
    });
  });
});
