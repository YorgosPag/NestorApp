/**
 * Firestore Rules — `boq_items` collection
 *
 * Pattern: tenant_direct (fileTenantFullMatrix) — full CRUD for super_admin and
 * all same-tenant members. Delete gated on `status in ['draft', 'submitted']`
 * (seed doc sets status='draft'). Update immutable: buildingId, projectId, companyId
 * must remain unchanged (Firestore update() merges — seeded values persist in
 * request.resource.data even when not in the update payload).
 *
 * See ADR-298 §4 Phase C.4 (2026-04-14).
 *
 * @since 2026-04-14 (ADR-298 Phase C.4)
 */

import { initEmulator, teardownEmulator, resetData } from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell, type AssertTarget } from '../_harness/assertions';
import { seedBoqItem } from '../_harness/seed-helpers-boq';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { PERSONA_CLAIMS, SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'boq_items',
)!;

describe('boq_items.rules — tenant_direct (fileTenantFullMatrix)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        const docId = 'boq-item-same-tenant';
        await seedBoqItem(env, docId);
        const ctx = getContext(env, cell.persona);
        const personaClaims = cell.persona !== 'anonymous' ? PERSONA_CLAIMS[cell.persona] : null;
        const uid = personaClaims?.uid ?? 'anon-uid';
        const target: AssertTarget = {
          collection: 'boq_items',
          docId,
          // Update payload: omitting buildingId/projectId/companyId is safe — Firestore
          // update() merges, so seeded values remain in request.resource.data, satisfying
          // the immutability checks. Status left as seeded 'draft' (valid enum value).
          data: { updatedAt: new Date() },
          createData: {
            companyId: SAME_TENANT_COMPANY_ID,
            projectId: 'project-new',
            buildingId: 'building-new',
            categoryCode: 'STRUCT-002',
            title: 'New BoQ Item',
            unit: 'm2',
            status: 'draft',
            estimatedQuantity: 50,
            createdBy: uid,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          listFilter: { field: 'companyId', op: '==', value: SAME_TENANT_COMPANY_ID },
        };
        await assertCell(ctx, cell, target);
      });
    });
  }
});
