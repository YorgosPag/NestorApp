/**
 * ADR-408 Φ3 — electrical panel 2D symbol SSoT unit tests.
 */

import { buildPanelSymbol } from '../electrical-panel-symbol';
import { computeElectricalPanelGeometry } from '../electrical-panel-geometry';
import type { ElectricalPanelParams } from '../../types/electrical-panel-types';

function baseParams(overrides: Partial<ElectricalPanelParams> = {}): ElectricalPanelParams {
  return {
    kind: 'distribution-board',
    shape: 'rectangular',
    position: { x: 0, y: 0, z: 0 },
    rotation: 0,
    width: 600,
    length: 150,
    bodyHeightMm: 700,
    mountingElevationMm: 1500,
    sceneUnits: 'mm',
    ...overrides,
  };
}

describe('buildPanelSymbol', () => {
  it('returns the footprint as outline + 3 divider strokes', () => {
    const params = baseParams();
    const geometry = computeElectricalPanelGeometry(params);
    const symbol = buildPanelSymbol(params, geometry);
    expect(symbol.outline).toEqual(geometry.footprint.vertices);
    expect(symbol.strokes).toHaveLength(3);
    for (const s of symbol.strokes) expect(s).toHaveLength(2);
  });

  it('divider strokes stay within the footprint bbox', () => {
    const params = baseParams();
    const geometry = computeElectricalPanelGeometry(params);
    const { bbox } = geometry;
    for (const stroke of buildPanelSymbol(params, geometry).strokes) {
      for (const p of stroke) {
        expect(p.x).toBeGreaterThanOrEqual(bbox.min.x - 1e-6);
        expect(p.x).toBeLessThanOrEqual(bbox.max.x + 1e-6);
        expect(p.y).toBeGreaterThanOrEqual(bbox.min.y - 1e-6);
        expect(p.y).toBeLessThanOrEqual(bbox.max.y + 1e-6);
      }
    }
  });
});
