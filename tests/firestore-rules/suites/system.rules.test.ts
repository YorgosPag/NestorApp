/**
 * Firestore Rules — `system` collection
 *
 * Pattern: system_global (admin variant) — `isAuthenticated() && isCompanyAdmin()`
 * read, `allow write: if false`.
 *
 * Key: `isCompanyAdmin()` is role-only (no tenant gate) — both `same_tenant_admin`
 * AND `cross_tenant_admin` (both have role=company_admin) can read. `same_tenant_user`
 * (role=internal_user) denied (insufficient_role).
 *
 * See ADR-298 §4 Phase C.5 (2026-04-13).
 *
 * @since 2026-04-13 (ADR-298 Phase C.5)
 */

import { initEmulator, teardownEmulator, resetData } from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell, type AssertTarget } from '../_harness/assertions';
import { seedSystem } from '../_harness/seed-helpers-system';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'system',
)!;

describe('system.rules — system_global admin variant (isCompanyAdmin read, write=false)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        const docId = 'system-settings';
        await seedSystem(env, docId);
        const ctx = getContext(env, cell.persona);
        const target: AssertTarget = {
          collection: 'system',
          docId,
          data: { type: 'updated' },
          createData: { type: 'new-settings' },
        };
        await assertCell(ctx, cell, target);
      });
    });
  }
});
