/**
 * Firestore Rules — `teams` collection
 *
 * Pattern: tenant_direct (crmDirectMatrix) — creator-gated update/delete.
 *
 * Seed doc: createdBy = same_tenant_user.uid.
 *   - same_tenant_user × update/delete → allow (uid==createdBy)
 *   - same_tenant_admin × update → allow (isCompanyAdminOfCompany)
 *   - same_tenant_admin × delete → allow (isCompanyAdminOfCompany)
 *   - super_admin × update/delete → allow (isSuperAdminOnly in update via
 *     `isCompanyAdminOfCompany`; delete via `isSuperAdminOnly`)
 *   - super_admin × create → deny (no isSuperAdminOnly() short-circuit in create rule;
 *     `companyId == getUserCompanyId()` fails for 'company-root' vs 'company-a')
 *
 * See ADR-298 §4 Phase C.6 (2026-04-14).
 *
 * @since 2026-04-14 (ADR-298 Phase C.6)
 */

import { initEmulator, teardownEmulator, resetData } from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell, type AssertTarget } from '../_harness/assertions';
import { seedTeam } from '../_harness/seed-helpers-users';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { PERSONA_CLAIMS, SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'teams',
)!;

describe('teams.rules — tenant_direct creator-gated CRUD (crmDirectMatrix)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        const docId = 'team-same-tenant';
        await seedTeam(env, docId);
        const ctx = getContext(env, cell.persona);
        const personaClaims = cell.persona !== 'anonymous' ? PERSONA_CLAIMS[cell.persona] : null;
        const uid = personaClaims?.uid ?? 'anon-uid';
        const target: AssertTarget = {
          collection: 'teams',
          docId,
          data: { name: 'Updated Team', companyId: SAME_TENANT_COMPANY_ID, updatedAt: new Date() },
          createData: {
            companyId: SAME_TENANT_COMPANY_ID,
            name: 'New Team',
            createdBy: uid,
            createdAt: new Date(),
          },
          listFilter: { field: 'companyId', op: '==', value: SAME_TENANT_COMPANY_ID },
        };
        await assertCell(ctx, cell, target);
      });
    });
  }
});
