/**
 * Firestore Rules — `ownership_tables` collection
 *
 * Pattern: tenant_direct (ownershipTablesMatrix) — super-only delete.
 *
 * Update gate uses `belongsToCompany(companyId)`, not createdBy — no creator
 * contract needed. Any same-tenant member (admin or user) can update.
 * Delete = isSuperAdminOnly only: both same_tenant_admin and same_tenant_user denied.
 *
 * Note: the nested `ownership_tables/{id}/revisions/{revId}` subcollection is
 * covered implicitly (4-space-indent parser skips multi-segment paths) and is
 * not a top-level CHECK 3.16 target.
 *
 * See ADR-298 §4 Phase C.4 (2026-04-14).
 *
 * @since 2026-04-14 (ADR-298 Phase C.4)
 */

import { initEmulator, teardownEmulator, resetData } from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell, type AssertTarget } from '../_harness/assertions';
import { seedOwnershipTable } from '../_harness/seed-helpers-boq';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { PERSONA_CLAIMS, SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'ownership_tables',
)!;

describe('ownership_tables.rules — super-only delete (ownershipTablesMatrix)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        const docId = 'ownership-same-tenant';
        await seedOwnershipTable(env, docId);
        const ctx = getContext(env, cell.persona);
        const personaClaims = cell.persona !== 'anonymous' ? PERSONA_CLAIMS[cell.persona] : null;
        const uid = personaClaims?.uid ?? 'anon-uid';
        const target: AssertTarget = {
          collection: 'ownership_tables',
          docId,
          data: { name: 'Updated Ownership Table', updatedAt: new Date() },
          createData: {
            companyId: SAME_TENANT_COMPANY_ID,
            buildingId: 'building-new',
            name: 'New Ownership Table',
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
