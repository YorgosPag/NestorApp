/**
 * Firestore Rules — συλλογή `engagement_invitations` (ADR-901 Φ3)
 *
 * Σχήμα κανόνα: `read: if false` · `write: if false` — οικοδεσπότης **και** επαγγελματίας περνούν από τον διακομιστή.
 *
 * 🔴 Το κελί που έχει σημασία είναι του **ίδιου μισθωτή**: ο `denyAllMatrix` αρνείται σε όλους, αλλά αν κανένα
 * σπαρμένο έγγραφο δεν ανήκει στο `company-a`, η «λογική» μετάλλαξη
 *
 *     allow read: if resource.data.hostCompanyId == getUserCompanyId();
 *
 * («μα ο οικοδεσπότης πρέπει να βλέπει τις προσκλήσεις του!») δεν θα κοκκίνιζε ποτέ — και θα του έδινε το
 * `nonceHash`, δηλαδή τη δυνατότητα να εξαργυρώσει ως ο δικηγόρος. Η **γραφή** είναι χειρότερη: πρόσκληση με
 * ήδη γραμμένες συναινέσεις παρακάμπτει την Ε-3, που κρίνεται **μόνο** στην έκδοση.
 *
 * 🔶 Ο άξονας του email **δεν** εκτελείται εδώ (`PersonaClaims` χωρίς email) — η δέσμευση παραλήπτη αποδεικνύεται
 * εκεί όπου εκτελείται: `src/server/engagement-invitations/__tests__/engagement-invitation.test.ts` (άγκυρα Α2).
 *
 * @since 2026-10-03 (ADR-901 Φ3)
 */

import { assertFails } from '@firebase/rules-unit-testing';

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';
import { getContext, withSeedContext } from '../_harness/auth-contexts';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'engagement_invitations',
)!;

const INVITATION_ID = 'einv_anchor_0001';

describe('engagement_invitations.rules — η πρόσκληση υπόθεσης ανήκει στον διακομιστή', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    defineDenyAllCell(env, cell, COVERAGE.collection);
  }

  describe('🔴 ούτε ο διαχειριστής του ΙΔΙΟΥ μισθωτή (οικοδεσπότη)', () => {
    beforeEach(async () => {
      await withSeedContext(env(), async (ctx) => {
        await ctx.firestore().collection('engagement_invitations').doc(INVITATION_ID).set({
          id: INVITATION_ID,
          hostCompanyId: SAME_TENANT_COMPANY_ID,
          caseId: 'cvc_anchor_0001',
          role: 'notary',
          inviteeEmail: 'notary.seed@example.gr',
          nonceHash: 'seed-hash',
          state: 'pending',
        });
      });
    });

    it('σημειακή ανάγνωση της δικής του πρόσκλησης ⇒ άρνηση (θα έδινε το nonceHash)', async () => {
      const admin = getContext(env(), 'same_tenant_admin');
      await assertFails(admin.firestore().collection('engagement_invitations').doc(INVITATION_ID).get());
    });

    it('ερώτημα φιλτραρισμένο στον δικό του μισθωτή ⇒ άρνηση', async () => {
      const admin = getContext(env(), 'same_tenant_admin');
      await assertFails(
        admin.firestore().collection('engagement_invitations').where('hostCompanyId', '==', SAME_TENANT_COMPANY_ID).get(),
      );
    });

    it('γραφή συναινέσεων από τον πελάτη (παράκαμψη Ε-3) ⇒ άρνηση', async () => {
      const admin = getContext(env(), 'same_tenant_admin');
      await assertFails(
        admin.firestore().collection('engagement_invitations').doc(INVITATION_ID).update({ consents: [] }),
      );
    });
  });
});
