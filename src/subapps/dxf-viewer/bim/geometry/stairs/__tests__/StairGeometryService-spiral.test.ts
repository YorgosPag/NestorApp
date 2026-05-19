/**
 * ADR-358 Phase 4a — `StairGeometryService` spiral-kind tests.
 *
 * Geometry parameterization (canonical mm):
 *   - stepCount=12, sweepAngle=360°, totalRise=2100, width=1200, ccw
 *   - centerPoint=(0,0,0), innerRadius=0 (fixed by type)
 *
 * Tolerances match Phase 3a/3b: 1e-6 xy, 1e-9 z.
 *
 * @see ../StairGeometryService.ts
 * @see ../stair-geometry-spiral.ts
 */

import { computeStairGeometry } from '../StairGeometryService';
import type {
  Polygon3D,
  StairParams,
  StairTreadLabelDisplay,
  StairVariantSpiral,
} from '../../../../bim/types/stair-types';

const COORD_TOL = 1e-6;
const Z_TOL = 1e-9;
const DEG2RAD = Math.PI / 180;

function makeSpiralParams(overrides?: {
  stepCount?: number;
  sweepAngle?: number;
  turnDirection?: 'cw' | 'ccw';
  totalRise?: number;
  width?: number;
  cutPlaneHeight?: number;
  treadLabelDisplay?: StairTreadLabelDisplay;
  treadLabelEveryN?: number;
}): StairParams {
  const stepCount = overrides?.stepCount ?? 12;
  const totalRise = overrides?.totalRise ?? 2100;
  const rise = totalRise / stepCount;
  const variant: StairVariantSpiral = {
    kind: 'spiral',
    centerPoint: { x: 0, y: 0, z: 0 },
    innerRadius: 0,
    sweepAngle: overrides?.sweepAngle ?? 360,
    turnDirection: overrides?.turnDirection ?? 'ccw',
  };
  return {
    basePoint: { x: 0, y: 0, z: 0 },
    direction: 0,
    rise,
    tread: 250,
    nosing: 0,
    nosingSide: 'none',
    width: overrides?.width ?? 1200,
    stepCount,
    totalRise,
    totalRun: 0,
    pitch: 30,
    structureType: 'monolithic',
    riserType: 'closed',
    antiskidNosing: false,
    adaContrastStrip: false,
    cutPlaneHeight: overrides?.cutPlaneHeight,
    variant,
    walklineOffset: 300,
    handrails: { inner: false, outer: false, height: 900 },
    upDirection: 'forward',
    treadNumberStart: 1,
    treadLabelDisplay: overrides?.treadLabelDisplay ?? 'none',
    treadLabelEveryN: overrides?.treadLabelEveryN,
    treadLabelRestartPerFlight: false,
    codeProfile: 'none',
  };
}

function allTreads(g: ReturnType<typeof computeStairGeometry>): readonly Polygon3D[] {
  return [...g.treadsBelowCut, ...g.treadsAboveCut];
}

function distanceXY(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

describe('StairGeometryService — spiral', () => {
  it('Test 1: produces stepCount triangular treads with apex at centerPoint', () => {
    const g = computeStairGeometry(makeSpiralParams());
    const treads = allTreads(g);
    expect(treads).toHaveLength(12);
    for (const t of treads) {
      expect(t).toHaveLength(3);
      // Vertex 0 is apex by construction (sign=+1 ccw).
      expect(distanceXY(t[0], { x: 0, y: 0 })).toBeLessThan(COORD_TOL);
    }
  });

  it('Test 2: all tread vertices co-planar at z = i·rise', () => {
    const g = computeStairGeometry(makeSpiralParams());
    const treads = allTreads(g);
    const rise = 2100 / 12;
    for (let i = 0; i < treads.length; i++) {
      const expectedZ = rise * i;
      for (const v of treads[i]) expect(Math.abs(v.z - expectedZ)).toBeLessThan(Z_TOL);
    }
  });

  it('Test 3: outer corners at radius = width (1200), apex at center', () => {
    const g = computeStairGeometry(makeSpiralParams());
    const treads = allTreads(g);
    for (const t of treads) {
      // Outer corners are vertices 1 and 2 (sign=+1 ccw).
      expect(distanceXY(t[1], { x: 0, y: 0 })).toBeCloseTo(1200, 6);
      expect(distanceXY(t[2], { x: 0, y: 0 })).toBeCloseTo(1200, 6);
    }
  });

  it('Test 4: angular increment = sweep/stepCount = 30°', () => {
    const g = computeStairGeometry(makeSpiralParams());
    const treads = allTreads(g);
    // Compare via (cos, sin) instead of atan2 — avoids the ±π wrap discontinuity.
    const R = 1200;
    for (let i = 0; i < treads.length; i++) {
      const t0 = i * 30 * DEG2RAD;
      const t1 = (i + 1) * 30 * DEG2RAD;
      expect(treads[i][1].x).toBeCloseTo(R * Math.cos(t0), 6);
      expect(treads[i][1].y).toBeCloseTo(R * Math.sin(t0), 6);
      expect(treads[i][2].x).toBeCloseTo(R * Math.cos(t1), 6);
      expect(treads[i][2].y).toBeCloseTo(R * Math.sin(t1), 6);
    }
  });

  it('Test 5: cw mirrors ccw across the x-axis', () => {
    const ccw = computeStairGeometry(makeSpiralParams({ turnDirection: 'ccw' }));
    const cw = computeStairGeometry(makeSpiralParams({ turnDirection: 'cw' }));
    const ccwTreads = allTreads(ccw);
    const cwTreads = allTreads(cw);
    expect(cwTreads.length).toBe(ccwTreads.length);
    for (let i = 0; i < ccwTreads.length; i++) {
      // ccw vertex 1 at angle +θ → cw vertex 2 at -θ (reversed order under mirror).
      const ccwOuter = ccwTreads[i][1];
      const cwOuter = cwTreads[i][2];
      expect(cwOuter.x).toBeCloseTo(ccwOuter.x, 6);
      expect(cwOuter.y).toBeCloseTo(-ccwOuter.y, 6);
    }
  });

  it("Test 6: treadLabels 'all' → stepCount labels, 'none' → undefined", () => {
    const all = computeStairGeometry(makeSpiralParams({ treadLabelDisplay: 'all' }));
    const none = computeStairGeometry(makeSpiralParams({ treadLabelDisplay: 'none' }));
    expect(all.treadLabels).toHaveLength(12);
    expect(none.treadLabels).toBeUndefined();
  });

  it('Test 7: tread label positions match tread centroids', () => {
    const g = computeStairGeometry(makeSpiralParams({ treadLabelDisplay: 'all' }));
    const treads = allTreads(g);
    const labels = g.treadLabels ?? [];
    for (let i = 0; i < labels.length; i++) {
      const t = treads[i];
      const cx = (t[0].x + t[1].x + t[2].x) / 3;
      const cy = (t[0].y + t[1].y + t[2].y) / 3;
      expect(labels[i].position.x).toBeCloseTo(cx, 6);
      expect(labels[i].position.y).toBeCloseTo(cy, 6);
    }
  });

  it('Test 8: cutLine emitted when totalRise > cutPlaneHeight, undefined otherwise', () => {
    const split = computeStairGeometry(makeSpiralParams()); // default cut 1200, totalRise 2100
    expect(split.cutLine).toBeDefined();
    const low = computeStairGeometry(makeSpiralParams({ totalRise: 300 }));
    expect(low.cutLine).toBeUndefined();
  });

  it('Test 9: arrow runs from the first walkline vertex to the last', () => {
    const g = computeStairGeometry(makeSpiralParams());
    expect(g.arrowSymbol.label).toBe('UP');
    expect(g.arrowSymbol.start.x).toBeCloseTo(g.walkline[0].x, 6);
    expect(g.arrowSymbol.start.y).toBeCloseTo(g.walkline[0].y, 6);
    expect(g.arrowSymbol.end.x).toBeCloseTo(g.walkline[g.walkline.length - 1].x, 6);
    expect(g.arrowSymbol.end.y).toBeCloseTo(g.walkline[g.walkline.length - 1].y, 6);
  });

  it('Test 10: stepCount=1 → 1 wedge, 0 risers, walkline length 2', () => {
    const g = computeStairGeometry(makeSpiralParams({ stepCount: 1 }));
    const treads = allTreads(g);
    expect(treads).toHaveLength(1);
    expect(g.risers).toHaveLength(0);
    expect(g.walkline).toHaveLength(2);
  });
});
