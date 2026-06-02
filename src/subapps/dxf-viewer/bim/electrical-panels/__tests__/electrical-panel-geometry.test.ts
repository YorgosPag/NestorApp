/**
 * ADR-408 Φ3 — electrical panel geometry + validation unit tests.
 */

import {
  computeElectricalPanelGeometry,
  validateElectricalPanelParams,
} from '../electrical-panel-geometry';
import type { ElectricalPanelParams } from '../../types/electrical-panel-types';

function baseParams(overrides: Partial<ElectricalPanelParams> = {}): ElectricalPanelParams {
  return {
    kind: 'distribution-board',
    shape: 'rectangular',
    position: { x: 1000, y: 2000, z: 0 },
    rotation: 0,
    width: 600,
    length: 150,
    bodyHeightMm: 700,
    mountingElevationMm: 1500,
    sceneUnits: 'mm',
    ...overrides,
  };
}

describe('computeElectricalPanelGeometry — rectangular', () => {
  it('builds a 4-vertex footprint centred on position (mm scene)', () => {
    const g = computeElectricalPanelGeometry(baseParams());
    expect(g.footprint.vertices).toHaveLength(4);
    // centred at (1000,2000), 600×150 → ±300 in x, ±75 in y.
    expect(g.bbox.min.x).toBeCloseTo(700);
    expect(g.bbox.max.x).toBeCloseTo(1300);
    expect(g.bbox.min.y).toBeCloseTo(1925);
    expect(g.bbox.max.y).toBeCloseTo(2075);
  });

  it('area in m² (600×150 mm = 0.09 m²)', () => {
    expect(computeElectricalPanelGeometry(baseParams()).area).toBeCloseTo(0.09, 4);
  });

  it('mirrors bodyHeightMm into geometry.height', () => {
    expect(computeElectricalPanelGeometry(baseParams()).height).toBe(700);
  });

  it('rotation rotates the footprint about the position', () => {
    const g0 = computeElectricalPanelGeometry(baseParams());
    const g90 = computeElectricalPanelGeometry(baseParams({ rotation: 90 }));
    // 90° swaps the footprint extents.
    expect(g90.bbox.max.x - g90.bbox.min.x).toBeCloseTo(g0.bbox.max.y - g0.bbox.min.y, 3);
  });
});

describe('computeElectricalPanelGeometry — scene units', () => {
  it('scales mm scalars to canvas units when scene is in metres', () => {
    const g = computeElectricalPanelGeometry(baseParams({ sceneUnits: 'm', position: { x: 1, y: 2, z: 0 } }));
    // 600mm × s(=0.001) = 0.6 canvas units → ±0.3 about x=1.
    expect(g.bbox.min.x).toBeCloseTo(0.7, 3);
    expect(g.bbox.max.x).toBeCloseTo(1.3, 3);
    // area is unit-independent (still 0.09 m²).
    expect(g.area).toBeCloseTo(0.09, 4);
  });
});

describe('validateElectricalPanelParams', () => {
  it('passes for valid params', () => {
    expect(validateElectricalPanelParams(baseParams()).hardErrors).toHaveLength(0);
  });

  it('hard-errors on non-positive width', () => {
    expect(validateElectricalPanelParams(baseParams({ width: 0 })).hardErrors)
      .toContain('electricalPanel.validation.hardErrors.nonPositiveWidth');
  });

  it('hard-errors on non-positive length', () => {
    expect(validateElectricalPanelParams(baseParams({ length: 0 })).hardErrors)
      .toContain('electricalPanel.validation.hardErrors.nonPositiveLength');
  });

  it('hard-errors on non-positive body height', () => {
    expect(validateElectricalPanelParams(baseParams({ bodyHeightMm: 0 })).hardErrors)
      .toContain('electricalPanel.validation.hardErrors.nonPositiveBodyHeight');
  });

  it('hard-errors on a sub-minimum dimension', () => {
    expect(validateElectricalPanelParams(baseParams({ width: 5 })).hardErrors)
      .toContain('electricalPanel.validation.hardErrors.dimensionTooSmall');
  });
});
