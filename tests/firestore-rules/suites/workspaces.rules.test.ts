/**
 * Firestore Rules — `workspaces` collection
 *
 * Pattern: admin_write_only — read: isSuperAdminOnly() || (companyId && belongsToCompany).
 * Write: if false — Admin SDK only (PR-1B security gate).
 *
 * Seed doc carries companyId = SAME_TENANT_COMPANY_ID.
 *   - same_tenant × read/list → allow (belongsToCompany leg)
 *   - cross_tenant × read/list → deny
 *   - all writes → deny (server_only / cross_tenant)
 *
 * See ADR-298 §4 Phase C.6 (2026-04-14).
 *
 * @since 2026-04-14 (ADR-298 Phase C.6)
 */

import { initEmulator, teardownEmulator, resetData } from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell, type AssertTarget } from '../_harness/assertions';
import { seedWorkspace } from '../_harness/seed-helpers-users';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'workspaces',
)!;

describe('workspaces.rules — tenant read + server-only write (adminWriteOnlyMatrix)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        const docId = 'workspace-same-tenant';
        await seedWorkspace(env, docId);
        const ctx = getContext(env, cell.persona);
        const target: AssertTarget = {
          collection: 'workspaces',
          docId,
          data: { name: 'Updated Workspace', updatedAt: new Date() },
          createData: {
            companyId: SAME_TENANT_COMPANY_ID,
            name: 'New Workspace',
            createdAt: new Date(),
          },
          listFilter: { field: 'companyId', op: '==', value: SAME_TENANT_COMPANY_ID },
        };
        await assertCell(ctx, cell, target);
      });
    });
  }
});
