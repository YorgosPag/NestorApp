/**
 * Firestore Rules — συλλογή `objective_value_snapshots` (ADR-947 Δ3 · Φ2)
 *
 * Σχήμα κανόνα: `read: if false` · `write: if false` — **και οι δύο πλευρές** ανήκουν αποκλειστικά στο API των
 * στιγμιοτύπων (`/api/objective-value/snapshots`).
 *
 * 🔴 **Τα κελιά που έχουν σημασία είναι του ΙΔΙΟΥ γραφείου.** Χωρίς σπαρμένο στιγμιότυπο του **ίδιου** γραφείου, η
 * μετάλλαξη `allow read: if resource.data.companyId == getUserCompanyId()` — το «λογικό» χαλάρωμα — **δεν** θα
 * κοκκίνιζε. Και η ζημιά της εγγραφής είναι συγκεκριμένη: ποσό που **δεν** έβγαλε η μηχανή, με αποτύπωμα που δεν
 * ταιριάζει πια — ή, χειρότερα, «διορθωμένο» στιγμιότυπο που μοιάζει αμετάβλητο.
 *
 * @since 2026-11-23 (ADR-947 Φ2)
 */

import { assertFails } from '@firebase/rules-unit-testing';

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';
import { getContext, withSeedContext } from '../_harness/auth-contexts';

const COLLECTION = 'objective_value_snapshots';
const DOC_ID = 'ovsn_seed_0001';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'objective_value_snapshots')!;

const SNAPSHOT = {
  id: DOC_ID,
  schema: 1,
  digest: 'a'.repeat(64),
  companyId: SAME_TENANT_COMPANY_ID,
  createdAt: '2026-11-23T09:00:00.000Z',
  createdBy: 'uid_seed_0001',
  valuationDate: '2026-11-23',
  subject: { kind: 'freeform', label: 'Διαμέρισμα Α2' },
  zone: { kind: 'manual', price: 1500 },
  result: { kind: 'computed', form: 'residence', value: 120000, zonePrice: 1500, area: 80, factors: [] },
};

describe('objective_value_snapshots.rules — το στιγμιότυπο γράφεται και διαβάζεται ΜΟΝΟ από το API', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    defineDenyAllCell(env, cell, COVERAGE.collection);
  }

  describe('🔴 ούτε το ΙΔΙΟ το γραφείο-εκδότης', () => {
    beforeEach(async () => {
      await withSeedContext(env(), async (ctx) => {
        await ctx.firestore().collection(COLLECTION).doc(DOC_ID).set(SNAPSHOT);
      });
    });

    it('ο διαχειριστής του γραφείου ΔΕΝ διαβάζει το στιγμιότυπο απευθείας (η απόκλιση και το αποτύπωμα ζουν στον server)', async () => {
      const admin = getContext(env(), 'same_tenant_admin');
      await assertFails(admin.firestore().collection(COLLECTION).doc(DOC_ID).get());
    });

    it('🔴 ούτε «διορθώνει» το ποσό — το αμετάβλητο δεν αλλάζει ποτέ', async () => {
      const admin = getContext(env(), 'same_tenant_admin');
      await assertFails(admin.firestore().collection(COLLECTION).doc(DOC_ID).update({ 'result.value': 90000 }));
    });

    it('🔴 ούτε γράφει νέο στιγμιότυπο με ποσό που δεν έβγαλε η μηχανή', async () => {
      const admin = getContext(env(), 'same_tenant_admin');
      await assertFails(admin.firestore().collection(COLLECTION).doc('ovsn_seed_0002').set({ ...SNAPSHOT, id: 'ovsn_seed_0002' }));
    });

    it('ούτε σβήνει — η ιστορία ενός υπολογισμού δεν εξαφανίζεται', async () => {
      const admin = getContext(env(), 'same_tenant_admin');
      await assertFails(admin.firestore().collection(COLLECTION).doc(DOC_ID).delete());
    });
  });
});
