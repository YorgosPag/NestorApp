/**
 * Firestore Rules — συλλογή `workspace_access_requests` (ADR-660 §6)
 *
 * Σχήμα κανόνα: `read: if false` · `write: if false` — λίστα διαχειριστή και κατάσταση
 * αιτούντα περνούν από διαδρομές διακομιστή.
 *
 * 🔴 **Ο ΚΙΝΔΥΝΟΣ ΕΙΝΑΙ Η ΑΥΤΟ-ΕΓΚΡΙΣΗ**: αιτών που γράφει `status: 'approved'` στο **δικό
 * του** αίτημα θα έβλεπε τον εαυτό του «εγκεκριμένο» σε κάθε οθόνη που το εμπιστεύεται.
 *
 * ⚠️ Ο `denyAllMatrix` περνά **ούτως ή άλλως** αν κανένα έγγραφο δεν αφορά τον δοκιμαζόμενο —
 * γι' αυτό η άγκυρα γράφει αίτημα **με το δικό του uid** ως αιτούντα.
 *
 * @since 2026-09-11 (ADR-660 §6)
 */

import { assertFails } from '@firebase/rules-unit-testing';

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';
import { getContext } from '../_harness/auth-contexts';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'workspace_access_requests',
)!;

describe('workspace_access_requests.rules — κανείς δεν εγκρίνει τον εαυτό του', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    defineDenyAllCell(env, cell, COVERAGE.collection);
  }

  describe('🔴 ούτε ο ΑΙΤΩΝ, για το ΔΙΚΟ ΤΟΥ αίτημα', () => {
    it('δεν γράφει `approved` στο αίτημα που φέρει το δικό του uid', async () => {
      const requester = getContext(env(), 'external_user');

      await assertFails(
        requester.firestore().collection('workspace_access_requests').doc('wacr_anchor_0001').set({
          id: 'wacr_anchor_0001',
          companyId: SAME_TENANT_COMPANY_ID,
          requesterUid: 'external_user',
          requesterEmail: 'external@example.com',
          status: 'approved',
        }),
      );
    });
  });
});
