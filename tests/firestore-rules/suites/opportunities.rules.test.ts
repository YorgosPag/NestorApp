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
import { assertCell, type AssertTarget } from '../_harness/assertions';
import { seedOpportunity } from '../_harness/seed-helpers';
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
