/**
 * Firestore Rules — `audit_logs` collection (top-level)
 *
 * Pattern: systemGlobalMatrix — isAuthenticated() read, write=false.
 *
 * NOTE: This is the TOP-LEVEL `audit_logs` collection (line 2455 in
 * firestore.rules). The SUBCOLLECTION `companies/{id}/audit_logs` is covered
 * by the `companies` parent block (ADR-298 Phase C.6) and is NOT tracked here.
 *
 * Any authenticated user can read. Writes are server-only via Admin SDK.
 * No tenant isolation — same pattern as `relationship_audit` and
 * `system_audit_logs`.
 *
 * See ADR-298 §4 Phase C.7 (2026-04-14).
 *
 * @since 2026-04-14 (ADR-298 Phase C.7)
 */

import { initEmulator, teardownEmulator, resetData } from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell } from '../_harness/assertions';
import { seedAuditLog } from '../_harness/seed-helpers-specialized';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'audit_logs',
)!;

describe('audit-logs.rules — isAuthenticated read, write=false (top-level)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  const docId = 'audit-log-test-001';

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        await seedAuditLog(env, docId);
        const ctx = getContext(env, cell.persona);
        await assertCell(ctx, cell, {
          collection: 'audit_logs',
          docId,
          data: { action: 'updated' },
          createData: { action: 'test_action', actorId: 'system' },
        });
      });
    });
  }
});
