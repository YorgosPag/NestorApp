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
  it('emits 6 grips for a rectangular fixture in stable order', () => {
    const grips = getMepFixtureGrips(entityWith());
    expect(grips.map((g) => g.mepFixtureGripKind)).toEqual([
      'mep-fixture-move',
      'mep-fixture-rotation',
      'mep-fixture-corner-ne',
      'mep-fixture-corner-nw',
      'mep-fixture-corner-sw',
      'mep-fixture-corner-se',
    ]);
  });

  it('places the move grip at the centre and corners at ±half-extents (rotation 0)', () => {
    const grips = getMepFixtureGrips(entityWith());
    const byKind = Object.fromEntries(grips.map((g) => [g.mepFixtureGripKind, g.position]));
    expect(byKind['mep-fixture-move']).toEqual({ x: 1000, y: 2000 });
    expect(byKind['mep-fixture-corner-ne']).toEqual({ x: 1300, y: 2300 });
    expect(byKind['mep-fixture-corner-nw']).toEqual({ x: 700, y: 2300 });
    expect(byKind['mep-fixture-corner-sw']).toEqual({ x: 700, y: 1700 });
    expect(byKind['mep-fixture-corner-se']).toEqual({ x: 1300, y: 1700 });
  });

  it('places the rotation handle beyond the +Y edge (length/2 + offset)', () => {
    const [, rotation] = getMepFixtureGrips(entityWith());
    // length/2 (300) + ROTATION_HANDLE_OFFSET_MM (200) = 500 above centre.
    expect(rotation.position).toEqual({ x: 1000, y: 2500 });
  });

  it('emits only centre + diameter for a circular fixture', () => {
    const grips = getMepFixtureGrips(entityWith({ shape: 'circular', width: 200 }));
    expect(grips.map((g) => g.mepFixtureGripKind)).toEqual([
      'mep-fixture-move',
      'mep-fixture-diameter',
    ]);
    expect(grips[1].position).toEqual({ x: 1100, y: 2000 });
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
    // Handle starts at (1000, 2500); move it to (500, 2000) → vector (0,500)→(-500,0) = +90°.
    const next = applyMepFixtureGripDrag('mep-fixture-rotation', { originalParams: baseParams, delta: { x: -500, y: -500 } });
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
