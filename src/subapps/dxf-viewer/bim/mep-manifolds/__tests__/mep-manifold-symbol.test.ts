/**
 * ADR-408 Φ12 — Plumbing manifold 2D symbol: bar outline + inlet stub + N outlet
 * stubs. Pins the stroke count tracks `outletCount` (+1 inlet) and the outline
 * equals the footprint.
 */

import { buildMepManifoldSymbol, resolveManifoldPalette } from '../mep-manifold-symbol';
import { computeMepManifoldGeometry } from '../mep-manifold-geometry';
import { buildDefaultMepManifoldParams } from '../../../hooks/drawing/mep-manifold-completion';
import { DEFAULT_DRAINAGE_COLLECTOR_SIZE_MM } from '../../types/mep-manifold-types';
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

  it('water manifold has no grating', () => {
    const p = params();
    expect(buildMepManifoldSymbol(p, computeMepManifoldGeometry(p)).gratingStrokes).toBeUndefined();
  });
});

// ADR-408 Φ14 — drainage collector (φρεάτιο) adds a grating pattern (catch basin)
// while keeping the connection stubs + footprint.
describe('buildMepManifoldSymbol — drainage collector grating', () => {
  it('emits 6 grating bars, each a 2-point polyline', () => {
    const p = params({ kind: 'drainage-collector' });
    const sym = buildMepManifoldSymbol(p, computeMepManifoldGeometry(p));
    expect(sym.gratingStrokes).toHaveLength(6);
    expect(sym.gratingStrokes!.every((s) => s.length === 2)).toBe(true);
  });

  it('keeps the footprint outline + connection stubs', () => {
    const p = params({ kind: 'drainage-collector', outletCount: 3 });
    const sym = buildMepManifoldSymbol(p, computeMepManifoldGeometry(p));
    expect(sym.outline).toHaveLength(4);
    expect(sym.strokes).toHaveLength(1 + 3);
  });

  it('grating bars stay inside the footprint bbox', () => {
    const p = params({ kind: 'drainage-collector' });
    const geom = computeMepManifoldGeometry(p);
    const sym = buildMepManifoldSymbol(p, geom);
    const xs = geom.footprint.vertices.map((v) => v.x);
    const ys = geom.footprint.vertices.map((v) => v.y);
    const [minX, maxX] = [Math.min(...xs), Math.max(...xs)];
    const [minY, maxY] = [Math.min(...ys), Math.max(...ys)];
    for (const bar of sym.gratingStrokes!) {
      for (const pt of bar) {
        expect(pt.x).toBeGreaterThanOrEqual(minX - 1e-6);
        expect(pt.x).toBeLessThanOrEqual(maxX + 1e-6);
        expect(pt.y).toBeGreaterThanOrEqual(minY - 1e-6);
        expect(pt.y).toBeLessThanOrEqual(maxY + 1e-6);
      }
    }
  });
});

// ADR-408 Φ14 — the equipment palette SSoT shared by the renderer + both ghosts.
describe('resolveManifoldPalette', () => {
  it('water manifold = cyan-teal', () => {
    expect(resolveManifoldPalette('floor-manifold')).toEqual({ strokeHex: '#0891b2', fillRgb: '8, 145, 178' });
  });
  it('drainage collector = brown (CIBSE sanitary)', () => {
    expect(resolveManifoldPalette('drainage-collector')).toEqual({ strokeHex: '#b45309', fillRgb: '180, 83, 9' });
  });
});

// ADR-408 Φ14 — a drainage collector (φρεάτιο) defaults to a SQUARE catch-basin
// footprint, not the thin water-manifold bar.
describe('buildDefaultMepManifoldParams — drainage collector is square', () => {
  it('defaults width === length === DEFAULT_DRAINAGE_COLLECTOR_SIZE_MM', () => {
    const p = buildDefaultMepManifoldParams({ x: 0, y: 0 }, { kind: 'drainage-collector' });
    expect(p.width).toBe(DEFAULT_DRAINAGE_COLLECTOR_SIZE_MM);
    expect(p.length).toBe(DEFAULT_DRAINAGE_COLLECTOR_SIZE_MM);
  });

  it('water manifold keeps the thin bar default (width > length)', () => {
    const p = buildDefaultMepManifoldParams({ x: 0, y: 0 }, { kind: 'floor-manifold' });
    expect(p.width).toBeGreaterThan(p.length);
  });

  it('explicit width/length override the square default', () => {
    const p = buildDefaultMepManifoldParams({ x: 0, y: 0 }, { kind: 'drainage-collector', width: 600, length: 300 });
    expect(p.width).toBe(600);
    expect(p.length).toBe(300);
  });
});
