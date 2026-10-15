/**
 * Firestore Rules — `accounting_fiscal_periods` collection
 *
 * Pattern: fiscal_period — server-only writes (ADR-ACC-010 §2.1.1 Φάση 6, 2026-10-15).
 *
 * Read/list gate: `canReadAccounting(companyId)` (same as role_dual).
 * Create / update / delete: `if false` — periods are born, closed, locked and reopened only through
 * the API (Admin SDK), where the transition and its `PERIOD_*` trace share ONE transaction.
 * Every write cell is therefore `server_only`. (Until 2026-10-15 the rules held a client-side state
 * machine that let a company admin reopen a LOCKED period from the browser without a trace.)
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

describe('accounting_fiscal_periods.rules — fiscal_period (server-only writes)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        const docId = 'fiscal-period-same-tenant';

        // Seed an OPEN period. Even a status-neutral delta (only `updatedAt`) is denied:
        // every client write exercises `if false`.
        await seedAccountingFiscalPeriod(env, docId);

        const ctx = getContext(env, cell.persona);

        const target: AssertTarget = {
          collection: 'accounting_fiscal_periods',
          docId,
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
