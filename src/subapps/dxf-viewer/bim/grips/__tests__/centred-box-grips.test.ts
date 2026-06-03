/**
 * ADR-397 / ADR-408 — centred rotatable-box grip SSoT tests.
 *
 * The shared box grip math consumed by BOTH the MEP fixture (rectangular path)
 * and the electrical panel. `sceneUnits: 'mm'` → scale factor s = 1, so mm
 * scalars equal world units and the geometry is exact to assert. These tests pin
 * the SSoT directly (entity adapters have their own thin-mapping tests).
 */

import {
  getCentredBoxGrips,
  applyCentredBoxGripDrag,
  type CentredBoxParams,
} from '../centred-box-grips';

const base: CentredBoxParams = {
  position: { x: 1000, y: 2000, z: 0 },
  rotation: 0,
  width: 600,
  length: 600,
  sceneUnits: 'mm',
};

describe('getCentredBoxGrips', () => {
  it('emits 6 role-tagged grips in stable order', () => {
    expect(getCentredBoxGrips(base).map((g) => g.role)).toEqual([
      'move',
      'rotation',
      'corner-ne',
      'corner-nw',
      'corner-sw',
      'corner-se',
    ]);
  });

  it('places move at centre, corners at ±half-extents, rotation beyond +Y (rotation 0)', () => {
    const byRole = Object.fromEntries(getCentredBoxGrips(base).map((g) => [g.role, g.position]));
    expect(byRole['move']).toEqual({ x: 1000, y: 2000 });
    expect(byRole['rotation']).toEqual({ x: 1000, y: 2500 }); // length/2 (300) + offset 200
    expect(byRole['corner-ne']).toEqual({ x: 1300, y: 2300 });
    expect(byRole['corner-nw']).toEqual({ x: 700, y: 2300 });
    expect(byRole['corner-sw']).toEqual({ x: 700, y: 1700 });
    expect(byRole['corner-se']).toEqual({ x: 1300, y: 1700 });
  });

  it('tags move as movesEntity, others not', () => {
    const grips = getCentredBoxGrips(base);
    expect(grips[0].movesEntity).toBe(true);
    expect(grips.slice(1).every((g) => !g.movesEntity)).toBe(true);
  });
});

describe('applyCentredBoxGripDrag', () => {
  const input = (extra: object) => ({ originalParams: base, minDimensionMm: 20, ...extra });

  it('returns null (no-op) for a zero delta', () => {
    expect(applyCentredBoxGripDrag('corner-ne', input({ delta: { x: 0, y: 0 } }))).toBeNull();
  });

  it('move shifts position, leaves rotation/width/length', () => {
    const p = applyCentredBoxGripDrag('move', input({ delta: { x: 10, y: 20 } }))!;
    expect(p.position).toEqual({ x: 1010, y: 2020, z: 0 });
    expect(p.rotation).toBe(0);
    expect(p.width).toBe(600);
    expect(p.length).toBe(600);
  });

  it('corner-ne grows width, pins the SW corner, re-centres', () => {
    const p = applyCentredBoxGripDrag('corner-ne', input({ delta: { x: 100, y: 0 } }))!;
    expect(p.width).toBe(700);
    expect(p.length).toBe(600);
    expect(p.position).toEqual({ x: 1050, y: 2000, z: 0 });
  });

  it('ORTHO constrains a diagonal corner drag to the dominant local axis', () => {
    const p = applyCentredBoxGripDrag('corner-ne', input({ delta: { x: 200, y: 100 }, ortho: true }))!;
    expect(p.width).toBe(800);
    expect(p.length).toBe(600);
  });

  it('clamps width to minDimensionMm', () => {
    const p = applyCentredBoxGripDrag('corner-ne', input({ delta: { x: -590, y: 0 }, minDimensionMm: 20 }))!;
    expect(p.width).toBe(20);
  });

  it('legacy rotation sweeps angle about own centre, position unchanged', () => {
    const p = applyCentredBoxGripDrag('rotation', input({ delta: { x: -500, y: -500 } }))!;
    expect(p.rotation).toBeCloseTo(90, 5);
    expect(p.position).toEqual({ x: 1000, y: 2000, z: 0 });
  });

  it('pivot rotation orbits position AND sweeps rotation by the same angle', () => {
    const pivotBase: CentredBoxParams = { ...base, position: { x: 1000, y: 0, z: 0 } };
    const p = applyCentredBoxGripDrag('rotation', {
      originalParams: pivotBase,
      minDimensionMm: 20,
      delta: { x: -100, y: 100 },   // alignDir(0,100) − refDir(100,0)
      currentPos: { x: 0, y: 100 }, // pivot + alignDir
      pivot: { x: 0, y: 0 },
    })!;
    expect(p.rotation).toBeCloseTo(90, 5);
    expect(p.position.x).toBeCloseTo(0, 5);
    expect(p.position.y).toBeCloseTo(1000, 5);
  });

  it('returns null when the pivot sweep is degenerate (cursor on pivot)', () => {
    const p = applyCentredBoxGripDrag('rotation', {
      originalParams: base,
      minDimensionMm: 20,
      delta: { x: 5, y: 5 },
      currentPos: { x: 0, y: 0 },
      pivot: { x: 0, y: 0 },
    });
    expect(p).toBeNull();
  });
});
