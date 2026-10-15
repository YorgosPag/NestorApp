/**
 * Firestore Rules — συλλογή `document_expiry_alert_ledgers` (ADR-915 Φ5α · §12)
 *
 * Σχήμα κανόνα: `read: if false` · `write: if false` — **και οι δύο πλευρές** ανήκουν αποκλειστικά στη σάρωση.
 *
 * 🔴 **Το κελί που έχει σημασία είναι του ΙΔΙΟΚΤΗΤΗ.** Ο `denyAllMatrix` αρνείται σε όλους, οπότε χωρίς σπαρμένο
 * έγγραφο του **ίδιου** μισθωτή η μετάλλαξη `allow write: if companyId == getUserCompanyId()` — το «λογικό»
 * χαλάρωμα («μα είναι το δικό μου γραφείο») — **δεν** θα κοκκίνιζε. Και εκείνη η εγγραφή είναι ακριβώς η ζημιά:
 * ένα στάδιο «ειπωμένο» που δεν ειπώθηκε ποτέ ⇒ η ειδοποίηση **φιμώνεται**.
 *
 * @since 2026-10-15 (ADR-915 Φ5α)
 */

import { assertFails } from '@firebase/rules-unit-testing';

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';
import { getContext, withSeedContext } from '../_harness/auth-contexts';

const COLLECTION = 'document_expiry_alert_ledgers';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'document_expiry_alert_ledgers')!;

const LEDGER = {
  companyId: SAME_TENANT_COMPANY_ID,
  rows: [{ rowId: 'file:file_seed_0001', stage: 'd30', expiresOn: '2026-11-01' }],
  asOf: '2026-10-15',
  updatedAt: '2026-10-15T05:21:00.000Z',
};

describe('document_expiry_alert_ledgers.rules — το «ειπωμένο» ανήκει στη σάρωση, ΚΑΙ ΣΤΙΣ ΔΥΟ ΠΛΕΥΡΕΣ', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    defineDenyAllCell(env, cell, COVERAGE.collection);
  }

  describe('🔴 ούτε ο ΙΔΙΟΣ ο μισθωτής', () => {
    beforeEach(async () => {
      await withSeedContext(env(), async (ctx) => {
        await ctx.firestore().collection(COLLECTION).doc(SAME_TENANT_COMPANY_ID).set(LEDGER);
      });
    });

    it('ο διαχειριστής του γραφείου ΔΕΝ διαβάζει το ημερολόγιό του', async () => {
      const owner = getContext(env(), 'same_tenant_admin');
      await assertFails(owner.firestore().collection(COLLECTION).doc(SAME_TENANT_COMPANY_ID).get());
    });

    it('🔴 ούτε ΓΡΑΦΕΙ το δικό του — αλλιώς «λέει» στάδια που δεν ειπώθηκαν και φιμώνει την ειδοποίηση', async () => {
      const owner = getContext(env(), 'same_tenant_admin');
      await assertFails(owner.firestore().collection(COLLECTION).doc(SAME_TENANT_COMPANY_ID).set({
        ...LEDGER,
        rows: [{ rowId: 'file:file_seed_0001', stage: 'expired', expiresOn: '2026-11-01' }],
      }));
    });
  });
});
