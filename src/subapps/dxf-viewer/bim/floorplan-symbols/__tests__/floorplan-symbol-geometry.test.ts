/**
 * ADR-415 Φ1 — Floorplan symbol geometry + validation unit tests.
 */

import {
  computeFloorplanSymbolGeometry,
  validateFloorplanSymbolParams,
} from '../floorplan-symbol-geometry';
import type { FloorplanSymbolParams } from '../../types/floorplan-symbol-types';

function baseParams(overrides: Partial<FloorplanSymbolParams> = {}): FloorplanSymbolParams {
  return {
    category: 'sanitary',
    kind: 'wc',
    assetId: 'wc_standard_01',
    position: { x: 1000, y: 2000, z: 0 },
    rotationDeg: 0,
    widthMm: 380,
    depthMm: 680,
    sceneUnits: 'mm',
    ...overrides,
  };
}

describe('computeFloorplanSymbolGeometry', () => {
  it('builds a 4-vertex footprint centred on position (mm scene)', () => {
    const g = computeFloorplanSymbolGeometry(baseParams());
    expect(g.footprint.vertices).toHaveLength(4);
    // centred at (1000,2000), 380×680 → ±190 / ±340.
    expect(g.bbox.min.x).toBeCloseTo(810);
    expect(g.bbox.max.x).toBeCloseTo(1190);
    expect(g.bbox.min.y).toBeCloseTo(1660);
    expect(g.bbox.max.y).toBeCloseTo(2340);
  });

  it('area in m² (380×680 mm = 0.2584 m²)', () => {
    expect(computeFloorplanSymbolGeometry(baseParams()).area).toBeCloseTo(0.2584, 4);
  });

  it('rotation rotates the footprint about the position', () => {
    const g = computeFloorplanSymbolGeometry(baseParams({ widthMm: 500, depthMm: 500, rotationDeg: 45 }));
    const span = g.bbox.max.x - g.bbox.min.x;
    expect(span).toBeCloseTo(500 * Math.SQRT2, 0);
  });
});

describe('validateFloorplanSymbolParams', () => {
  it('accepts valid params (no hard errors)', () => {
    expect(validateFloorplanSymbolParams(baseParams()).hardErrors).toHaveLength(0);
  });

  it('rejects a missing assetId', () => {
    const r = validateFloorplanSymbolParams(baseParams({ assetId: '' }));
    expect(r.hardErrors).toContain('floorplanSymbol.validation.hardErrors.missingAsset');
  });

  it('rejects a non-positive dimension', () => {
    const r = validateFloorplanSymbolParams(baseParams({ widthMm: 0 }));
    expect(r.hardErrors).toContain('floorplanSymbol.validation.hardErrors.nonPositiveDimension');
  });

  it('rejects a below-minimum dimension', () => {
    const r = validateFloorplanSymbolParams(baseParams({ depthMm: 5 }));
    expect(r.hardErrors).toContain('floorplanSymbol.validation.hardErrors.dimensionTooSmall');
  });
});
