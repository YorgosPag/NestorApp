/**
 * Firestore Rules — συλλογή `document_requests` (ADR-942 Φ0 — «Ζήτησε έγγραφο» για κάθε είδος υπόθεσης)
 *
 * Σχήμα κανόνα: `read: if false` · `write: if false` — οικοδεσπότης **και** επαγγελματίες περνούν από τον διακομιστή.
 * Διάδοχος της `conveyance_document_requests` (ίδιες μεταλλάξεις, ίδιοι λόγοι):
 *
 *     allow read: if resource.data.companyId == getUserCompanyId();       // «ο οικοδεσπότης βλέπει τα αιτήματα της υπόθεσής του»
 *     allow create: if request.resource.data.requesterUid == request.auth.uid; // «ο αιτών γράφει το δικό του αίτημα»
 *
 * Η πρώτη λέει στον οικοδεσπότη τι ζήτησε ένας επαγγελματίας από άλλον (Α31). Η δεύτερη παρακάμπτει την
 * ντετερμινιστική ταυτότητα ανά ημέρα (anti-spam) και διαλέγει παραλήπτη από τον client (Α29). Γι' αυτό το σπαρμένο
 * έγγραφο ανήκει στον **ίδιο** μισθωτή **και** έχει αιτούντα μια persona της σουίτας.
 *
 * @since 2026-11-16 (ADR-942 Φ0)
 */

import { assertFails } from '@firebase/rules-unit-testing';

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { PERSONA_CLAIMS, SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';
import { getContext, withSeedContext } from '../_harness/auth-contexts';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'document_requests',
)!;

const REQUEST_ID = 'cdr_anchor_0101';
const REQUESTER = PERSONA_CLAIMS.external_user.uid;

function requestDoc(id: string) {
  return {
    id,
    companyId: SAME_TENANT_COMPANY_ID,
    subject: { kind: 'conveyance_case', id: 'cvc_anchor_0001' },
    projectId: null,
    itemId: 'buyer_mortgage_approval',
    requesterRole: 'notary',
    requesterUid: REQUESTER,
    recipient: 'buyer_lawyer',
    dayKey: '2026-11-16',
    requestedAt: '2026-11-16T08:00:00.000Z',
    notifiedAt: null,
  };
}

describe('document_requests.rules — το αίτημα εγγράφου ανήκει στον διακομιστή', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    defineDenyAllCell(env, cell, COVERAGE.collection);
  }

  describe('🔴 ούτε ο οικοδεσπότης ούτε ο ίδιος ο αιτών', () => {
    beforeEach(async () => {
      await withSeedContext(env(), async (ctx) => {
        await ctx.firestore().collection('document_requests').doc(REQUEST_ID).set(requestDoc(REQUEST_ID));
      });
    });

    it('ο διαχειριστής του ΙΔΙΟΥ μισθωτή διαβάζει αίτημα ανάμεσα σε τρίτους ⇒ άρνηση (Α31)', async () => {
      const admin = getContext(env(), 'same_tenant_admin');
      await assertFails(admin.firestore().collection('document_requests').doc(REQUEST_ID).get());
    });

    it('ερώτημα φιλτραρισμένο στον δικό του μισθωτή και στην υπόθεση ⇒ άρνηση', async () => {
      const admin = getContext(env(), 'same_tenant_admin');
      await assertFails(
        admin.firestore().collection('document_requests')
          .where('companyId', '==', SAME_TENANT_COMPANY_ID)
          .where('subject.kind', '==', 'conveyance_case')
          .where('subject.id', '==', 'cvc_anchor_0001')
          .get(),
      );
    });

    it('ο αιτών γράφει δικό του αίτημα με παραλήπτη της επιλογής του ⇒ άρνηση (Α29)', async () => {
      const requester = getContext(env(), 'external_user');
      await assertFails(
        requester.firestore().collection('document_requests').doc('cdr_anchor_0102')
          .set({ ...requestDoc('cdr_anchor_0102'), recipient: 'host' }),
      );
    });

    it('ο αιτών «ξανανοίγει» σημερινό αίτημα (μηδενίζει την ειδοποίηση) ⇒ άρνηση', async () => {
      const requester = getContext(env(), 'external_user');
      await assertFails(
        requester.firestore().collection('document_requests').doc(REQUEST_ID).update({ notifiedAt: null, dayKey: '2026-11-17' }),
      );
    });
  });
});
