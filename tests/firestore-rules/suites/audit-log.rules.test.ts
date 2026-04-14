/**
 * Firestore Rules — `audit_log` collection (Cloud Functions purge trail)
 *
 * Pattern: auditLogMatrix — super_admin-only read, write=false.
 *
 * This collection records file purge operations written by Cloud Functions
 * via Admin SDK. Only super_admin may read. All other authenticated personas
 * and anonymous users are denied.
 *
 * Note: `audit_log` (singular) ≠ `audit_logs` (plural) and ≠ the
 * `companies/{id}/audit_logs` subcollection. Three distinct collections.
 *
 * See ADR-298 §4 Phase C.7 (2026-04-14).
 *
 * @since 2026-04-14 (ADR-298 Phase C.7)
 */

import { initEmulator, teardownEmulator, resetData } from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell } from '../_harness/assertions';
import { seedAuditLogEntry } from '../_harness/seed-helpers-specialized';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'audit_log',
)!;

describe('audit-log.rules — super_admin-only read, write=false (Cloud Functions trail)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  const docId = 'audit-log-entry-001';

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        await seedAuditLogEntry(env, docId);
        const ctx = getContext(env, cell.persona);
        await assertCell(ctx, cell, {
          collection: 'audit_log',
          docId,
          data: { operation: 'updated' },
          createData: { operation: 'purge', entityId: 'entity-new', purgedBy: 'cloud-functions' },
        });
      });
    });
  }
});
