/**
 * ADR-358 Phase 3a — `StairGeometryService` straight-flight tests.
 *
 * Geometry parameterization (canonical mm, +X/+Y math frame):
 *   - stepCount=10, rise=175, tread=280, nosing=25, width=1000
 *   - basePoint=(0,0,0), direction=0° (+X), upDirection='forward'
 *
 * Tolerance:
 *   - Coordinate accuracy: 1e-6 (matches Phase 2a/2b convention).
 *   - Z linearity / equality: 1e-9 (treads are co-planar by construction).
 *
 * @see ../StairGeometryService.ts
 */

import { computeStairGeometry } from '../StairGeometryService';
import type {
  StairParams,
  StairVariantStraight,
  Polygon3D,
  Polyline3D,
  StairUpDirection,
} from '../../../../bim/types/stair-types';

const COORD_TOL = 1e-6;
const Z_TOL = 1e-9;

function makeStraightParams(overrides?: {
  stepCount?: number;
  rise?: number;
  tread?: number;
  nosing?: number;
  width?: number;
  direction?: number;
  upDirection?: StairUpDirection;
  cutPlaneHeight?: number;
}): StairParams {
  const stepCount = overrides?.stepCount ?? 10;
  const rise = overrides?.rise ?? 175;
  const tread = overrides?.tread ?? 280;
  const variant: StairVariantStraight = { kind: 'straight' };
  return {
    basePoint: { x: 0, y: 0, z: 0 },
    direction: overrides?.direction ?? 0,
    rise,
    tread,
    nosing: overrides?.nosing ?? 25,
    nosingSide: 'front',
    width: overrides?.width ?? 1000,
    stepCount,
    totalRise: rise * stepCount,
    totalRun: tread * Math.max(stepCount - 1, 0),
    pitch: 30,
    structureType: 'monolithic',
    riserType: 'closed',
    antiskidNosing: false,
    adaContrastStrip: false,
    cutPlaneHeight: overrides?.cutPlaneHeight,
    variant,
    walklineOffset: 300,
    handrails: { inner: false, outer: false, height: 900 },
    upDirection: overrides?.upDirection ?? 'forward',
    treadNumberStart: 1,
    treadLabelDisplay: 'none',
    treadLabelRestartPerFlight: false,
    codeProfile: 'none',
  };
}

function xyDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function uniformZ(polygon: Polygon3D): number {
  return polygon[0].z;
}

function polygonAreaXY(polygon: Polygon3D): number {
  let sum = 0;
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % n];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) * 0.5;
}

describe('StairGeometryService — straight flight', () => {
  it('Test 1: produces stepCount tread polygons', () => {
    const params = makeStraightParams();
    const g = computeStairGeometry(params);
    expect(g.treads.length + g.treadsAboveCut.length).toBe(10);
    expect(g.treadsBelowCut.length + g.treadsAboveCut.length).toBe(10);
  });

  it('Test 2: tread vertices are co-planar at z = rise·i, consecutive Δz = rise', () => {
    const params = makeStraightParams();
    const g = computeStairGeometry(params);
    const allTreads: readonly Polygon3D[] = [...g.treadsBelowCut, ...g.treadsAboveCut];
    expect(allTreads).toHaveLength(10);
    for (let i = 0; i < allTreads.length; i++) {
      const z = allTreads[i][0].z;
      expect(z).toBeCloseTo(175 * i, 9);
      for (const v of allTreads[i]) expect(Math.abs(v.z - z)).toBeLessThan(Z_TOL);
    }
    for (let i = 1; i < allTreads.length; i++) {
      const dz = uniformZ(allTreads[i]) - uniformZ(allTreads[i - 1]);
      expect(dz).toBeCloseTo(175, 9);
    }
  });

  it('Test 3: emits stepCount-1 diagonal risers (xy = width, Δz = rise)', () => {
    // ADR-370 Phase 5.3 — Segment3D for risers uses diagonal encoding:
    // start = corner A on one width edge @zLow, end = OPPOSITE corner B @zHigh.
    // For direction=0 stair: v=(0,1), so start.y = -halfW, end.y = +halfW.
    const params = makeStraightParams();
    const g = computeStairGeometry(params);
    expect(g.risers).toHaveLength(9);
    for (const r of g.risers) {
      // xy diagonal spans full width (start and end on opposite width edges).
      expect(xyDistance(r.start, r.end)).toBeCloseTo(1000, 6);
      // Vertical span matches rise.
      expect(Math.abs(Math.abs(r.end.z - r.start.z) - 175)).toBeLessThan(Z_TOL);
      // Midpoint stays on the flight centerline (y = 0 for direction=0 basePoint=0).
      expect(Math.abs((r.start.x + r.end.x) * 0.5 - r.start.x)).toBeLessThan(COORD_TOL);
      expect(Math.abs((r.start.y + r.end.y) * 0.5)).toBeLessThan(COORD_TOL);
    }
  });

  it('Test 4: walkline has 2 vertices, xy length = tread·(stepCount-1)', () => {
    const params = makeStraightParams();
    const g = computeStairGeometry(params);
    expect(g.walkline).toHaveLength(2);
    const len = xyDistance(g.walkline[0], g.walkline[1]);
    expect(len).toBeCloseTo(280 * 9, 6);
  });

  it('Test 5: stringers ±halfW from walkline at each corresponding vertex', () => {
    const params = makeStraightParams();
    const g = computeStairGeometry(params);
    const walkline = g.walkline;
    const outer = g.stringers.outer as Polyline3D;
    const inner = g.stringers.inner as Polyline3D;
    expect(outer).toHaveLength(walkline.length);
    expect(inner).toHaveLength(walkline.length);
    for (let i = 0; i < walkline.length; i++) {
      expect(xyDistance(outer[i], walkline[i])).toBeCloseTo(500, 6);
      expect(xyDistance(inner[i], walkline[i])).toBeCloseTo(500, 6);
    }
  });

  it('Test 6: bbox wraps every tread vertex (x, y, z)', () => {
    const params = makeStraightParams();
    const g = computeStairGeometry(params);
    const allTreads: readonly Polygon3D[] = [...g.treadsBelowCut, ...g.treadsAboveCut];
    // Last tread (i=9): x ∈ [9·280, 9·280 + 305] = [2520, 2825]; y ∈ [-500, 500]; z = 1575
    expect(g.bbox.min.x).toBeCloseTo(0, 6);
    expect(g.bbox.min.y).toBeCloseTo(-500, 6);
    expect(g.bbox.min.z).toBeCloseTo(0, 9);
    expect(g.bbox.max.x).toBeCloseTo(2825, 6);
    expect(g.bbox.max.y).toBeCloseTo(500, 6);
    expect(g.bbox.max.z).toBeCloseTo(1575, 9);
    // Sanity: bbox contains every vertex
    for (const t of allTreads) {
      for (const p of t) {
        expect(p.x).toBeGreaterThanOrEqual(g.bbox.min.x - COORD_TOL);
        expect(p.x).toBeLessThanOrEqual(g.bbox.max.x + COORD_TOL);
        expect(p.y).toBeGreaterThanOrEqual(g.bbox.min.y - COORD_TOL);
        expect(p.y).toBeLessThanOrEqual(g.bbox.max.y + COORD_TOL);
      }
    }
  });

  it("Test 7: arrow label 'UP' for forward, 'DOWN' for backward", () => {
    const up = computeStairGeometry(makeStraightParams({ upDirection: 'forward' }));
    const down = computeStairGeometry(makeStraightParams({ upDirection: 'backward' }));
    expect(up.arrowSymbol.label).toBe('UP');
    expect(down.arrowSymbol.label).toBe('DOWN');
  });

  it('Test 8: direction=90° rotates tread vertices into +Y axis', () => {
    const params = makeStraightParams({ direction: 90 });
    const g = computeStairGeometry(params);
    const allTreads: readonly Polygon3D[] = [...g.treadsBelowCut, ...g.treadsAboveCut];
    // Tread 0 rotated CCW by 90°: corners at (±500, [0, 305])
    const tread0 = allTreads[0];
    const xs = tread0.map(p => p.x).sort((a, b) => a - b);
    const ys = tread0.map(p => p.y).sort((a, b) => a - b);
    expect(xs[0]).toBeCloseTo(-500, 6);
    expect(xs[3]).toBeCloseTo(500, 6);
    expect(ys[0]).toBeCloseTo(0, 6);
    expect(ys[3]).toBeCloseTo(305, 6);
    // Tread i centroid Δ along +y between consecutive treads = tread
    const centroid = (poly: Polygon3D) => ({
      x: poly.reduce((s, p) => s + p.x, 0) / 4,
      y: poly.reduce((s, p) => s + p.y, 0) / 4,
    });
    const c0 = centroid(allTreads[0]);
    const c1 = centroid(allTreads[1]);
    expect(c1.y - c0.y).toBeCloseTo(280, 6);
    expect(Math.abs(c1.x - c0.x)).toBeLessThan(COORD_TOL);
  });

  it('Test 9: cut plane splits when totalRise crosses cutPlaneHeight; cutLine undefined otherwise', () => {
    // Default cutPlaneHeight=1200. With rise=175, stepCount=10 → totalRise=1750 > 1200 → split.
    const splitCase = computeStairGeometry(makeStraightParams());
    expect(splitCase.treadsBelowCut.length).toBeGreaterThan(0);
    expect(splitCase.treadsAboveCut.length).toBeGreaterThan(0);
    expect(splitCase.cutLine).toBeDefined();
    // Lower-rise stair stays entirely below.
    const lowCase = computeStairGeometry(makeStraightParams({ rise: 50 }));
    expect(lowCase.treadsAboveCut).toHaveLength(0);
    expect(lowCase.cutLine).toBeUndefined();
  });

  it('Test 10: stepCount=1 boundary — 1 tread, 0 risers', () => {
    const params = makeStraightParams({ stepCount: 1 });
    const g = computeStairGeometry(params);
    const total = g.treadsBelowCut.length + g.treadsAboveCut.length;
    expect(total).toBe(1);
    expect(g.risers).toHaveLength(0);
  });

  it('Tread 0 polygon area = (tread + nosing) × width when nosing > 0', () => {
    const g = computeStairGeometry(makeStraightParams());
    const allTreads: readonly Polygon3D[] = [...g.treadsBelowCut, ...g.treadsAboveCut];
    const area = polygonAreaXY(allTreads[0]);
    expect(area).toBeCloseTo((280 + 25) * 1000, 3);
  });
});
