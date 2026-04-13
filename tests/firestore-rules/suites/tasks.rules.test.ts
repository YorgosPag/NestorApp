/**
 * Firestore Rules — `tasks` collection
 *
 * Pattern: tenant_direct (tasksMatrix) — companyId tenant isolation with
 * `isSuperAdminOnly()` short-circuit on create (unlike crmDirectMatrix).
 *
 * Deltas from `tenantDirectMatrix()`:
 *   - super_admin × create: ALLOW (isSuperAdminOnly() OR leg present)
 *   - same_tenant_user × create/update/delete: ALLOW (companyId match / createdBy match)
 *
 * Create requires valid `isValidTaskData()` payload: title, type, assignedTo,
 * status, priority (all required fields). Seed doc carries
 * createdBy=assignedTo=same_tenant_user.uid so both update legs exercise the
 * `uid==createdBy` path.
 *
 * See ADR-298 §4 Phase C.5 (2026-04-13).
 *
 * @since 2026-04-13 (ADR-298 Phase C.5)
 */

import { initEmulator, teardownEmulator, resetData } from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell, type AssertTarget } from '../_harness/assertions';
import { seedTask } from '../_harness/seed-helpers-system';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { PERSONA_CLAIMS, SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'tasks',
)!;

describe('tasks.rules — tenant_direct/tasksMatrix (super_admin create allowed)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        const docId = 'task-same-tenant';
        await seedTask(env, docId);
        const ctx = getContext(env, cell.persona);
        const personaClaims = cell.persona !== 'anonymous' ? PERSONA_CLAIMS[cell.persona] : null;
        const uid = personaClaims?.uid ?? 'anon-uid';
        const target: AssertTarget = {
          collection: 'tasks',
          docId,
          // Update: keep all required fields + add companyId to satisfy immutability check
          data: {
            title: `Task ${docId}`,
            type: 'call',
            assignedTo: uid,
            status: 'in_progress',
            priority: 'medium',
            companyId: SAME_TENANT_COMPANY_ID,
          },
          // Create: full valid task payload
          createData: {
            title: 'New Task',
            type: 'email',
            assignedTo: uid,
            status: 'pending',
            priority: 'low',
            companyId: SAME_TENANT_COMPANY_ID,
            createdBy: uid,
            createdAt: new Date(),
          },
          listFilter: { field: 'companyId', op: '==', value: SAME_TENANT_COMPANY_ID },
        };
        await assertCell(ctx, cell, target);
      });
    });
  }
});
