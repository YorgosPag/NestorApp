/**
 * Firestore Rules — συλλογή `project_budget_lines` (ADR-917 Φ3β)
 *
 * Σχήμα κανόνα: `read: if false` · `write: if false` — **και οι δύο πλευρές** ανήκουν αποκλειστικά στο
 * `PUT/DELETE /api/projects/{projectId}/budget-lines/{costCode}` (εγγραφή) και στο ledger του διακομιστή (ανάγνωση).
 *
 * 🔴 **Το κελί που έχει σημασία είναι του ΙΔΙΟΥ μισθωτή.** Ο `denyAllMatrix` αρνείται σε όλους, οπότε χωρίς σπαρμένο
 * έγγραφο του **ίδιου** μισθωτή η μετάλλαξη `allow write: if resource.data.companyId == getUserCompanyId()` — το
 * «λογικό» χαλάρωμα — **δεν** θα κοκκίνιζε. Και εκείνη η εγγραφή είναι ακριβώς η ζημιά: προϋπολογισμός αλλαγμένος
 * χωρίς ίχνος, χωρίς έλεγχο αναθεώρησης, με κωδικό εκτός ταξινομίας ή αρνητικό ποσό.
 *
 * @since 2026-10-21 (ADR-917 Φ3β)
 */

import { assertFails } from '@firebase/rules-unit-testing';

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';
import { getContext, withSeedContext } from '../_harness/auth-contexts';

const COLLECTION = 'project_budget_lines';
const DOC_ID = 'pbl_seed_0001';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'project_budget_lines')!;

const BUDGET_LINE = {
  id: DOC_ID,
  companyId: SAME_TENANT_COMPANY_ID,
  projectId: 'proj_seed_0001',
  costCode: 'SOFT-PERMITS',
  amount: 12000,
  note: null,
  revision: 1,
  createdAt: '2026-10-21T09:00:00.000Z',
  createdBy: 'uid_seed_0001',
  updatedAt: '2026-10-21T09:00:00.000Z',
  updatedBy: 'uid_seed_0001',
  archivedAt: null,
};

describe('project_budget_lines.rules — ο προϋπολογισμός γράφεται ΜΟΝΟ από το API, ΚΑΙ ΣΤΙΣ ΔΥΟ ΠΛΕΥΡΕΣ', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    defineDenyAllCell(env, cell, COVERAGE.collection);
  }

  describe('🔴 ούτε ο ΙΔΙΟΣ ο μισθωτής', () => {
    beforeEach(async () => {
      await withSeedContext(env(), async (ctx) => {
        await ctx.firestore().collection(COLLECTION).doc(DOC_ID).set(BUDGET_LINE);
      });
    });

    it('ο διαχειριστής του γραφείου ΔΕΝ διαβάζει τη γραμμή απευθείας', async () => {
      const owner = getContext(env(), 'same_tenant_admin');
      await assertFails(owner.firestore().collection(COLLECTION).doc(DOC_ID).get());
    });

    it('🔴 ούτε ΓΡΑΦΕΙ — αλλιώς προϋπολογισμός χωρίς ίχνος και χωρίς έλεγχο αναθεώρησης', async () => {
      const owner = getContext(env(), 'same_tenant_admin');
      await assertFails(owner.firestore().collection(COLLECTION).doc(DOC_ID).set({ ...BUDGET_LINE, amount: -1 }));
    });

    it('ούτε σβήνει — η απόσυρση είναι αρχειοθέτηση με ίχνος', async () => {
      const owner = getContext(env(), 'same_tenant_admin');
      await assertFails(owner.firestore().collection(COLLECTION).doc(DOC_ID).delete());
    });
  });
});
