/**
 * ADR-422 L0 — computeThermalSpaceGeometry unit tests (ΤΟΤΕΕ/EN 12831 volume).
 */

import {
  computeThermalSpaceGeometry,
  type ThermalSpaceParams,
} from '../thermal-space-types';

function squareFootprint(sideMm: number) {
  return {
    vertices: [
      { x: 0, y: 0, z: 0 },
      { x: sideMm, y: 0, z: 0 },
      { x: sideMm, y: sideMm, z: 0 },
      { x: 0, y: sideMm, z: 0 },
    ],
  };
}

describe('computeThermalSpaceGeometry', () => {
  it('derives area (m²), perimeter (m) and volume (m³) from a 1m×1m square at 3m height', () => {
    const params: Pick<ThermalSpaceParams, 'footprint' | 'ceilingHeightMm'> = {
      footprint: squareFootprint(1000),
      ceilingHeightMm: 3000,
    };
    const g = computeThermalSpaceGeometry(params);
    expect(g.area).toBeCloseTo(1, 6);
    expect(g.perimeter).toBeCloseTo(4, 6);
    expect(g.volume).toBeCloseTo(3, 6); // 1 m² × 3 m
  });

  it('scales volume with ceiling height', () => {
    const g = computeThermalSpaceGeometry({
      footprint: squareFootprint(2000), // 2m×2m = 4 m²
      ceilingHeightMm: 2500, // 2.5 m
    });
    expect(g.area).toBeCloseTo(4, 6);
    expect(g.volume).toBeCloseTo(10, 6); // 4 × 2.5
  });

  it('converts a metres-unit scene footprint correctly (4m×4m = 16 m²)', () => {
    const g = computeThermalSpaceGeometry({
      footprint: {
        vertices: [
          { x: 0, y: 0, z: 0 },
          { x: 4, y: 0, z: 0 },
          { x: 4, y: 4, z: 0 },
          { x: 0, y: 4, z: 0 },
        ],
      },
      ceilingHeightMm: 3000,
      sceneUnits: 'm',
    });
    expect(g.area).toBeCloseTo(16, 6); // 4 × 4 m²
    expect(g.perimeter).toBeCloseTo(16, 6); // 4 × 4 m
    expect(g.volume).toBeCloseTo(48, 6); // 16 × 3 m
  });

  it('returns zeroed geometry for a degenerate (<3 vertices) footprint', () => {
    const g = computeThermalSpaceGeometry({
      footprint: { vertices: [{ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 0 }] },
      ceilingHeightMm: 3000,
    });
    expect(g.area).toBe(0);
    expect(g.perimeter).toBe(0);
    expect(g.volume).toBe(0);
  });

  it('treats a non-positive ceiling height as zero volume (defensive)', () => {
    const g = computeThermalSpaceGeometry({
      footprint: squareFootprint(1000),
      ceilingHeightMm: -100,
    });
    expect(g.area).toBeCloseTo(1, 6);
    expect(g.volume).toBe(0);
  });
});
