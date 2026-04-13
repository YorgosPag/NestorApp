/**
 * Firestore Rules — `navigation_companies` collection
 *
 * Pattern: admin_write_only — tenant-scoped reads (`isSuperAdminOnly() ||
 * belongsToCompany(companyId)`), all client writes denied (`if false`).
 * Navigation company metadata is written exclusively via Admin SDK.
 *
 * See ADR-298 §4 Phase C.5 (2026-04-13).
 *
 * @since 2026-04-13 (ADR-298 Phase C.5)
 */

import { initEmulator, teardownEmulator, resetData } from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell, type AssertTarget } from '../_harness/assertions';
import { seedNavigationCompany } from '../_harness/seed-helpers-system';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'navigation_companies',
)!;

describe('navigation_companies.rules — admin_write_only (tenant read, write=false)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        const docId = 'navcomp-same-tenant';
        await seedNavigationCompany(env, docId);
        const ctx = getContext(env, cell.persona);
        const target: AssertTarget = {
          collection: 'navigation_companies',
          docId,
          data: { name: 'Updated Company' },
          createData: { name: 'New Company', companyId: SAME_TENANT_COMPANY_ID },
          listFilter: { field: 'companyId', op: '==', value: SAME_TENANT_COMPANY_ID },
        };
        await assertCell(ctx, cell, target);
      });
    });
  }
});
