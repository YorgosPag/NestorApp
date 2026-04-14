/**
 * Firestore Rules — `relationships` collection
 *
 * Pattern: crmDirectMatrix — companyId gate on create (no isSuperAdminOnly
 * short-circuit); creator + companyAdmin + superAdmin on update/delete.
 *
 * Seed doc: companyId=SAME_TENANT_COMPANY_ID, createdBy=same_tenant_user.uid.
 *   - super_admin × create  → deny (companyId claim 'company-root' ≠ 'company-a')
 *   - same_tenant × create  → allow (companyId==getUserCompanyId())
 *   - same_tenant_user × update/delete → allow (createdBy==uid seed doc)
 *   - same_tenant_admin × update/delete → allow (isCompanyAdminOfCompany)
 *   - super_admin × update/delete → allow (isSuperAdminOnly)
 *
 * Note: ⚠️ contact_relationships has SEPARATE, more strict rules above.
 * This collection is the GENERAL-PURPOSE relationships graph.
 *
 * See ADR-298 §4 Phase C.7 (2026-04-14).
 *
 * @since 2026-04-14 (ADR-298 Phase C.7)
 */

import { initEmulator, teardownEmulator, resetData } from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell } from '../_harness/assertions';
import { seedRelationship } from '../_harness/seed-helpers-specialized';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'relationships',
)!;

describe('relationships.rules — companyId gate create + crmDirect write', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  const docId = 'relationship-test-001';

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        await seedRelationship(env, docId);
        const ctx = getContext(env, cell.persona);
        await assertCell(ctx, cell, {
          collection: 'relationships',
          docId,
          data: {
            relationshipType: 'updated',
            companyId: SAME_TENANT_COMPANY_ID, // immutable — must stay same
            updatedAt: new Date(),
          },
          createData: {
            companyId: SAME_TENANT_COMPANY_ID,
            entityAId: 'entity-a-new',
            entityBId: 'entity-b-new',
            relationshipType: 'related',
          },
          listFilter: { field: 'companyId', op: '==', value: SAME_TENANT_COMPANY_ID },
        });
      });
    });
  }
});
