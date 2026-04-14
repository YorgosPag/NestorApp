/**
 * Firestore Rules — `relationship_audit` collection
 *
 * Pattern: systemGlobalMatrix — isAuthenticated() read, write=false.
 *
 * Rationale: relationship audit logs are written exclusively via server-side
 * code. Any authenticated user can read audit entries (needed for UI display).
 * No tenant isolation — same as `audit_logs` top-level collection.
 *
 * See ADR-298 §4 Phase C.7 (2026-04-14).
 *
 * @since 2026-04-14 (ADR-298 Phase C.7)
 */

import { initEmulator, teardownEmulator, resetData } from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell } from '../_harness/assertions';
import { seedRelationshipAudit } from '../_harness/seed-helpers-specialized';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'relationship_audit',
)!;

describe('relationship-audit.rules — isAuthenticated read, write=false', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  const docId = 'rel-audit-test-001';

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        await seedRelationshipAudit(env, docId);
        const ctx = getContext(env, cell.persona);
        await assertCell(ctx, cell, {
          collection: 'relationship_audit',
          docId,
          data: { action: 'updated' },
          createData: { relationshipId: 'rel-new', action: 'created', actorId: 'system' },
        });
      });
    });
  }
});
