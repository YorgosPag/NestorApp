/**
 * Firestore Rules — `system_audit_logs` collection
 *
 * Pattern: systemGlobalMatrix — isAuthenticated() read, write=false.
 *
 * Any authenticated user can read system audit entries. Writes are server-only
 * via Admin SDK. No tenant isolation — same pattern as `audit_logs` top-level.
 *
 * See ADR-298 §4 Phase C.7 (2026-04-14).
 *
 * @since 2026-04-14 (ADR-298 Phase C.7)
 */

import { initEmulator, teardownEmulator, resetData } from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell } from '../_harness/assertions';
import { seedSystemAuditLog } from '../_harness/seed-helpers-specialized';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'system_audit_logs',
)!;

describe('system-audit-logs.rules — isAuthenticated read, write=false', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  const docId = 'sys-audit-log-test-001';

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        await seedSystemAuditLog(env, docId);
        const ctx = getContext(env, cell.persona);
        await assertCell(ctx, cell, {
          collection: 'system_audit_logs',
          docId,
          data: { eventType: 'updated' },
          createData: { eventType: 'test_event', payload: {} },
        });
      });
    });
  }
});
