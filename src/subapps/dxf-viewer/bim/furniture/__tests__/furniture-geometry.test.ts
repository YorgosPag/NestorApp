/**
 * ADR-410 — Furniture geometry + validation unit tests.
 */

import {
  computeFurnitureGeometry,
  validateFurnitureParams,
} from '../furniture-geometry';
import type { FurnitureParams } from '../../types/furniture-types';

function baseParams(overrides: Partial<FurnitureParams> = {}): FurnitureParams {
  return {
    kind: 'chair',
    assetId: 'chair_01',
    position: { x: 1000, y: 2000, z: 0 },
    rotationDeg: 0,
    widthMm: 500,
    depthMm: 520,
    heightMm: 900,
    mountingElevationMm: 0,
    sceneUnits: 'mm',
    ...overrides,
  };
}

describe('computeFurnitureGeometry', () => {
  it('builds a 4-vertex footprint centred on position (mm scene)', () => {
    const g = computeFurnitureGeometry(baseParams());
    expect(g.footprint.vertices).toHaveLength(4);
    // centred at (1000,2000), 500×520 → ±250 / ±260.
    expect(g.bbox.min.x).toBeCloseTo(750);
    expect(g.bbox.max.x).toBeCloseTo(1250);
    expect(g.bbox.min.y).toBeCloseTo(1740);
    expect(g.bbox.max.y).toBeCloseTo(2260);
  });

  it('area in m² (500×520 mm = 0.26 m²)', () => {
    expect(computeFurnitureGeometry(baseParams()).area).toBeCloseTo(0.26, 4);
  });

  it('mirrors heightMm into geometry.height', () => {
    expect(computeFurnitureGeometry(baseParams()).height).toBe(900);
  });

  it('rotation rotates the footprint about the position', () => {
    const g = computeFurnitureGeometry(baseParams({ widthMm: 500, depthMm: 500, rotationDeg: 45 }));
    const span = g.bbox.max.x - g.bbox.min.x;
    expect(span).toBeCloseTo(500 * Math.SQRT2, 0);
  });

  it('scales footprint to scene units (meter scene)', () => {
    const g = computeFurnitureGeometry(baseParams({ sceneUnits: 'm', position: { x: 1, y: 2, z: 0 } }));
    // 500mm → 0.5 scene-m, centred at (1,2) → ±0.25.
    expect(g.bbox.min.x).toBeCloseTo(0.75);
    expect(g.bbox.max.x).toBeCloseTo(1.25);
    // area still 0.26 m² regardless of scene units.
    expect(g.area).toBeCloseTo(0.26, 4);
  });
});

describe('validateFurnitureParams', () => {
  it('passes for valid params', () => {
    expect(validateFurnitureParams(baseParams()).hardErrors).toHaveLength(0);
  });

  it('rejects a missing assetId', () => {
    const r = validateFurnitureParams(baseParams({ assetId: '' }));
    expect(r.hardErrors).toContain('furniture.validation.hardErrors.missingAsset');
  });

  it('rejects a non-positive dimension', () => {
    const r = validateFurnitureParams(baseParams({ widthMm: 0 }));
    expect(r.hardErrors).toContain('furniture.validation.hardErrors.nonPositiveDimension');
  });

  it('rejects a degenerate (too small) dimension', () => {
    const r = validateFurnitureParams(baseParams({ depthMm: 5 }));
    expect(r.hardErrors).toContain('furniture.validation.hardErrors.dimensionTooSmall');
  });

  it('rejects a non-positive height', () => {
    const r = validateFurnitureParams(baseParams({ heightMm: 0 }));
    expect(r.hardErrors).toContain('furniture.validation.hardErrors.nonPositiveHeight');
  });
});
