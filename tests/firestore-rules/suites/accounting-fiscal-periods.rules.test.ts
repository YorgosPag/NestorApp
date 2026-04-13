/**
 * Firestore Rules — `accounting_fiscal_periods` collection
 *
 * Pattern: fiscal_period (Q8 SAP state-machine).
 *
 * Create gate: `isCompanyAdminOfCompany(companyId) && companyId==getUserCompanyId()`.
 * super_admin passes `isCompanyAdminOfCompany` via `isSuperAdminOnly()` but fails
 * the `getUserCompanyId()=='company-a'` check (claim is 'company-root') → deny (cross_tenant).
 * same_tenant_user is not company_admin → deny (insufficient_role).
 *
 * Update gate: `isInternalUserOfCompany(companyId) && companyId immutable && state machine`.
 * Test writes a `updatedAt` delta on an OPEN period with the same status → first arm of
 * the state machine (status not changing) applies → all internal personas allowed.
 * super_admin reaches `isInternalUserOfCompany` via `isSuperAdminOnly()`.
 *
 * Delete gate: `if false` — fiscal periods are never deleted (business invariant).
 * All personas get server_only reason.
 *
 * See ADR-298 §4 Phase C.1 (2026-04-13).
 *
 * @since 2026-04-13 (ADR-298 Phase C.1)
 */

import { initEmulator, teardownEmulator, resetData } from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell, type AssertTarget } from '../_harness/assertions';
import { seedAccountingFiscalPeriod } from '../_harness/seed-helpers-accounting';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'accounting_fiscal_periods',
)!;

describe('accounting_fiscal_periods.rules — fiscal_period (Q8 state-machine)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        const docId = 'fiscal-period-same-tenant';

        // Seed an OPEN period. Update tests send a status-neutral delta
        // (only `updatedAt` changes) so the first arm of the state machine
        // (resource.data.status == request.resource.data.status) permits all
        // internal-user personas. Delete cells exercise `if false`.
        await seedAccountingFiscalPeriod(env, docId);

        const ctx = getContext(env, cell.persona);

        const target: AssertTarget = {
          collection: 'accounting_fiscal_periods',
          docId,
          // Update delta: same status + updatedAt — exercises state-machine arm 1.
          data: { status: 'OPEN', updatedAt: new Date() },
          createData: {
            name: `FY-2026 ${cell.persona}`,
            status: 'OPEN',
            startDate: new Date(),
            endDate: new Date(),
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
