/**
 * Firestore Rules — `obligation_templates` collection
 *
 * Pattern: tenant_direct (crmDirectMatrix variant).
 * Read gate: `isSuperAdminOnly()` OR direct companyId match OR legacy
 * `createdBy` fallback (no companyId on doc). Seed doc carries companyId so
 * the direct path is exercised.
 *
 * Create rule: `isAuthenticated() && companyId == getUserCompanyId()` with no
 * `isSuperAdminOnly()` short-circuit — super_admin (claim 'company-root')
 * fails the companyId check against 'company-a' → denied (cross_tenant).
 *
 * Update/delete: `createdBy == uid || isCompanyAdminOfCompany || isSuperAdminOnly()`.
 * Update rule uses an optional companyId immutability guard (`!hasAny(['companyId'])
 * || companyId unchanged`). The merged doc retains seed companyId when delta
 * is `{ updatedAt }`, satisfying both branches.
 *
 * Seed doc carries `createdBy = same_tenant_user.uid` so the uid-match leg is
 * exercised for same_tenant_user.
 *
 * See ADR-298 §4 Phase B.6 (2026-04-13).
 *
 * @since 2026-04-13 (ADR-298 Phase B.6)
 */

import {
  initEmulator,
  teardownEmulator,
  resetData,
} from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell, type AssertTarget } from '../_harness/assertions';
import { seedObligationTemplate } from '../_harness/seed-helpers-compliance';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { PERSONA_CLAIMS, SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'obligation_templates',
)!;

describe('obligation_templates.rules — tenant_direct (crmDirectMatrix)', () => {
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
        const docId = 'template-same-tenant';

        // Seed with same_tenant_user as createdBy so the uid==createdBy
        // update/delete leg is exercised for same_tenant_user persona.
        await seedObligationTemplate(env, docId);

        const ctx = getContext(env, cell.persona);

        const personaClaims =
          cell.persona !== 'anonymous' ? PERSONA_CLAIMS[cell.persona] : null;

        const target: AssertTarget = {
          collection: 'obligation_templates',
          docId,
          data: { updatedAt: new Date() },
          createData: {
            title: `Created Template ${cell.persona}`,
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
