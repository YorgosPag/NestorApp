/**
 * Firestore Rules — συλλογή `property_upkeep_declarations` (ADR-915 §35)
 *
 * Σχήμα κανόνα: `read: if false` · `write: if false` — **και οι δύο πλευρές** ανήκουν αποκλειστικά στο
 * `PUT /api/document-registry/upkeep-declarations`.
 *
 * 🔴 **Το κελί που έχει σημασία είναι του ΙΔΙΟΥ μισθωτή.** Ο `denyAllMatrix` αρνείται σε όλους, οπότε χωρίς σπαρμένο
 * έγγραφο του **ίδιου** μισθωτή η μετάλλαξη `allow write: if resource.data.companyId == getUserCompanyId()` — το
 * «λογικό» χαλάρωμα — **δεν** θα κοκκίνιζε. Και εκείνη η εγγραφή είναι ακριβώς η ζημιά: «λείπει ΥΔΕ» γεννημένο ή
 * σβησμένο χωρίς ίχνος, ή `proposalAtDecision` γραμμένο από τον πελάτη («η εφαρμογή το πρότεινε» — ψέμα).
 *
 * @since 2026-10-18 (ADR-915 §35)
 */

import { assertFails } from '@firebase/rules-unit-testing';

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';
import { getContext, withSeedContext } from '../_harness/auth-contexts';

const COLLECTION = 'property_upkeep_declarations';
const DOC_ID = 'pupk_seed_0001';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'property_upkeep_declarations')!;

const DECLARATION = {
  id: DOC_ID,
  companyId: SAME_TENANT_COMPANY_ID,
  propertyId: 'prop_seed_0001',
  scope: 'property',
  documentKind: 'electrical-installation',
  decision: 'required',
  exemptionReason: null,
  proposalAtDecision: { verdict: 'proposed', reason: 'in-use', propertyClass: 'residential', phase: 'ready' },
  declaredByUid: 'uid_seed_0001',
  declaredAt: '2026-10-18T09:00:00.000Z',
};

describe('property_upkeep_declarations.rules — η απόφαση γράφεται ΜΟΝΟ από το API, ΚΑΙ ΣΤΙΣ ΔΥΟ ΠΛΕΥΡΕΣ', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    defineDenyAllCell(env, cell, COVERAGE.collection);
  }

  describe('🔴 ούτε ο ΙΔΙΟΣ ο μισθωτής', () => {
    beforeEach(async () => {
      await withSeedContext(env(), async (ctx) => {
        await ctx.firestore().collection(COLLECTION).doc(DOC_ID).set(DECLARATION);
      });
    });

    it('ο διαχειριστής του γραφείου ΔΕΝ διαβάζει την απόφαση απευθείας', async () => {
      const owner = getContext(env(), 'same_tenant_admin');
      await assertFails(owner.firestore().collection(COLLECTION).doc(DOC_ID).get());
    });

    it('🔴 ούτε ΓΡΑΦΕΙ — αλλιώς εξαίρεση χωρίς λόγο και χωρίς ίχνος, ή ψεύτικη «πρόταση της εφαρμογής»', async () => {
      const owner = getContext(env(), 'same_tenant_admin');
      await assertFails(owner.firestore().collection(COLLECTION).doc(DOC_ID).set({ ...DECLARATION, decision: 'not-required' }));
    });

    it('ούτε σβήνει — το «ξανά ρώτα» είναι κι αυτό απόφαση με ίχνος', async () => {
      const owner = getContext(env(), 'same_tenant_admin');
      await assertFails(owner.firestore().collection(COLLECTION).doc(DOC_ID).delete());
    });
  });
});
