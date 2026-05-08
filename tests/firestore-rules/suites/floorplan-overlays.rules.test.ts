/**
 * Firestore Rules — `floorplan_overlays` collection (ADR-340 Phase 9)
 *
 * Pattern: role_dual — Q9 RBAC + multi-kind discriminated-union schema.
 * Geometry + role consistency + linked-entity matrix enforced by rules.
 *
 * @since 2026-05-07 (Phase 7) — 2026-05-08 (Phase 9: geometry+role+linked matrix)
 */

import { initEmulator, teardownEmulator, resetData } from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell, type AssertTarget } from '../_harness/assertions';
import { seedFloorplanOverlay } from '../_harness/seed-helpers-dxf';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { PERSONA_CLAIMS, SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'floorplan_overlays',
)!;

const SAMPLE_POLYGON_VERTICES = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
];

describe('floorplan_overlays.rules — role_dual (ADR-340 Phase 9)', () => {
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
            geometry: {
              type: 'polygon',
              vertices: [{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }],
            },
            role: 'auxiliary',
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
            geometry: { type: 'polygon', vertices: SAMPLE_POLYGON_VERTICES },
            role: 'auxiliary',
            createdBy: 'create-user',
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

describe('floorplan_overlays.rules — role↔geometry matrix (Phase 9)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  function buildCreateDoc(role: string, geometry: unknown, linked?: unknown) {
    return {
      id: 'ovrl-matrix-test',
      companyId: SAME_TENANT_COMPANY_ID,
      backgroundId: 'rbg-test',
      floorId: 'floor-test',
      geometry,
      role,
      ...(linked !== undefined ? { linked } : {}),
      createdBy: 'matrix-user',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  async function tryCreate(role: string, geometry: unknown, linked?: unknown) {
    const ctx = getContext(env, 'same_tenant_user');
    return ctx
      .firestore()
      .collection('floorplan_overlays')
      .doc('ovrl-matrix-test')
      .set(buildCreateDoc(role, geometry, linked));
  }

  // ── ALLOWED combinations ────────────────────────────────────────────────────

  it('allows role:property + polygon + linked.propertyId', async () => {
    await assertSucceeds(
      tryCreate(
        'property',
        { type: 'polygon', vertices: SAMPLE_POLYGON_VERTICES },
        { propertyId: 'prop_123' },
      ),
    );
  });

  it('allows role:annotation + line', async () => {
    await assertSucceeds(
      tryCreate('annotation', { type: 'line', start: { x: 0, y: 0 }, end: { x: 5, y: 5 } }),
    );
  });

  it('allows role:annotation + circle', async () => {
    await assertSucceeds(
      tryCreate('annotation', { type: 'circle', center: { x: 0, y: 0 }, radius: 5 }),
    );
  });

  it('allows role:annotation + dimension', async () => {
    await assertSucceeds(
      tryCreate('annotation', {
        type: 'dimension',
        from: { x: 0, y: 0 },
        to: { x: 10, y: 0 },
      }),
    );
  });

  it('allows role:auxiliary + any geometry (text)', async () => {
    await assertSucceeds(
      tryCreate('auxiliary', {
        type: 'text',
        position: { x: 0, y: 0 },
        text: 'Είσοδος',
      }),
    );
  });

  // ── REJECTED combinations ───────────────────────────────────────────────────

  it('rejects role:property + circle (polygon-only role)', async () => {
    await assertFails(
      tryCreate(
        'property',
        { type: 'circle', center: { x: 0, y: 0 }, radius: 5 },
        { propertyId: 'prop_123' },
      ),
    );
  });

  it('rejects role:property without linked.propertyId', async () => {
    await assertFails(
      tryCreate('property', { type: 'polygon', vertices: SAMPLE_POLYGON_VERTICES }),
    );
  });

  it('rejects role:annotation + polygon (annotation excludes polygon)', async () => {
    await assertFails(
      tryCreate('annotation', { type: 'polygon', vertices: SAMPLE_POLYGON_VERTICES }),
    );
  });

  it('rejects role:parking + polygon without linked.parkingId', async () => {
    await assertFails(
      tryCreate('parking', { type: 'polygon', vertices: SAMPLE_POLYGON_VERTICES }),
    );
  });

  it('rejects unknown geometry.type', async () => {
    await assertFails(
      tryCreate('annotation', { type: 'spline', vertices: SAMPLE_POLYGON_VERTICES }),
    );
  });

  it('rejects unknown role', async () => {
    await assertFails(
      tryCreate('phantom', { type: 'polygon', vertices: SAMPLE_POLYGON_VERTICES }),
    );
  });
});
