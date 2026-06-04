/**
 * ADR-408 Φ12 — Plumbing manifold 2D symbol: bar outline + inlet stub + N outlet
 * stubs. Pins the stroke count tracks `outletCount` (+1 inlet) and the outline
 * equals the footprint.
 */

import { buildMepManifoldSymbol } from '../mep-manifold-symbol';
import { computeMepManifoldGeometry } from '../mep-manifold-geometry';
import type { MepManifoldParams } from '../../types/mep-manifold-types';

function params(overrides: Partial<MepManifoldParams> = {}): MepManifoldParams {
  return {
    kind: 'floor-manifold',
    shape: 'rectangular',
    position: { x: 0, y: 0, z: 0 },
    rotation: 0,
    width: 400,
    length: 80,
    bodyHeightMm: 60,
    mountingElevationMm: 400,
    outletCount: 4,
    inletDiameterMm: 25,
    outletDiameterMm: 16,
    sceneUnits: 'mm',
    ...overrides,
  };
}

describe('buildMepManifoldSymbol', () => {
  it('outline equals the footprint (4 verts)', () => {
    const p = params();
    const sym = buildMepManifoldSymbol(p, computeMepManifoldGeometry(p));
    expect(sym.outline).toHaveLength(4);
  });

  it('emits 1 inlet stub + N outlet stubs', () => {
    const p = params({ outletCount: 5 });
    const sym = buildMepManifoldSymbol(p, computeMepManifoldGeometry(p));
    expect(sym.strokes).toHaveLength(1 + 5);
    // each stub is a 2-point polyline
    expect(sym.strokes.every((s) => s.length === 2)).toBe(true);
  });

  it('tracks outletCount changes', () => {
    const p2 = params({ outletCount: 2 });
    expect(buildMepManifoldSymbol(p2, computeMepManifoldGeometry(p2)).strokes).toHaveLength(3);
  });
});
