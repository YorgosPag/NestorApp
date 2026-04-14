/**
 * Firestore Rules — `companies` collection
 *
 * Pattern: ownership — read: isSuperAdminOnly() || getUserCompanyId() == companyId (path var).
 * Write: if false — Admin SDK only.
 *
 * Seed doc: docId = SAME_TENANT_COMPANY_ID ('company-a').
 *   - same_tenant × get → allow (getUserCompanyId() matches docId)
 *   - same_tenant × list → deny (path-var rule, unrestricted query denied)
 *   - super_admin × list → allow (isSuperAdminOnly() unconditional)
 *   - all writes → deny (server_only / cross_tenant)
 *
 * See ADR-298 §4 Phase C.6 (2026-04-14).
 *
 * @since 2026-04-14 (ADR-298 Phase C.6)
 */

import { initEmulator, teardownEmulator, resetData } from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell, type AssertTarget } from '../_harness/assertions';
import { seedCompany } from '../_harness/seed-helpers-users';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'companies',
)!;

describe('companies.rules — own-company read + server-only write (companiesMatrix)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        // docId = SAME_TENANT_COMPANY_ID so getUserCompanyId() == companyId (path var)
        const docId = SAME_TENANT_COMPANY_ID;
        await seedCompany(env, docId);
        const ctx = getContext(env, cell.persona);
        const target: AssertTarget = {
          collection: 'companies',
          docId,
          data: { name: 'Updated Company', updatedAt: new Date() },
          createData: {
            name: 'New Company',
            createdAt: new Date(),
          },
        };
        await assertCell(ctx, cell, target);
      });
    });
  }
});
