/**
 * ADR-415 Φ1 — Floorplan symbol pure-vector drawer unit tests.
 */

import { buildFloorplanSymbol } from '../floorplan-symbol-symbol';
import { computeFloorplanSymbolGeometry } from '../floorplan-symbol-geometry';
import type { FloorplanSymbolParams } from '../../types/floorplan-symbol-types';

function baseParams(overrides: Partial<FloorplanSymbolParams> = {}): FloorplanSymbolParams {
  return {
    category: 'sanitary',
    kind: 'wc',
    assetId: 'wc_standard_01',
    position: { x: 0, y: 0, z: 0 },
    rotationDeg: 0,
    widthMm: 380,
    depthMm: 680,
    sceneUnits: 'mm',
    ...overrides,
  };
}

describe('buildFloorplanSymbol (WC)', () => {
  it('returns the footprint as the outline', () => {
    const params = baseParams();
    const geometry = computeFloorplanSymbolGeometry(params);
    const sym = buildFloorplanSymbol(params, geometry);
    expect(sym.outline).toBe(geometry.footprint.vertices);
  });

  it('emits the WC cistern + bowl + seat strokes', () => {
    const params = baseParams();
    const sym = buildFloorplanSymbol(params, computeFloorplanSymbolGeometry(params));
    // cistern (closed rect = 5 pts) + bowl + seat ellipses.
    expect(sym.strokes).toHaveLength(3);
    expect(sym.strokes[0]).toHaveLength(5);
    expect(sym.strokes[1].length).toBeGreaterThan(8);
  });

  it('keeps every stroke point inside the footprint bbox (rotation-aware)', () => {
    const params = baseParams({ rotationDeg: 90 });
    const geometry = computeFloorplanSymbolGeometry(params);
    const sym = buildFloorplanSymbol(params, geometry);
    const { min, max } = geometry.bbox;
    const eps = 1e-6;
    for (const stroke of sym.strokes) {
      for (const p of stroke) {
        expect(p.x).toBeGreaterThanOrEqual(min.x - eps);
        expect(p.x).toBeLessThanOrEqual(max.x + eps);
        expect(p.y).toBeGreaterThanOrEqual(min.y - eps);
        expect(p.y).toBeLessThanOrEqual(max.y + eps);
      }
    }
  });
});
