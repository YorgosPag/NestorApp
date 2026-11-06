/**
 * Firestore Rules — `opportunities` collection
 *
 * Pattern: tenant_direct for READS (crmDirectMatrix). WRITES: none from the
 * browser — `allow create, update, delete: if false` (ADR-930 §3.10 Βήμα Β,
 * 2026-11-06). Every write goes through the server (Admin SDK) with the owner
 * judge, field-level conflict check and history: `POST /api/opportunities` ·
 * `PATCH|DELETE /api/opportunities/[id]` · `…/stage` · `…/owner`.
 *
 * The seed doc carries `createdBy = PERSONA_CLAIMS.same_tenant_user.uid` — so
 * the matrix's write denials hold even for the CREATOR, the persona the old
 * rule let through.
 *
 * See ADR-298 §4 Phase B.3 (2026-04-13) · ADR-930 §3.10.
 *
 * @since 2026-04-13 (ADR-298 Phase B.3)
 */

import {
  initEmulator,
  teardownEmulator,
  resetData,
} from '../_harness/emulator';
import { getContext, withSeedContext } from '../_harness/auth-contexts';
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { assertCell, type AssertTarget } from '../_harness/assertions';
import { seedOpportunity } from '../_harness/seed-helpers';
import { describeCrmReadLeg } from '../_harness/crm-owner-contract';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { PERSONA_CLAIMS, SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'opportunities',
)!;

describe('opportunities.rules — tenant_direct (crmDirectMatrix)', () => {
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
        const docId = 'opportunity-same-tenant';

        await seedOpportunity(env, docId);

        const ctx = getContext(env, cell.persona);

        const personaClaims =
          cell.persona !== 'anonymous' ? PERSONA_CLAIMS[cell.persona] : null;

        const target: AssertTarget = {
          collection: 'opportunities',
          docId,
          data: { updatedAt: new Date() },
          createData: {
            title: `Created Opportunity ${cell.persona}`,
            stage: 'prospecting',
            value: 0,
            companyId: SAME_TENANT_COMPANY_ID,
            createdBy: personaClaims?.uid ?? 'anon-uid',
            createdAt: new Date(),
          },
          listFilter: {
            field: 'companyId',
            op: '==',
            value: SAME_TENANT_COMPANY_ID,
          },
        };

        await assertCell(ctx, cell, target);
      });
    });
  }
});

/**
 * Ό,τι ο πίνακας δεν εκφράζει για την ΑΝΑΓΝΩΣΗ (legacy έγγραφο, ξένος tenant). Το σκέλος ΕΓΓΡΑΦΗΣ του
 * `describeCrmOwnerLeg` ΔΕΝ τρέχει εδώ: ο browser δεν γράφει καθόλου (ADR-930 §3.10 Βήμα Β).
 *
 * ✅ ADR-930 «Εξουσία κατόχου» (απόφαση Giorgio 2026-11-04): ο ανατεθειμένος ΔΙΑΒΑΖΕΙ τη δική του, και legacy.
 *    Η εξουσία του να την επεξεργαστεί ζει πλέον ΜΟΝΟ στον server (`services/crm/opportunity-access.ts`).
 */
describeCrmReadLeg({ collection: 'opportunities', assigneeReads: true });

/**
 * ADR-930 §3.10 Βήμα Β — ο ανατεθειμένος, το πρόσωπο που ο πίνακας ΔΕΝ ρωτά (το seed έγγραφο ανήκει στον
 * δημιουργό). Ως 2026-11-06 ο κανόνας τον άφηνε να γράψει από τον browser κάθε πεδίο εκτός σταδίου/κατόχου — χωρίς
 * σχήμα, χωρίς ιστορικό. Οι παλιές επιθέσεις (στάδιο · `createdBy` ⇒ «δημιουργός» ⇒ διαγραφή) μένουν ως άγκυρες.
 */
describe('opportunities.rules — ADR-930 §3.10: ο browser δεν γράφει καθόλου', () => {
  let env: RulesTestEnvironment;
  const docId = 'opportunity-server-written';
  const ASSIGNEE = PERSONA_CLAIMS.same_tenant_user.uid;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  /** Ευκαιρία που δημιούργησε τρίτος και ανατέθηκε στον `same_tenant_user` — κάτοχος, όχι δημιουργός, όχι admin. */
  async function seedAssignedToUser(): Promise<void> {
    await withSeedContext(env, async (ctx) => {
      await ctx.firestore().collection('opportunities').doc(docId).set({
        title: 'assigned', stage: 'initial_contact', companyId: SAME_TENANT_COMPANY_ID,
        createdBy: 'persona-crm-author', assignedTo: ASSIGNEE,
      });
    });
  }

  it('✅ ΘΕΤΙΚΟΣ ΜΑΡΤΥΡΑΣ: ο ανατεθειμένος ΔΙΑΒΑΖΕΙ — οι αρνήσεις παρακάτω δεν είναι «δεν βλέπει το έγγραφο»', async () => {
    await seedAssignedToUser();
    await assertSucceeds(getContext(env, 'same_tenant_user').firestore().collection('opportunities').doc(docId).get());
  });

  it('ανατεθειμένος × update ουδέτερου πεδίου (σημειώσεις) ⇒ deny (επεξεργασία ΜΟΝΟ με `PATCH /api/opportunities/[id]`)', async () => {
    await seedAssignedToUser();
    const ref = getContext(env, 'same_tenant_user').firestore().collection('opportunities').doc(docId);
    await assertFails(ref.update({ notes: 'κάλεσα', updatedAt: new Date() }));
  });

  it('η παλιά επίθεση: ο ανατεθειμένος δεν γίνεται «δημιουργός» και δεν διαγράφει', async () => {
    await seedAssignedToUser();
    const ref = getContext(env, 'same_tenant_user').firestore().collection('opportunities').doc(docId);
    await assertFails(ref.update({ createdBy: ASSIGNEE }));
    await assertFails(ref.delete());
  });

  it.each([['stage', 'closed_won'], ['assignedTo', 'uid-of-another-company']] as const)(
    'same_tenant_admin × update «%s» ⇒ deny (στάδιο/κάτοχος: μόνο οι πόρτες `…/stage` · `…/owner`)',
    async (field, value) => {
      await seedAssignedToUser();
      const db = getContext(env, 'same_tenant_admin').firestore();
      await assertFails(db.collection('opportunities').doc(docId).update({ [field]: value }));
    },
  );
});
