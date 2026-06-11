/**
 * ADR-406 — MEP fixture parametric grip tests.
 *
 * Pure math (no React/DOM): grip emission + drag transforms. `sceneUnits: 'mm'`
 * → scale factor s = 1, so mm scalars equal world units and the geometry is
 * exact to assert. Mirrors `column-grips` test coverage.
 */

import { getMepFixtureGrips, applyMepFixtureGripDrag } from '../mep-fixture-grips';
import type { MepFixtureEntity, MepFixtureParams } from '../../types/mep-fixture-types';
import { MIN_FIXTURE_DIMENSION_MM } from '../../types/mep-fixture-types';

const baseParams: MepFixtureParams = {
  kind: 'light-fixture',
  shape: 'rectangular',
  position: { x: 1000, y: 2000, z: 0 },
  rotation: 0,
  width: 600,
  length: 600,
  bodyHeightMm: 80,
  mountingElevationMm: 2700,
  sceneUnits: 'mm',
};

function entityWith(overrides: Partial<MepFixtureParams> = {}): MepFixtureEntity {
  return {
    id: 'fix-1',
    type: 'mep-fixture',
    params: { ...baseParams, ...overrides },
  } as unknown as MepFixtureEntity;
}

describe('getMepFixtureGrips', () => {
  // ADR-363 Φ1G.5 Slice 2 — move grip removed; 5 grips, rotation is index 0.
  it('emits 5 grips for a rectangular fixture in stable order', () => {
    const grips = getMepFixtureGrips(entityWith());
    expect(grips.map((g) => g.mepFixtureGripKind)).toEqual([
      'mep-fixture-rotation',
      'mep-fixture-corner-ne',
      'mep-fixture-corner-nw',
      'mep-fixture-corner-sw',
      'mep-fixture-corner-se',
    ]);
  });

  // ADR-363 Φ1G.5 Slice 2 — move grip removed; byKind lookup for corners unchanged.
  it('places corners at ±half-extents (rotation 0)', () => {
    const grips = getMepFixtureGrips(entityWith());
    const byKind = Object.fromEntries(grips.map((g) => [g.mepFixtureGripKind, g.position]));
    expect(byKind['mep-fixture-move']).toBeUndefined();
    expect(byKind['mep-fixture-corner-ne']).toEqual({ x: 1300, y: 2300 });
    expect(byKind['mep-fixture-corner-nw']).toEqual({ x: 700, y: 2300 });
    expect(byKind['mep-fixture-corner-sw']).toEqual({ x: 700, y: 1700 });
    expect(byKind['mep-fixture-corner-se']).toEqual({ x: 1300, y: 1700 });
  });

  it('places the rotation handle ON the +Y edge (length/2 + offset 0)', () => {
    // ADR-363 Φ1G.5 Slice 2 — move grip gone; rotation is now array index 0.
    const [rotation] = getMepFixtureGrips(entityWith());
    // length/2 (300) + ROTATION_HANDLE_OFFSET_MM (0) = 300 above centre (on the face).
    expect(rotation.position).toEqual({ x: 1000, y: 2300 });
  });

  // ADR-363 Φ1G.5 Slice 2 — move grip removed from circular; only diameter remains.
  // gripIndex field stays 1 (no reindex); array index 0 is the sole grip.
  it('emits only diameter for a circular fixture', () => {
    const grips = getMepFixtureGrips(entityWith({ shape: 'circular', width: 200 }));
    expect(grips).toHaveLength(1);
    expect(grips.map((g) => g.mepFixtureGripKind)).toEqual([
      'mep-fixture-diameter',
    ]);
    // gripIndex field is 1 (unused gap at 0 — no reindex per Slice 2 contract).
    expect(grips[0].gripIndex).toBe(1);
    expect(grips[0].position).toEqual({ x: 1100, y: 2000 });
  });
});

describe('applyMepFixtureGripDrag', () => {
  it('returns originalParams referentially for a zero delta', () => {
    const p = baseParams;
    expect(applyMepFixtureGripDrag('mep-fixture-corner-ne', { originalParams: p, delta: { x: 0, y: 0 } })).toBe(p);
  });

  it('move translates position by the delta', () => {
    const next = applyMepFixtureGripDrag('mep-fixture-move', { originalParams: baseParams, delta: { x: 10, y: 20 } });
    expect(next.position).toEqual({ x: 1010, y: 2020, z: 0 });
  });

  it('corner-ne grows width toward the cursor, pins the opposite (SW) corner, re-centres', () => {
    const next = applyMepFixtureGripDrag('mep-fixture-corner-ne', { originalParams: baseParams, delta: { x: 100, y: 0 } });
    expect(next.width).toBe(700);
    expect(next.length).toBe(600);
    // SW corner stays at (700, 1700) → new centre = (700 + 700/2, 1700 + 600/2).
    expect(next.position).toEqual({ x: 1050, y: 2000, z: 0 });
  });

  it('ORTHO constrains a diagonal corner drag to the dominant local axis', () => {
    const next = applyMepFixtureGripDrag('mep-fixture-corner-ne', {
      originalParams: baseParams,
      delta: { x: 200, y: 100 },
      ortho: true,
    });
    expect(next.width).toBe(800);  // dominant +X applied
    expect(next.length).toBe(600); // +Y suppressed by ortho
  });

  it('clamps width to the minimum dimension', () => {
    const next = applyMepFixtureGripDrag('mep-fixture-corner-ne', { originalParams: baseParams, delta: { x: -590, y: 0 } });
    expect(next.width).toBe(MIN_FIXTURE_DIMENSION_MM);
  });

  it('rotation handle drag sweeps the rotation angle about the centre', () => {
    // Handle now starts at (1000, 2300) (offset 0); move it to (500, 2000) → vector (0,300)→(-500,0) = +90°.
    const next = applyMepFixtureGripDrag('mep-fixture-rotation', { originalParams: baseParams, delta: { x: -500, y: -300 } });
    expect(next.rotation).toBeCloseTo(90, 5);
  });

  it('diameter drag resizes a circular fixture symmetrically (2×)', () => {
    const next = applyMepFixtureGripDrag('mep-fixture-diameter', {
      originalParams: { ...baseParams, shape: 'circular', width: 200 },
      delta: { x: 50, y: 0 },
    });
    expect(next.width).toBe(300); // 200 + 2*50
  });
});

// ADR-397 / ADR-406 — 6-click ROTATE→Reference about an arbitrary picked centre.
describe('applyMepFixtureGripDrag — pivot rotate (hot-grip 6-click)', () => {
  // Fixture at (1000, 0); pivot at origin. Reference dir = +X, alignment dir = +Y
  // → swept 90° CCW. delta = alignDir − refDir; currentPos = pivot + alignDir.
  const pivotParams: MepFixtureParams = { ...baseParams, position: { x: 1000, y: 0, z: 0 }, rotation: 0 };

  it('orbits position about the pivot AND sweeps rotation by the same angle', () => {
    const next = applyMepFixtureGripDrag('mep-fixture-rotation', {
      originalParams: pivotParams,
      delta: { x: -100, y: 100 },        // alignDir(0,100) − refDir(100,0)
      currentPos: { x: 0, y: 100 },      // pivot + alignDir
      pivot: { x: 0, y: 0 },
    });
    expect(next.rotation).toBeCloseTo(90, 5);
    expect(next.position.x).toBeCloseTo(0, 5);
    expect(next.position.y).toBeCloseTo(1000, 5);
    expect(next.position.z).toBe(0);
  });

  it('falls back to own-centre rotation when no pivot is supplied (legacy drag)', () => {
    // Position must NOT orbit (no pivot) — only the angle changes (handle-relative).
    const next = applyMepFixtureGripDrag('mep-fixture-rotation', {
      originalParams: pivotParams,
      delta: { x: -500, y: -300 },
    });
    expect(next.position).toEqual({ x: 1000, y: 0, z: 0 });
    expect(next.rotation).toBeCloseTo(90, 5);
  });

  it('circular fixture ignores rotation (pivot path no-op)', () => {
    const circ: MepFixtureParams = { ...pivotParams, shape: 'circular' };
    const next = applyMepFixtureGripDrag('mep-fixture-rotation', {
      originalParams: circ,
      delta: { x: -100, y: 100 },
      currentPos: { x: 0, y: 100 },
      pivot: { x: 0, y: 0 },
    });
    expect(next).toBe(circ);
  });
});
