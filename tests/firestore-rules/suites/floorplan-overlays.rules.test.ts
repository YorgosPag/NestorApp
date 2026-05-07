/**
 * Firestore Rules — `floorplan_overlays` collection (ADR-340 Phase 7)
 *
 * Pattern: role_dual — Q9 RBAC. Same matrix as floorplan_backgrounds.
 *
 * @since 2026-05-07 (ADR-340 Phase 7)
 */

import { initEmulator, teardownEmulator, resetData } from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell, type AssertTarget } from '../_harness/assertions';
import { seedFloorplanOverlay } from '../_harness/seed-helpers-dxf';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { PERSONA_CLAIMS, SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'floorplan_overlays',
)!;

describe('floorplan_overlays.rules — role_dual (ADR-340 Phase 7)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        const docId = 'ovrl-same-tenant';
        await seedFloorplanOverlay(env, docId);
        const ctx = getContext(env, cell.persona);
        const target: AssertTarget = {
          collection: 'floorplan_overlays',
          docId,
          data: {
            polygon: [{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }],
            updatedAt: Date.now(),
            // Preserve immutables (rules require equality with resource.data)
            id: docId,
            companyId: SAME_TENANT_COMPANY_ID,
            backgroundId: 'rbg-test',
            floorId: 'floor-test',
          },
          createData: {
            id: 'ovrl-create-test',
            companyId: SAME_TENANT_COMPANY_ID,
            backgroundId: 'rbg-test',
            floorId: 'floor-test',
            polygon: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }],
            zIndex: 0,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
          listFilter: { field: 'companyId', op: '==', value: SAME_TENANT_COMPANY_ID },
        };
        await assertCell(ctx, cell, target);
      });
    });
  }
});
