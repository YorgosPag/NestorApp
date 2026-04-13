/**
 * Firestore Rules — `accounting_customer_balances` collection
 *
 * Pattern: accounting_system_calc (Pattern F).
 *
 * Read gate:   `canReadAccounting(companyId)` — same as standard role_dual.
 * Create gate: `canCreateAccountingSystem()` = `isInternalUser() && companyId==getUserCompanyId()`.
 *   No `createdBy==uid` requirement (system-generated; no human author field).
 *   super_admin claim 'company-root' ≠ 'company-a' → deny (cross_tenant).
 * Update gate: `canUpdateAccountingSystem(companyId)` = `isInternalUserOfCompany(companyId)`.
 *   All internal personas allowed; super_admin via isSuperAdminOnly().
 * Delete gate: `isCompanyAdminOfCompany(companyId)` — admin cleans stale balances.
 *   same_tenant_user denied (insufficient_role).
 *
 * See ADR-298 §4 Phase C.1 (2026-04-13).
 *
 * @since 2026-04-13 (ADR-298 Phase C.1)
 */

import { initEmulator, teardownEmulator, resetData } from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell, type AssertTarget } from '../_harness/assertions';
import { seedAccountingCustomerBalance } from '../_harness/seed-helpers-accounting';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'accounting_customer_balances',
)!;

describe('accounting_customer_balances.rules — system_calc (Pattern F)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        const docId = 'customer-balance-same-tenant';
        await seedAccountingCustomerBalance(env, docId);
        const ctx = getContext(env, cell.persona);

        const target: AssertTarget = {
          collection: 'accounting_customer_balances',
          docId,
          // Update delta: companyId unchanged (immutable guard in canUpdateAccountingSystem).
          data: { balance: 100, companyId: SAME_TENANT_COMPANY_ID },
          createData: {
            contactId: 'contact-test',
            balance: 0,
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
