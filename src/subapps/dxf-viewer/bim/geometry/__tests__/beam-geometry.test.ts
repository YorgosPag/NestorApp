/**
 * ADR-363 Phase 5 — beam-geometry unit tests.
 *
 * Coverage:
 *   - straight axis (2 vertices)
 *   - curved axis subdivision (17 vertices)
 *   - outline perpendicular offset (rectangle area = length × width)
 *   - length / area / volume scalars (m / m² / m³)
 *   - bbox folds outline + axis + extends to topElevation
 *   - getBeamSpanDepthRatio convenience
 *   - cantilever axis identical to straight pattern
 */

import {
  computeBeamGeometry,
  getBeamSpanDepthRatio,
} from '../beam-geometry';
import {
  CURVED_BEAM_SUBDIVISIONS,
  DEFAULT_BEAM_DEPTH_MM,
  DEFAULT_BEAM_TOP_ELEVATION_MM,
  DEFAULT_BEAM_WIDTH_MM,
  type BeamParams,
} from '../../types/beam-types';

const baseStraight: BeamParams = {
  kind: 'straight',
  startPoint: { x: 0, y: 0, z: 0 },
  endPoint: { x: 5000, y: 0, z: 0 },
  width: DEFAULT_BEAM_WIDTH_MM,
  depth: DEFAULT_BEAM_DEPTH_MM,
  topElevation: DEFAULT_BEAM_TOP_ELEVATION_MM,
  supportType: 'simple',
};

describe('computeBeamGeometry — straight kind', () => {
  test('axisPolyline has 2 vertices', () => {
    const g = computeBeamGeometry(baseStraight);
    expect(g.axisPolyline.points).toHaveLength(2);
    expect(g.axisPolyline.points[0]).toEqual({ x: 0, y: 0, z: 0 });
    expect(g.axisPolyline.points[1]).toEqual({ x: 5000, y: 0, z: 0 });
  });

  test('outline is a 4-vertex rectangle (CCW) for straight beam', () => {
    const g = computeBeamGeometry(baseStraight);
    expect(g.outline.vertices).toHaveLength(4);
  });

  test('length in metres (chord length / 1000)', () => {
    const g = computeBeamGeometry(baseStraight);
    expect(g.length).toBeCloseTo(5, 6);
  });

  test('area = length × width (m²)', () => {
    const g = computeBeamGeometry(baseStraight);
    expect(g.area).toBeCloseTo(5 * (DEFAULT_BEAM_WIDTH_MM / 1000), 6);
  });

  test('volume = area × depth (m³)', () => {
    const g = computeBeamGeometry(baseStraight);
    const expected = 5 * (DEFAULT_BEAM_WIDTH_MM / 1000) * (DEFAULT_BEAM_DEPTH_MM / 1000);
    expect(g.volume).toBeCloseTo(expected, 6);
  });

  test('bbox folds outline + axis; z in metres (ADR-369 Phase B)', () => {
    const g = computeBeamGeometry(baseStraight);
    expect(g.bbox.min.x).toBeCloseTo(0, 3);
    expect(g.bbox.max.x).toBeCloseTo(5000, 3);
    // topElevation=3000mm, zOffset=0 → top=3m; depth=500mm → bottom=2.5m
    expect(g.bbox.max.z).toBeCloseTo(DEFAULT_BEAM_TOP_ELEVATION_MM / 1000, 6);
    expect(g.bbox.min.z).toBeCloseTo((DEFAULT_BEAM_TOP_ELEVATION_MM - DEFAULT_BEAM_DEPTH_MM) / 1000, 6);
  });
});

describe('computeBeamGeometry — curved kind', () => {
  const curved: BeamParams = {
    ...baseStraight,
    kind: 'curved',
    curveControl: { x: 2500, y: 1500, z: 0 },
  };

  test('axisPolyline has CURVED_BEAM_SUBDIVISIONS+1 vertices', () => {
    const g = computeBeamGeometry(curved);
    expect(g.axisPolyline.points).toHaveLength(CURVED_BEAM_SUBDIVISIONS + 1);
  });

  test('first and last axis vertices match start/end', () => {
    const g = computeBeamGeometry(curved);
    const verts = g.axisPolyline.points;
    expect(verts[0].x).toBeCloseTo(0, 3);
    expect(verts[verts.length - 1].x).toBeCloseTo(5000, 3);
  });

  test('curved length > straight chord length', () => {
    const g = computeBeamGeometry(curved);
    expect(g.length).toBeGreaterThan(5);
  });
});

describe('computeBeamGeometry — cantilever kind', () => {
  test('uses 2-vertex axis identical to straight pattern', () => {
    const canti: BeamParams = { ...baseStraight, kind: 'cantilever', supportType: 'cantilever' };
    const g = computeBeamGeometry(canti);
    expect(g.axisPolyline.points).toHaveLength(2);
    expect(g.length).toBeCloseTo(5, 6);
  });
});

describe('getBeamSpanDepthRatio', () => {
  test('returns length_m / (depth_mm / 1000)', () => {
    const r = getBeamSpanDepthRatio(baseStraight);
    expect(r).toBeCloseTo(5 / (DEFAULT_BEAM_DEPTH_MM / 1000), 6);
  });

  test('returns Infinity for depth ≤ 0', () => {
    const r = getBeamSpanDepthRatio({ ...baseStraight, depth: 0 });
    expect(r).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('computeBeamGeometry — maxFreeSpanM (Phase 3.8)', () => {
  test('maxFreeSpanM equals length for straight beam', () => {
    const g = computeBeamGeometry(baseStraight);
    expect(g.maxFreeSpanM).toBeCloseTo(g.length, 6);
  });

  test('maxFreeSpanM equals length for curved beam', () => {
    const curved: BeamParams = {
      ...baseStraight,
      kind: 'curved',
      curveControl: { x: 2500, y: 1500, z: 0 },
    };
    const g = computeBeamGeometry(curved);
    expect(g.maxFreeSpanM).toBeCloseTo(g.length, 6);
  });

  test('maxFreeSpanM equals length for cantilever', () => {
    const canti: BeamParams = { ...baseStraight, kind: 'cantilever', supportType: 'cantilever' };
    const g = computeBeamGeometry(canti);
    expect(g.maxFreeSpanM).toBeCloseTo(g.length, 6);
  });
});
