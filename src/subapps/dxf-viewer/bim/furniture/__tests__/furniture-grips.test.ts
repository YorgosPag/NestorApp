/**
 * ADR-410 — furniture parametric grip tests.
 *
 * Pure math (no React/DOM): grip emission + drag transforms. `sceneUnits: 'mm'`
 * → scale factor s = 1, so mm scalars equal world units and the geometry is
 * exact to assert. Mirrors `mep-fixture-grips` coverage, minus the circular path
 * (furniture is rectangular-only). All geometry/rotation math lives in the shared
 * centred-box SSoT; these tests pin the furniture adapter's role/field mapping.
 */

import { getFurnitureGrips, applyFurnitureGripDrag } from '../furniture-grips';
import type { FurnitureEntity, FurnitureParams } from '../../types/furniture-types';
import { MIN_FURNITURE_DIMENSION_MM } from '../../types/furniture-types';
import { gripKindOf } from '../../../hooks/grip-kinds';

const baseParams: FurnitureParams = {
  kind: 'chair',
  assetId: 'chair_01',
  position: { x: 1000, y: 2000, z: 0 },
  rotationDeg: 0,
  widthMm: 600,
  depthMm: 600,
  heightMm: 900,
  mountingElevationMm: 0,
  sceneUnits: 'mm',
};

function entityWith(overrides: Partial<FurnitureParams> = {}): FurnitureEntity {
  return {
    id: 'furn-1',
    type: 'furniture',
    params: { ...baseParams, ...overrides },
  } as unknown as FurnitureEntity;
}

describe('getFurnitureGrips', () => {
  // ADR-363 Φ1G.5 Slice 2 — move grip no longer emitted; 6→5 grips, rotation at array index 0.
  it('emits 5 grips for a rectangular furniture in stable order', () => {
    const grips = getFurnitureGrips(entityWith());
    expect(grips.map((g) => gripKindOf(g, 'furniture'))).toEqual([
      'furniture-rotation',
      'furniture-corner-ne',
      'furniture-corner-nw',
      'furniture-corner-sw',
      'furniture-corner-se',
    ]);
  });

  // ADR-363 Φ1G.5 Slice 2 — furniture-move grip removed; assert only corners (byKind lookup unaffected by array shift).
  it('places corners at ±half-extents (rotation 0)', () => {
    const grips = getFurnitureGrips(entityWith());
    const byKind = Object.fromEntries(grips.map((g) => [gripKindOf(g, 'furniture'), g.position]));
    expect(byKind['furniture-corner-ne']).toEqual({ x: 1300, y: 2300 });
    expect(byKind['furniture-corner-nw']).toEqual({ x: 700, y: 2300 });
    expect(byKind['furniture-corner-sw']).toEqual({ x: 700, y: 1700 });
    expect(byKind['furniture-corner-se']).toEqual({ x: 1300, y: 1700 });
  });

  it('places the rotation handle beyond the +Y edge (depth/2 + offset)', () => {
    // ADR-363 Φ1G.5 Slice 2 — move grip gone; rotation is now array index 0 (gripIndex still 1).
    const [rotation] = getFurnitureGrips(entityWith());
    // depth/2 (300) + ROTATION_HANDLE_OFFSET_MM (0) = 300 above centre (on the face).
    expect(rotation.position).toEqual({ x: 1000, y: 2300 });
  });
});

describe('applyFurnitureGripDrag', () => {
  it('returns originalParams referentially for a zero delta', () => {
    const p = baseParams;
    expect(applyFurnitureGripDrag('furniture-corner-ne', { originalParams: p, delta: { x: 0, y: 0 } })).toBe(p);
  });

  it('move translates position by the delta', () => {
    const next = applyFurnitureGripDrag('furniture-move', { originalParams: baseParams, delta: { x: 10, y: 20 } });
    expect(next.position).toEqual({ x: 1010, y: 2020, z: 0 });
  });

  it('corner-ne grows width toward the cursor, pins the opposite (SW) corner, re-centres', () => {
    const next = applyFurnitureGripDrag('furniture-corner-ne', { originalParams: baseParams, delta: { x: 100, y: 0 } });
    expect(next.widthMm).toBe(700);
    expect(next.depthMm).toBe(600);
    // SW corner stays at (700, 1700) → new centre = (700 + 700/2, 1700 + 600/2).
    expect(next.position).toEqual({ x: 1050, y: 2000, z: 0 });
  });

  it('ORTHO constrains a diagonal corner drag to the dominant local axis', () => {
    const next = applyFurnitureGripDrag('furniture-corner-ne', {
      originalParams: baseParams,
      delta: { x: 200, y: 100 },
      ortho: true,
    });
    expect(next.widthMm).toBe(800);  // dominant +X applied
    expect(next.depthMm).toBe(600);  // +Y suppressed by ortho
  });

  it('clamps width to the minimum dimension', () => {
    const next = applyFurnitureGripDrag('furniture-corner-ne', { originalParams: baseParams, delta: { x: -590, y: 0 } });
    expect(next.widthMm).toBe(MIN_FURNITURE_DIMENSION_MM);
  });

  it('rotation handle drag sweeps the rotation angle about the centre', () => {
    // Handle now starts at (1000, 2300) (offset 0); move it to (500, 2000) → vector (0,300)→(-500,0) = +90°.
    const next = applyFurnitureGripDrag('furniture-rotation', { originalParams: baseParams, delta: { x: -500, y: -300 } });
    expect(next.rotationDeg).toBeCloseTo(90, 5);
  });
});

// ADR-397 / ADR-410 — 6-click ROTATE→Reference about an arbitrary picked centre.
describe('applyFurnitureGripDrag — pivot rotate (hot-grip 6-click)', () => {
  // Furniture at (1000, 0); pivot at origin. Reference dir = +X, alignment dir = +Y
  // → swept 90° CCW. delta = alignDir − refDir; currentPos = pivot + alignDir.
  const pivotParams: FurnitureParams = { ...baseParams, position: { x: 1000, y: 0, z: 0 }, rotationDeg: 0 };

  it('orbits position about the pivot AND sweeps rotation by the same angle', () => {
    const next = applyFurnitureGripDrag('furniture-rotation', {
      originalParams: pivotParams,
      delta: { x: -100, y: 100 },        // alignDir(0,100) − refDir(100,0)
      currentPos: { x: 0, y: 100 },      // pivot + alignDir
      pivot: { x: 0, y: 0 },
    });
    expect(next.rotationDeg).toBeCloseTo(90, 5);
    expect(next.position.x).toBeCloseTo(0, 5);
    expect(next.position.y).toBeCloseTo(1000, 5);
    expect(next.position.z).toBe(0);
  });

  it('falls back to own-centre rotation when no pivot is supplied (legacy drag)', () => {
    // Position must NOT orbit (no pivot) — only the angle changes (handle-relative).
    const next = applyFurnitureGripDrag('furniture-rotation', {
      originalParams: pivotParams,
      delta: { x: -500, y: -300 },
    });
    expect(next.position).toEqual({ x: 1000, y: 0, z: 0 });
    expect(next.rotationDeg).toBeCloseTo(90, 5);
  });
});
