/**
 * ADR-436 Slice 1 — computeFoundationGeometry tests.
 *
 * Verifies footprint / bbox / area / volume per kind (pad rect+anchor+rotation,
 * strip/tie-beam band). Pure function — μηδέν mocks.
 */

import { computeFoundationGeometry } from '../foundation-geometry';
import {
  buildDefaultFoundationParams,
  type PadFootingParams,
  type StripFootingParams,
} from '../../types/foundation-types';

describe('computeFoundationGeometry — pad', () => {
  const base = (): PadFootingParams => ({
    kind: 'pad',
    topElevationMm: -1000,
    thicknessMm: 500,
    position: { x: 0, y: 0, z: 0 },
    width: 1500,
    length: 2000,
    rotation: 0,
    anchor: 'center',
    profile: 'flat',
    sceneUnits: 'mm',
  });

  it('builds a 4-vertex rectangle footprint', () => {
    const g = computeFoundationGeometry(base());
    expect(g.footprint.vertices).toHaveLength(4);
  });

  it('centers the footprint on position for anchor=center', () => {
    const g = computeFoundationGeometry(base());
    expect(g.bbox.min.x).toBeCloseTo(-750);
    expect(g.bbox.max.x).toBeCloseTo(750);
    expect(g.bbox.min.y).toBeCloseTo(-1000);
    expect(g.bbox.max.y).toBeCloseTo(1000);
  });

  it('computes area in m² (1.5 × 2.0 = 3.0)', () => {
    const g = computeFoundationGeometry(base());
    expect(g.area).toBeCloseTo(3.0, 5);
  });

  it('computes volume in m³ (area × thickness = 3.0 × 0.5)', () => {
    const g = computeFoundationGeometry(base());
    expect(g.volume).toBeCloseTo(1.5, 5);
  });

  it('mirrors thicknessMm into geometry.thickness', () => {
    const g = computeFoundationGeometry(base());
    expect(g.thickness).toBe(500);
  });

  it('shifts the footprint when anchor is a corner (sw → position at min corner)', () => {
    const g = computeFoundationGeometry({ ...base(), anchor: 'sw' });
    // sw anchor sits on position (0,0) → footprint extends +x/+y.
    expect(g.bbox.min.x).toBeCloseTo(0);
    expect(g.bbox.min.y).toBeCloseTo(0);
    expect(g.bbox.max.x).toBeCloseTo(1500);
    expect(g.bbox.max.y).toBeCloseTo(2000);
  });

  it('rotation preserves area', () => {
    const g0 = computeFoundationGeometry(base());
    const g45 = computeFoundationGeometry({ ...base(), rotation: 45 });
    expect(g45.area).toBeCloseTo(g0.area, 5);
  });
});

describe('computeFoundationGeometry — strip / tie-beam band', () => {
  const strip = (): StripFootingParams => ({
    kind: 'strip',
    topElevationMm: -1000,
    thicknessMm: 400,
    start: { x: 0, y: 0, z: 0 },
    end: { x: 2000, y: 0, z: 0 },
    width: 600,
    sceneUnits: 'mm',
  });

  it('builds a 4-vertex band footprint', () => {
    const g = computeFoundationGeometry(strip());
    expect(g.footprint.vertices).toHaveLength(4);
  });

  it('band spans the axis length × width (2.0 × 0.6 = 1.2 m²)', () => {
    const g = computeFoundationGeometry(strip());
    expect(g.area).toBeCloseTo(1.2, 5);
  });

  it('band is centred on the axis (±width/2 across)', () => {
    const g = computeFoundationGeometry(strip());
    expect(g.bbox.min.y).toBeCloseTo(-300);
    expect(g.bbox.max.y).toBeCloseTo(300);
  });
});

describe('computeFoundationGeometry — strip justification (ADR-441 Slice 5a)', () => {
  // Horizontal strip, +X direction → CCW normal n = +Y. width 600 → ±300 band.
  const strip = (justification?: 'center' | 'left' | 'right'): StripFootingParams => ({
    kind: 'strip',
    topElevationMm: -1000,
    thicknessMm: 400,
    start: { x: 0, y: 0, z: 0 },
    end: { x: 2000, y: 0, z: 0 },
    width: 600,
    sceneUnits: 'mm',
    ...(justification ? { justification } : {}),
  });

  it('center == undefined justification (zero-regression: identical band)', () => {
    const gUndef = computeFoundationGeometry(strip());
    const gCenter = computeFoundationGeometry(strip('center'));
    expect(gCenter.footprint.vertices).toEqual(gUndef.footprint.vertices);
    expect(gCenter.bbox.min.y).toBeCloseTo(-300);
    expect(gCenter.bbox.max.y).toBeCloseTo(300);
  });

  it('left → develops toward +normal, right face on axis (y∈[0,600])', () => {
    const g = computeFoundationGeometry(strip('left'));
    expect(g.bbox.min.y).toBeCloseTo(0);   // η δεξιά παρειά πέφτει στον άξονα
    expect(g.bbox.max.y).toBeCloseTo(600);
  });

  it('right → develops toward −normal, left face on axis (y∈[-600,0])', () => {
    const g = computeFoundationGeometry(strip('right'));
    expect(g.bbox.min.y).toBeCloseTo(-600);
    expect(g.bbox.max.y).toBeCloseTo(0);    // η αριστερή παρειά πέφτει στον άξονα
  });

  it('justification preserves area & volume (only shifts perpendicular)', () => {
    const c = computeFoundationGeometry(strip('center'));
    for (const j of ['left', 'right'] as const) {
      const g = computeFoundationGeometry(strip(j));
      expect(g.area).toBeCloseTo(c.area, 9);
      expect(g.volume).toBeCloseTo(c.volume, 9);
    }
  });

  it('idempotent: 2× compute → ίδιο footprint', () => {
    const a = computeFoundationGeometry(strip('left'));
    const b = computeFoundationGeometry(strip('left'));
    expect(a.footprint.vertices).toEqual(b.footprint.vertices);
  });
});

describe('buildDefaultFoundationParams smoke (geometry round-trip)', () => {
  it('produces non-degenerate geometry for every kind', () => {
    for (const kind of ['pad', 'strip', 'tie-beam'] as const) {
      const g = computeFoundationGeometry(buildDefaultFoundationParams(kind));
      expect(g.footprint.vertices.length).toBeGreaterThanOrEqual(3);
      expect(g.area).toBeGreaterThan(0);
      expect(g.volume).toBeGreaterThan(0);
    }
  });
});
