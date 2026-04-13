/**
 * Firestore Rules — `accounting_settings` collection
 *
 * Pattern: accounting_singleton (Pattern D).
 *
 * Read gate: `isAuthenticated() && (isSuperAdminOnly() || isInternalUserOfCompany(companyId))`.
 * All internal-user personas can read; cross_tenant_admin denied.
 *
 * Create gate: `isCompanyAdmin() && companyId==getUserCompanyId()`.
 * `isCompanyAdmin()` = role in [super_admin, company_admin].
 * super_admin: isCompanyAdmin()=true BUT getUserCompanyId()='company-root' != 'company-a' → deny (cross_tenant).
 * same_tenant_user: isCompanyAdmin()=false (internal_user) → deny (insufficient_role).
 *
 * Update gate: `canWriteAccountingSingleton(companyId)` = `isCompanyAdminOfCompany(companyId)`.
 * same_tenant_user denied (insufficient_role); super_admin allowed via isSuperAdminOnly().
 *
 * Delete gate: `if false` — singleton lifecycle is admin-managed via Admin SDK.
 *
 * See ADR-298 §4 Phase C.1 (2026-04-13).
 *
 * @since 2026-04-13 (ADR-298 Phase C.1)
 */

import { initEmulator, teardownEmulator, resetData } from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell, type AssertTarget } from '../_harness/assertions';
import { seedAccountingSettings } from '../_harness/seed-helpers-accounting';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'accounting_settings',
)!;

describe('accounting_settings.rules — accounting_singleton (Pattern D)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        const docId = 'settings-same-tenant';

        // Seed with companyId so the `resource.data.keys().hasAny(['companyId'])`
        // guard on update passes, and the read rule's isInternalUserOfCompany arm fires.
        await seedAccountingSettings(env, docId);

        const ctx = getContext(env, cell.persona);

        const target: AssertTarget = {
          collection: 'accounting_settings',
          docId,
          // Update delta: companyId stays the same (immutable guard satisfied).
          data: { vatRate: 0.24, companyId: SAME_TENANT_COMPANY_ID },
          createData: {
            vatRate: 0.24,
            currency: 'EUR',
            companyId: SAME_TENANT_COMPANY_ID,
            createdAt: new Date(),
          },
          listFilter: { field: 'companyId', op: '==', value: SAME_TENANT_COMPANY_ID },
        };

        await assertCell(ctx, cell, target);
      });
    });
  }
});
