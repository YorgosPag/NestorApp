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
import { getContext } from '../_harness/auth-contexts';
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
 */
describeCrmOwnerLeg({ collection: 'opportunities', assigneeIsOwner: false });

/**
 * ADR-929 — το στάδιο έχει ΕΝΑΝ γραφέα (Admin SDK). Ακόμη και ο προνομιούχος γραφέας, που ο πίνακας αφήνει να
 * κάνει update, ΔΕΝ γράφει στάδιο ή παράγωγό του από τον browser — γράφει όμως κανονικά τα υπόλοιπα πεδία.
 */
describe('opportunities.rules — ADR-929 πεδία σταδίου: μόνο από την πόρτα του server', () => {
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

  it('same_tenant_admin × update μη-σταδιακού πεδίου (σημειώσεις) ⇒ allow', async () => {
    await seedOpportunity(env, docId);
    const db = getContext(env, 'same_tenant_admin').firestore();
    await assertSucceeds(db.collection('opportunities').doc(docId).update({ notes: 'νέα σημείωση', updatedAt: new Date() }));
  });
});
