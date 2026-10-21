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

import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
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
            scope: 'building',
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

/**
 * ADR-917 Ε2 · Α34 — a wall SUMMARY's price is derived from its layers: a same-tenant member may keep it or
 * clear it to 0, never set it; and the role cannot be rewritten to unlock it. Plain lines stay free.
 */
describe('boq_items.rules — summary price is derived (ADR-917 Ε2 · Α34)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  const member = () => getContext(env, 'same_tenant_user').firestore().collection('boq_items');
  const summary = { groupRole: 'summary', isGroupParent: true, materialUnitCost: 7, laborUnitCost: 0, equipmentUnitCost: 0 };

  it('🔴 setting a price on a summary is refused', async () => {
    await seedBoqItem(env, 'w', { overrides: summary });
    await assertFails(member().doc('w').update({ materialUnitCost: 12 }));
  });

  it('keeping it or clearing it to 0 is allowed (model sync · cleanup)', async () => {
    await seedBoqItem(env, 'w', { overrides: summary });
    await assertSucceeds(member().doc('w').update({ materialUnitCost: 7, notes: 'x' }));
    await assertSucceeds(member().doc('w').update({ materialUnitCost: 0 }));
  });

  it('🔴 the role cannot be rewritten to unlock the price', async () => {
    await seedBoqItem(env, 'w', { overrides: summary });
    await assertFails(member().doc('w').update({ groupRole: 'work' }));
  });

  it('a legacy row without a role may receive one (backfill · bridge)', async () => {
    await seedBoqItem(env, 'w', { overrides: { isGroupParent: true } });
    await assertSucceeds(member().doc('w').update({ groupRole: 'summary', materialUnitCost: 0 }));
  });

  it('🔴 a summary is never CREATED priced; a plain line is', async () => {
    const base = {
      companyId: SAME_TENANT_COMPANY_ID, projectId: 'p', buildingId: 'b', categoryCode: 'OIK-3', title: 't', unit: 'm2',
      status: 'draft', scope: 'building', estimatedQuantity: 1, createdAt: new Date(), updatedAt: new Date(),
    };
    await assertFails(member().doc('n1').set({ ...base, groupRole: 'summary', materialUnitCost: 5 }));
    await assertSucceeds(member().doc('n2').set({ ...base, groupRole: 'summary', materialUnitCost: 0 }));
    await assertSucceeds(member().doc('n3').set({ ...base, materialUnitCost: 5 }));
  });

  it('the price of a plain line stays free', async () => {
    await seedBoqItem(env, 'l', { overrides: { materialUnitCost: 1 } });
    await assertSucceeds(member().doc('l').update({ materialUnitCost: 9 }));
  });
});
