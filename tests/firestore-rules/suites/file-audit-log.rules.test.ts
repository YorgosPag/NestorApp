/**
 * Firestore Rules — `file_audit_log` collection
 *
 * Pattern: custom (fileAuditLogMatrix) — append-only file audit trail.
 *
 * Key deltas:
 *   - read: `isAuthenticated() && belongsToCompany(companyId)` — NO `isSuperAdminOnly()`.
 *     super_admin (companyId='company-root') fails the tenant gate → DENY.
 *   - create: `isAuthenticated() && (isSuperAdminOnly() || companyId==getUserCompanyId())`
 *     super_admin is explicitly allowed on create (server-initiated writes from the
 *     super-admin context use the client SDK here).
 *   - update/delete: `if false` — audit records are immutable.
 *
 * See ADR-298 §4 Phase C.3 (2026-04-14).
 *
 * @since 2026-04-14 (ADR-298 Phase C.3)
 */

import { initEmulator, teardownEmulator, resetData } from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell, type AssertTarget } from '../_harness/assertions';
import { seedFileAuditLog } from '../_harness/seed-helpers-dxf';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'file_audit_log',
)!;

describe('file_audit_log.rules — custom (fileAuditLogMatrix, super_admin read denied)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        const docId = 'audit-same-tenant';
        await seedFileAuditLog(env, docId);
        const ctx = getContext(env, cell.persona);
        const target: AssertTarget = {
          collection: 'file_audit_log',
          docId,
          data: { action: 'download' },  // update target (will be denied by rule)
          createData: {
            action: 'upload',
            fileId: 'file-new',
            companyId: SAME_TENANT_COMPANY_ID,
            performedBy: 'system',
            timestamp: new Date(),
          },
          listFilter: { field: 'companyId', op: '==', value: SAME_TENANT_COMPANY_ID },
        };
        await assertCell(ctx, cell, target);
      });
    });
  }
});
