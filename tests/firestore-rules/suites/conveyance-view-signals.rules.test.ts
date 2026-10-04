/**
 * ADR-901 §14.8 — `conveyance_view_signals`: «η όψη ΣΟΥ άλλαξε», και τίποτα άλλο.
 *
 * Ο πίνακας των 35 μετρά την όψη του **οικοδεσπότη** (`companyId`). Οι άγκυρες φρουρούν όσα ένας πίνακας ενός
 * εγγράφου δεν μπορεί να πει:
 *   - Σ1 — η όψη **συμμετοχής** (`uid`) τη διαβάζει **μόνο** ο επαγγελματίας· όχι ο διαχειριστής του χώρου-οικοδεσπότη
 *          (θα μάθαινε *πότε* δουλεύει ο δικηγόρος — ο χρονισμός ως πληροφορία)
 *   - Σ2 — ο ιδιώτης **χωρίς** εταιρεία ΔΕΝ διαβάζει όψη οικοδεσπότη (η παγίδα `get('companyId', null)` ⇒ `null == null`)
 *   - Σ3 — το **ανύπαρκτο** σήμα διαβάζεται από κάθε πιστοποιημένο: ο listener ανοίγει πριν την πρώτη αύξηση
 *   - Σ4 — κανείς δεν «αυξάνει» μόνος του (ψεύτικη ανανέωση = άρνηση υπηρεσίας στην οθόνη του άλλου)
 */

import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

import { assertCell, type AssertTarget } from '../_harness/assertions';
import { getContext, withSeedContext } from '../_harness/auth-contexts';
import { initEmulator, resetData, teardownEmulator } from '../_harness/emulator';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { PERSONA_CLAIMS, SAME_TENANT_COMPANY_ID } from '../_registry/personas';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'conveyance_view_signals',
)!;

const SIGNALS = 'conveyance_view_signals';
const HOST_SIGNAL = 'cvs_host_anchor_0001';
const ENGAGEMENT_SIGNAL = 'cvs_eng_anchor_0001';
const PROFESSIONAL = PERSONA_CLAIMS.same_tenant_user.uid;

async function seed(env: RulesTestEnvironment): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection(SIGNALS).doc(HOST_SIGNAL).set({ companyId: SAME_TENANT_COMPANY_ID, revision: 3 });
    await ctx.firestore().collection(SIGNALS).doc(ENGAGEMENT_SIGNAL).set({ uid: PROFESSIONAL, revision: 7 });
  });
}

describe('conveyance_view_signals.rules — ο κάτοχος διαβάζει, κανείς δεν γράφει (ADR-901 §14.8)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => {
    env = await initEmulator();
  });

  afterAll(async () => {
    await teardownEmulator(env);
  });

  afterEach(async () => {
    await resetData(env);
  });

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        await seed(env);
        const target: AssertTarget = {
          collection: SIGNALS,
          docId: HOST_SIGNAL,
          data: { revision: 99 },
          createData: { companyId: SAME_TENANT_COMPANY_ID, revision: 1 },
          listFilter: { field: 'companyId', op: '==', value: SAME_TENANT_COMPANY_ID },
        };
        await assertCell(getContext(env, cell.persona), cell, target);
      });
    });
  }

  it('Σ1 — όψη συμμετοχής: ο επαγγελματίας ✅ · ο διαχειριστής του χώρου ❌ · ο super admin ✅', async () => {
    await seed(env);
    await assertSucceeds(getContext(env, 'same_tenant_user').firestore().collection(SIGNALS).doc(ENGAGEMENT_SIGNAL).get());
    await assertFails(getContext(env, 'same_tenant_admin').firestore().collection(SIGNALS).doc(ENGAGEMENT_SIGNAL).get());
    await assertFails(getContext(env, 'external_user').firestore().collection(SIGNALS).doc(ENGAGEMENT_SIGNAL).get());
    await assertSucceeds(getContext(env, 'super_admin').firestore().collection(SIGNALS).doc(ENGAGEMENT_SIGNAL).get());
  });

  it('Σ2 — ιδιώτης ΧΩΡΙΣ εταιρεία ⇒ άρνηση σε ΞΕΝΗ όψη συμμετοχής ΚΑΙ σε όψη οικοδεσπότη (η παγίδα `null == null`)', async () => {
    await seed(env);
    const individual = env.authenticatedContext('persona-individual-no-company', { companyId: null });
    // Το σήμα συμμετοχής ΔΕΝ έχει `companyId`: με `get('companyId', null)` το `belongsToCompany(null)` θα ήταν ΑΛΗΘΕΣ.
    await assertFails(individual.firestore().collection(SIGNALS).doc(ENGAGEMENT_SIGNAL).get());
    await assertFails(individual.firestore().collection(SIGNALS).doc(HOST_SIGNAL).get());
  });

  it('Σ3 — ανύπαρκτο σήμα: κάθε πιστοποιημένος ✅ (ο listener ζει πριν την 1η αύξηση) · ανώνυμος ❌', async () => {
    const missing = 'cvs_never_written_0001';
    await assertSucceeds(getContext(env, 'cross_tenant_user').firestore().collection(SIGNALS).doc(missing).get());
    await assertSucceeds(env.authenticatedContext('persona-individual-no-company', {}).firestore().collection(SIGNALS).doc(missing).get());
    await assertFails(getContext(env, 'anonymous').firestore().collection(SIGNALS).doc(missing).get());
  });

  it('Σ4 — ούτε ο ίδιος ο κάτοχος αυξάνει το σήμα του, ούτε το δημιουργεί για άλλον', async () => {
    await seed(env);
    const professional = getContext(env, 'same_tenant_user');
    await assertFails(professional.firestore().collection(SIGNALS).doc(ENGAGEMENT_SIGNAL).update({ revision: 8 }));
    await assertFails(professional.firestore().collection(SIGNALS).doc('cvs_forged_0001').set({ uid: PERSONA_CLAIMS.external_user.uid, revision: 1 }));
    await assertFails(professional.firestore().collection(SIGNALS).where('uid', '==', PROFESSIONAL).get());
  });
});
