/**
 * Firestore Rules — `commission_records` collection
 *
 * Pattern: tenant_direct (commissionRecordsMatrix) — super-only delete.
 *
 * Seed doc: createdBy = same_tenant_user.uid.
 *   - same_tenant_user × update → allow (uid == createdBy)
 *   - same_tenant_user × delete → deny (not super_admin)
 *   - same_tenant_admin × delete → deny (not super_admin)
 *   - super_admin × delete → allow (isSuperAdminOnly)
 *
 * See ADR-298 §4 Phase C.4 (2026-04-14).
 *
 * @since 2026-04-14 (ADR-298 Phase C.4)
 */

import { initEmulator, teardownEmulator, resetData } from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell, type AssertTarget } from '../_harness/assertions';
import { seedCommissionRecord } from '../_harness/seed-helpers-boq';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { PERSONA_CLAIMS, SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'commission_records',
)!;

describe('commission_records.rules — super-only delete (commissionRecordsMatrix)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        const docId = 'commission-same-tenant';
        await seedCommissionRecord(env, docId);
        const ctx = getContext(env, cell.persona);
        const personaClaims = cell.persona !== 'anonymous' ? PERSONA_CLAIMS[cell.persona] : null;
        const uid = personaClaims?.uid ?? 'anon-uid';
        const target: AssertTarget = {
          collection: 'commission_records',
          docId,
          data: { notes: 'Updated notes', updatedAt: new Date() },
          createData: {
            companyId: SAME_TENANT_COMPANY_ID,
            projectId: 'project-new',
            agentContactId: 'agent-new',
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
