/**
 * Firestore Rules — συλλογή `auth_reprovision_journal` (ADR-844 §13.8)
 *
 * Σχήμα κανόνα: `read: if false` · `write: if false` — μόνο ο διακομιστής.
 *
 * 🔴 **Ο ΚΙΝΔΥΝΟΣ ΕΙΝΑΙ Η ΓΡΑΦΗ, ΚΑΙ ΕΙΝΑΙ ΣΥΓΚΕΚΡΙΜΕΝΟΣ**: το έγγραφο λέει στην επόμενη
 * απόδειξη email *«ξαναχτίζεις το uid Χ»*. Πελάτης που γράφει `{ uid: <δικό μου>, email:
 * <του θύματος> }` θα έκανε τη **δική μας** συνέχιση να δώσει το γραμματοκιβώτιο του
 * θύματος σε λογαριασμό που **εκείνος** διάλεξε — με τα δεδομένα που **εκείνος** είχε
 * σπείρει κάτω από αυτό το uid.
 *
 * ⚠️ Ο `denyAllMatrix` περνά **ούτως ή άλλως** αν κανένα σπαρμένο έγγραφο δεν αφορά τον
 * δοκιμαζόμενο — γι' αυτό η άγκυρα γράφει **με το δικό του uid μέσα**.
 *
 * @since 2026-09-11 (ADR-844 §13.8)
 */

import { assertFails } from '@firebase/rules-unit-testing';

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';
import { getContext } from '../_harness/auth-contexts';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'auth_reprovision_journal',
)!;

describe('auth_reprovision_journal.rules — όποιος το γράφει διαλέγει ποιος παίρνει ξένο email', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    defineDenyAllCell(env, cell, COVERAGE.collection);
  }

  describe('🔴 ούτε ΔΙΑΧΕΙΡΙΣΤΗΣ, ούτε με το ΔΙΚΟ ΤΟΥ uid μέσα', () => {
    it('δεν γράφει εγγραφή που θα έδινε ξένο γραμματοκιβώτιο στον δικό του λογαριασμό', async () => {
      const admin = getContext(env(), 'same_tenant_admin');
      const ownUid = 'same_tenant_admin';

      await assertFails(
        admin.firestore().collection('auth_reprovision_journal').doc('arj_anchor_0001').set({
          uid: ownUid,
          email: 'victim@example.com',
          displayName: null,
          photoURL: null,
          customClaims: null,
        }),
      );
    });
  });
});
