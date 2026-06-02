/**
 * ADR-406 — MEP fixture geometry + validation unit tests.
 */

import {
  computeMepFixtureGeometry,
  validateMepFixtureParams,
  CIRCULAR_FIXTURE_SEGMENTS,
} from '../mep-fixture-geometry';
import type { MepFixtureParams } from '../../types/mep-fixture-types';

function baseParams(overrides: Partial<MepFixtureParams> = {}): MepFixtureParams {
  return {
    kind: 'light-fixture',
    shape: 'rectangular',
    position: { x: 1000, y: 2000, z: 0 },
    rotation: 0,
    width: 600,
    length: 600,
    bodyHeightMm: 80,
    mountingElevationMm: 2700,
    sceneUnits: 'mm',
    ...overrides,
  };
}

describe('computeMepFixtureGeometry — rectangular', () => {
  it('builds a 4-vertex footprint centred on position (mm scene)', () => {
    const g = computeMepFixtureGeometry(baseParams());
    expect(g.footprint.vertices).toHaveLength(4);
    // centred at (1000,2000), 600×600 → corners ±300.
    expect(g.bbox.min.x).toBeCloseTo(700);
    expect(g.bbox.max.x).toBeCloseTo(1300);
    expect(g.bbox.min.y).toBeCloseTo(1700);
    expect(g.bbox.max.y).toBeCloseTo(2300);
  });

  it('area in m² (600×600 mm = 0.36 m²)', () => {
    const g = computeMepFixtureGeometry(baseParams());
    expect(g.area).toBeCloseTo(0.36, 4);
  });

  it('mirrors bodyHeightMm into geometry.height', () => {
    expect(computeMepFixtureGeometry(baseParams()).height).toBe(80);
  });

  it('rotation rotates the footprint about the position', () => {
    const g = computeMepFixtureGeometry(baseParams({ rotation: 45 }));
    // bbox grows by √2 when a square rotates 45°.
    const span = g.bbox.max.x - g.bbox.min.x;
    expect(span).toBeCloseTo(600 * Math.SQRT2, 1);
  });
});

describe('computeMepFixtureGeometry — circular', () => {
  it('builds a tessellated circular footprint (Ø = width)', () => {
    const g = computeMepFixtureGeometry(baseParams({ shape: 'circular', width: 200 }));
    expect(g.footprint.vertices).toHaveLength(CIRCULAR_FIXTURE_SEGMENTS);
    expect(g.bbox.max.x - g.bbox.min.x).toBeCloseTo(200, 0);
  });
});

describe('computeMepFixtureGeometry — scene units', () => {
  it('scales mm scalars to canvas units when scene is in metres', () => {
    const g = computeMepFixtureGeometry(baseParams({ sceneUnits: 'm', position: { x: 1, y: 2, z: 0 } }));
    // 600mm × s(=0.001) = 0.6 canvas units → ±0.3 about (1,2).
    expect(g.bbox.min.x).toBeCloseTo(0.7, 3);
    expect(g.bbox.max.x).toBeCloseTo(1.3, 3);
    // area is unit-independent (still 0.36 m²).
    expect(g.area).toBeCloseTo(0.36, 4);
  });
});

describe('validateMepFixtureParams', () => {
  it('passes for valid rectangular params', () => {
    expect(validateMepFixtureParams(baseParams()).hardErrors).toHaveLength(0);
  });

  it('hard-errors on non-positive width', () => {
    const r = validateMepFixtureParams(baseParams({ width: 0 }));
    expect(r.hardErrors).toContain('mepFixture.validation.hardErrors.nonPositiveWidth');
  });

  it('hard-errors on non-positive length (rectangular only)', () => {
    expect(validateMepFixtureParams(baseParams({ length: 0 })).hardErrors)
      .toContain('mepFixture.validation.hardErrors.nonPositiveLength');
    // circular ignores length.
    expect(validateMepFixtureParams(baseParams({ shape: 'circular', length: 0 })).hardErrors)
      .not.toContain('mepFixture.validation.hardErrors.nonPositiveLength');
  });

  it('hard-errors on non-positive body height', () => {
    expect(validateMepFixtureParams(baseParams({ bodyHeightMm: 0 })).hardErrors)
      .toContain('mepFixture.validation.hardErrors.nonPositiveBodyHeight');
  });

  it('hard-errors on a sub-minimum dimension', () => {
    expect(validateMepFixtureParams(baseParams({ width: 5 })).hardErrors)
      .toContain('mepFixture.validation.hardErrors.dimensionTooSmall');
  });
});
