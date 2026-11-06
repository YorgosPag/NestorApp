/**
 * Firestore Rules — `opportunities` collection
 *
 * Pattern: tenant_direct (crmDirectMatrix variant).
 * The create rule is `isAuthenticated() && companyId == getUserCompanyId()`
 * with no `isSuperAdminOnly()` short-circuit, so super_admin × create is
 * denied (companyId 'company-root' ≠ 'company-a'). Update/delete allow
 * same_tenant_user via `createdBy == request.auth.uid`; seed doc carries
 * `createdBy = PERSONA_CLAIMS.same_tenant_user.uid`.
 *
 * See ADR-298 §4 Phase B.3 (2026-04-13).
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
import { describeCrmOwnerLeg } from '../_harness/crm-owner-contract';
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
 * Ό,τι ο πίνακας (πρόσωπο × πράξη) ΔΕΝ μπορεί να εκφράσει: μεταβάλλει το
 * ΕΓΓΡΑΦΟ, όχι τον καλούντα. Το ίδιο συμβόλαιο τρέχει και στις τρεις CRM
 * συλλογές — μία σημαία τις ξεχωρίζει. Δες `_harness/crm-owner-contract.ts`
 * για το εύρημα που το γέννησε (ADR-841 §7 Α21.14.8).
 *
 * ✅ ADR-930 «Εξουσία κατόχου» (απόφαση Giorgio 2026-11-04): `true` — ο ανατεθειμένος κινεί/επεξεργάζεται τη δική
 *    του, όπως στα `leads`. Ίδιος πίνακας στον server: `services/crm/opportunity-access.ts`.
 */
describeCrmOwnerLeg({ collection: 'opportunities', assigneeIsOwner: true });

/**
 * ADR-930 — το στάδιο έχει ΕΝΑΝ γραφέα (Admin SDK). Ακόμη και ο προνομιούχος γραφέας, που ο πίνακας αφήνει να
 * κάνει update, ΔΕΝ γράφει στάδιο ή παράγωγό του από τον browser — γράφει όμως κανονικά τα υπόλοιπα πεδία.
 */
describe('opportunities.rules — ADR-930 πεδία σταδίου: μόνο από την πόρτα του server', () => {
  let env: RulesTestEnvironment;
  const docId = 'opportunity-stage-owned';

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  const STAGE_OWNED: ReadonlyArray<readonly [string, unknown]> = [
    ['stage', 'closed_won'], ['status', 'won'], ['wonDate', '2026-11-04'], ['closedAt', '2026-11-04'],
    ['stageChangedAt', new Date()], ['lostReason', 'price'], ['lostReasonNote', 'x'], ['reopenCount', 3], ['_v', 99],
  ];

  it.each(STAGE_OWNED)('same_tenant_admin × update «%s» ⇒ deny', async (field, value) => {
    await seedOpportunity(env, docId);
    const db = getContext(env, 'same_tenant_admin').firestore();
    await assertFails(db.collection('opportunities').doc(docId).update({ [field]: value }));
  });

  /** Ευκαιρία που δημιούργησε τρίτος και ανατέθηκε στον `same_tenant_user` — ο κάτοχος που δεν είναι ούτε δημιουργός ούτε admin. */
  async function seedAssignedToUser(): Promise<void> {
    await withSeedContext(env, async (ctx) => {
      await ctx.firestore().collection('opportunities').doc(docId).set({
        title: 'assigned', stage: 'initial_contact', companyId: SAME_TENANT_COMPANY_ID,
        createdBy: 'persona-crm-author', assignedTo: PERSONA_CLAIMS.same_tenant_user.uid,
      });
    });
  }

  it('ανατεθειμένος × update «stage» ⇒ deny (κάτοχος ≠ γραφέας σταδίου: κινεί ΜΟΝΟ μέσω της πόρτας)', async () => {
    await seedAssignedToUser();
    const db = getContext(env, 'same_tenant_user').firestore();
    await assertFails(db.collection('opportunities').doc(docId).update({ stage: 'closed_won' }));
  });

  it('ανατεθειμένος × delete ⇒ deny (η ανάθεση δίνει δουλειά, όχι εξαφάνιση — `intent: delete` του server)', async () => {
    await seedAssignedToUser();
    const db = getContext(env, 'same_tenant_user').firestore();
    await assertFails(db.collection('opportunities').doc(docId).delete());
  });

  it('same_tenant_admin × update μη-σταδιακού πεδίου (σημειώσεις) ⇒ allow', async () => {
    await seedOpportunity(env, docId);
    const db = getContext(env, 'same_tenant_admin').firestore();
    await assertSucceeds(db.collection('opportunities').doc(docId).update({ notes: 'νέα σημείωση', updatedAt: new Date() }));
  });
});

/**
 * ADR-930 §3.8 — ο ΚΑΤΟΧΟΣ έχει ΕΝΑΝ γραφέα (`POST /api/opportunities/[id]/owner`, Admin SDK). Κανείς δεν γράφει από
 * τον browser `assignedTo` / `ownerHandoffNote`, και ΚΑΝΕΙΣ δεν ξαναγράφει το `createdBy`. Το κενό που κλείνει
 * (μετρημένο στους κανόνες ως 2026-11-05): ο ανατεθειμένος έγραφε `createdBy` = το δικό του uid ⇒ «δημιουργός» ⇒ διαγραφή.
 */
describe('opportunities.rules — ADR-930 §3.8 πεδία ιδιοκτησίας: μόνο από την πόρτα κατόχου', () => {
  let env: RulesTestEnvironment;
  const docId = 'opportunity-owner-owned';
  const ASSIGNEE = PERSONA_CLAIMS.same_tenant_user.uid;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  async function seedAssignedToUser(): Promise<void> {
    await withSeedContext(env, async (ctx) => {
      await ctx.firestore().collection('opportunities').doc(docId).set({
        title: 'assigned', stage: 'initial_contact', companyId: SAME_TENANT_COMPANY_ID,
        createdBy: 'persona-crm-author', assignedTo: ASSIGNEE,
      });
    });
  }

  const OWNER_OWNED: ReadonlyArray<readonly [string, unknown]> = [
    ['assignedTo', 'uid-of-another-company'], ['createdBy', ASSIGNEE], ['ownerHandoffNote', 'x'],
  ];

  it.each(OWNER_OWNED)('ανατεθειμένος × update «%s» ⇒ deny', async (field, value) => {
    await seedAssignedToUser();
    const db = getContext(env, 'same_tenant_user').firestore();
    await assertFails(db.collection('opportunities').doc(docId).update({ [field]: value }));
  });

  it.each(OWNER_OWNED)('same_tenant_admin × update «%s» ⇒ deny (ακόμη και ο manager: μόνο η πόρτα)', async (field, value) => {
    await seedAssignedToUser();
    const db = getContext(env, 'same_tenant_admin').firestore();
    await assertFails(db.collection('opportunities').doc(docId).update({ [field]: value }));
  });

  it('η πλήρης επίθεση: ο ανατεθειμένος δεν γίνεται «δημιουργός» — άρα δεν αποκτά διαγραφή', async () => {
    await seedAssignedToUser();
    const ref = getContext(env, 'same_tenant_user').firestore().collection('opportunities').doc(docId);
    await assertFails(ref.update({ createdBy: ASSIGNEE }));
    await assertFails(ref.delete());
  });

  it('ανατεθειμένος × update μη-ιδιοκτησιακού πεδίου (σημειώσεις) ⇒ allow (η δουλειά του μένει ανοιχτή)', async () => {
    await seedAssignedToUser();
    const db = getContext(env, 'same_tenant_user').firestore();
    await assertSucceeds(db.collection('opportunities').doc(docId).update({ notes: 'κάλεσα', updatedAt: new Date() }));
  });
});
