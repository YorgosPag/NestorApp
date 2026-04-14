/**
 * Firestore Rules — `employment_records` collection
 *
 * Pattern: weak write gate — any authenticated user can create/update;
 * reads are tenant-scoped; delete is permanently forbidden.
 *
 * Seed doc: companyId=SAME_TENANT_COMPANY_ID, projectId=EMPLOYMENT_RECORD_PROJECT_ID,
 *           contactId=EMPLOYMENT_RECORD_CONTACT_ID.
 *   - same-tenant × read/list → allow (belongsToCompany companyId)
 *   - cross_tenant × read/list → deny (companyId mismatch)
 *   - all authenticated × create → allow (isAuthenticated + required fields)
 *   - all authenticated × update → allow (isAuthenticated + field immutability)
 *   - all personas × delete → deny (allow delete: if false)
 *
 * Update contract: data must preserve projectId and contactId (immutability rule).
 * Create contract: data must include all required fields + apdStatus enum value.
 *
 * See ADR-298 §4 Phase C.7 (2026-04-14).
 *
 * @since 2026-04-14 (ADR-298 Phase C.7)
 */

import { initEmulator, teardownEmulator, resetData } from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell } from '../_harness/assertions';
import {
  seedEmploymentRecord,
  EMPLOYMENT_RECORD_PROJECT_ID,
  EMPLOYMENT_RECORD_CONTACT_ID,
} from '../_harness/seed-helpers-specialized';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'employment_records',
)!;

describe('employment-records.rules — tenant read, open authenticated create/update', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  const docId = 'employment-rec-test-001';

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        await seedEmploymentRecord(env, docId);
        const ctx = getContext(env, cell.persona);
        await assertCell(ctx, cell, {
          collection: 'employment_records',
          docId,
          // Update data: projectId + contactId must be preserved (immutability check)
          data: {
            projectId: EMPLOYMENT_RECORD_PROJECT_ID,
            contactId: EMPLOYMENT_RECORD_CONTACT_ID,
            apdStatus: 'submitted',
            updatedAt: new Date(),
          },
          // Create data: all required fields + valid apdStatus enum
          createData: {
            projectId: EMPLOYMENT_RECORD_PROJECT_ID,
            contactId: EMPLOYMENT_RECORD_CONTACT_ID,
            month: 5,
            year: 2026,
            totalDaysWorked: 20,
            insuranceClassNumber: 1,
            stampsCount: 25,
            employerContribution: 400,
            employeeContribution: 200,
            totalContribution: 600,
            apdStatus: 'pending',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          listFilter: { field: 'companyId', op: '==', value: SAME_TENANT_COMPANY_ID },
        });
      });
    });
  }
});
