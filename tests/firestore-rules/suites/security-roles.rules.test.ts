/**
 * Firestore Rules — `security_roles` collection
 *
 * Pattern: system_global — read: isAuthenticated() (no tenant isolation).
 * Write: if false — Admin SDK only (critical for login flow).
 *
 * All authenticated personas (including cross_tenant_admin) can read.
 * Only anonymous is denied on read.
 * All writes denied for all personas (server_only).
 *
 * See ADR-298 §4 Phase C.6 (2026-04-14).
 *
 * @since 2026-04-14 (ADR-298 Phase C.6)
 */

import { initEmulator, teardownEmulator, resetData } from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell, type AssertTarget } from '../_harness/assertions';
import { seedSecurityRole } from '../_harness/seed-helpers-users';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'security_roles',
)!;

describe('security_roles.rules — global read + server-only write (systemGlobalMatrix)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        const docId = 'role-company-admin';
        await seedSecurityRole(env, docId);
        const ctx = getContext(env, cell.persona);
        const target: AssertTarget = {
          collection: 'security_roles',
          docId,
          data: { name: 'Updated Role', updatedAt: new Date() },
          createData: {
            name: 'New Role',
            permissions: [],
            createdAt: new Date(),
          },
        };
        await assertCell(ctx, cell, target);
      });
    });
  }
});
