/**
 * Firestore Rules — `positions` collection
 *
 * Pattern: system_global — read: isAuthenticated() (no tenant isolation).
 * Write: if false — Admin SDK only.
 *
 * All authenticated personas (including cross_tenant_admin) can read.
 * Only anonymous is denied on read.
 *
 * See ADR-298 §4 Phase C.6 (2026-04-14).
 *
 * @since 2026-04-14 (ADR-298 Phase C.6)
 */

import { initEmulator, teardownEmulator, resetData } from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell, type AssertTarget } from '../_harness/assertions';
import { seedPosition } from '../_harness/seed-helpers-users';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'positions',
)!;

describe('positions.rules — global read + server-only write (systemGlobalMatrix)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        const docId = 'position-developer';
        await seedPosition(env, docId);
        const ctx = getContext(env, cell.persona);
        const target: AssertTarget = {
          collection: 'positions',
          docId,
          data: { name: 'Updated Position', updatedAt: new Date() },
          createData: {
            name: 'New Position',
            description: 'New position',
            createdAt: new Date(),
          },
        };
        await assertCell(ctx, cell, target);
      });
    });
  }
});
