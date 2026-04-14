/**
 * Firestore Rules — `file_approvals` collection
 *
 * Pattern: custom (fileApprovalsMatrix) — document approval workflows.
 *
 * Key behaviors:
 *   - read/update: `isAuthenticated() && (isSuperAdminOnly || (companyId && belongsToCompany))`
 *   - create: `isAuthenticated() && hasAny(['companyId']) && (isSuperAdminOnly || companyId==getUserCompanyId())`
 *   - delete: `if false` — approval records are immutable business artifacts
 *
 * See ADR-298 §4 Phase C.3 (2026-04-14).
 *
 * @since 2026-04-14 (ADR-298 Phase C.3)
 */

import { initEmulator, teardownEmulator, resetData } from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell, type AssertTarget } from '../_harness/assertions';
import { seedFileApproval } from '../_harness/seed-helpers-dxf';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { PERSONA_CLAIMS, SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'file_approvals',
)!;

describe('file_approvals.rules — custom (fileApprovalsMatrix, delete immutable)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        const docId = 'approval-same-tenant';
        await seedFileApproval(env, docId);
        const ctx = getContext(env, cell.persona);
        const personaClaims = cell.persona !== 'anonymous' ? PERSONA_CLAIMS[cell.persona] : null;
        const uid = personaClaims?.uid ?? 'anon-uid';
        const target: AssertTarget = {
          collection: 'file_approvals',
          docId,
          data: { status: 'approved', reviewedAt: new Date() },
          createData: {
            fileId: 'file-new',
            status: 'pending',
            approvers: [uid],
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
