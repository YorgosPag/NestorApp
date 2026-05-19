/**
 * ADR-358 Phase 4a — `StairGeometryService` helical-kind tests.
 *
 * Geometry parameterization (canonical mm):
 *   - stepCount=12, sweepAngle=270°, innerRadius=400, outerRadius=1400
 *     (width = outerRadius - innerRadius = 1000), ccw
 *   - centerPoint=(0,0,0), totalRise = rise · stepCount
 *
 * Tolerances match Phase 3a/3b: 1e-6 xy, 1e-9 z.
 *
 * @see ../StairGeometryService.ts
 * @see ../stair-geometry-helical.ts
 */

import { computeStairGeometry } from '../StairGeometryService';
import type {
  Polygon3D,
  Polyline3D,
  StairParams,
  StairTreadLabelDisplay,
  StairVariantHelical,
} from '../../../../bim/types/stair-types';

const COORD_TOL = 1e-6;
const Z_TOL = 1e-9;
const DEG2RAD = Math.PI / 180;

function makeHelicalParams(overrides?: {
  stepCount?: number;
  sweepAngle?: number;
  turnDirection?: 'cw' | 'ccw';
  rise?: number;
  innerRadius?: number;
  outerRadius?: number;
  cutPlaneHeight?: number;
  treadLabelDisplay?: StairTreadLabelDisplay;
}): StairParams {
  const stepCount = overrides?.stepCount ?? 12;
  const rise = overrides?.rise ?? 175;
  const innerRadius = overrides?.innerRadius ?? 400;
  const outerRadius = overrides?.outerRadius ?? 1400;
  const variant: StairVariantHelical = {
    kind: 'helical',
    centerPoint: { x: 0, y: 0, z: 0 },
    innerRadius,
    outerRadius,
    sweepAngle: overrides?.sweepAngle ?? 270,
    turnDirection: overrides?.turnDirection ?? 'ccw',
  };
  return {
    basePoint: { x: 0, y: 0, z: 0 },
    direction: 0,
    rise,
    tread: 250,
    nosing: 0,
    nosingSide: 'none',
    width: outerRadius - innerRadius,
    stepCount,
    totalRise: rise * stepCount,
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

describe('StairGeometryService — helical', () => {
  it('Test 1: produces stepCount annular-wedge treads (4 vertices each)', () => {
    const g = computeStairGeometry(makeHelicalParams());
    const treads = allTreads(g);
    expect(treads).toHaveLength(12);
    for (const t of treads) expect(t).toHaveLength(4);
  });

  it('Test 2: tread vertices co-planar at z = i·rise', () => {
    const g = computeStairGeometry(makeHelicalParams());
    const treads = allTreads(g);
    for (let i = 0; i < treads.length; i++) {
      const expectedZ = 175 * i;
      for (const v of treads[i]) expect(Math.abs(v.z - expectedZ)).toBeLessThan(Z_TOL);
    }
  });

  it('Test 3: inner corners at R=innerRadius, outer corners at R=outerRadius', () => {
    const g = computeStairGeometry(makeHelicalParams());
    const treads = allTreads(g);
    for (const t of treads) {
      // sign=+1 ccw order: inner_i, outer_i, outer_next, inner_next
      expect(distanceXY(t[0], { x: 0, y: 0 })).toBeCloseTo(400, 6);
      expect(distanceXY(t[3], { x: 0, y: 0 })).toBeCloseTo(400, 6);
      expect(distanceXY(t[1], { x: 0, y: 0 })).toBeCloseTo(1400, 6);
      expect(distanceXY(t[2], { x: 0, y: 0 })).toBeCloseTo(1400, 6);
    }
  });

  it('Test 4: angular increment = sweep/stepCount = 22.5°', () => {
    const g = computeStairGeometry(makeHelicalParams());
    const treads = allTreads(g);
    // Compare via (cos, sin) to avoid the ±π wrap discontinuity of atan2.
    const Router = 1400;
    const step = 22.5 * DEG2RAD;
    for (let i = 0; i < treads.length; i++) {
      const t0 = i * step;
      const t1 = (i + 1) * step;
      expect(treads[i][1].x).toBeCloseTo(Router * Math.cos(t0), 6);
      expect(treads[i][1].y).toBeCloseTo(Router * Math.sin(t0), 6);
      expect(treads[i][2].x).toBeCloseTo(Router * Math.cos(t1), 6);
      expect(treads[i][2].y).toBeCloseTo(Router * Math.sin(t1), 6);
    }
  });

  it('Test 5: walkline radius = (inner + outer)/2 = 900 for every vertex', () => {
    const g = computeStairGeometry(makeHelicalParams());
    const walkline: Polyline3D = g.walkline;
    expect(walkline).toHaveLength(13); // stepCount + 1
    for (const v of walkline) {
      expect(distanceXY(v, { x: 0, y: 0 })).toBeCloseTo(900, 6);
    }
  });

  it('Test 6: total chord length of walkline approaches R·sweepRad for fine sampling', () => {
    // 12 segments at 22.5° spacing on R=900. Chord len per segment = 2R·sin(Δθ/2).
    const g = computeStairGeometry(makeHelicalParams());
    const walkline = g.walkline;
    let total = 0;
    for (let i = 1; i < walkline.length; i++) {
      total += distanceXY(walkline[i - 1], walkline[i]);
    }
    const expected = 12 * 2 * 900 * Math.sin((22.5 * DEG2RAD) / 2);
    expect(total).toBeCloseTo(expected, 3);
  });

  it('Test 7: inner stringer at R=innerRadius, outer at R=outerRadius (stepCount+1 vertices each)', () => {
    const g = computeStairGeometry(makeHelicalParams());
    const inner = g.stringers.inner as Polyline3D;
    const outer = g.stringers.outer as Polyline3D;
    expect(inner).toHaveLength(13);
    expect(outer).toHaveLength(13);
    for (const v of inner) expect(distanceXY(v, { x: 0, y: 0 })).toBeCloseTo(400, 6);
    for (const v of outer) expect(distanceXY(v, { x: 0, y: 0 })).toBeCloseTo(1400, 6);
  });

  it('Test 8: cw mirrors ccw across the x-axis (outer-corner check)', () => {
    const ccw = computeStairGeometry(makeHelicalParams({ turnDirection: 'ccw' }));
    const cw = computeStairGeometry(makeHelicalParams({ turnDirection: 'cw' }));
    const ccwTreads = allTreads(ccw);
    const cwTreads = allTreads(cw);
    for (let i = 0; i < ccwTreads.length; i++) {
      // ccw outer_i (v1, angle +iα) mirrors cw outer_i (v2 under reversed order, angle -iα).
      const ccwOuter = ccwTreads[i][1];
      const cwOuter = cwTreads[i][2];
      expect(cwOuter.x).toBeCloseTo(ccwOuter.x, 6);
      expect(cwOuter.y).toBeCloseTo(-ccwOuter.y, 6);
    }
  });

  it('Test 9: cutLine emitted when totalRise > cutPlaneHeight, undefined otherwise', () => {
    // Default: rise=175, stepCount=12 → totalRise=2100 > 1200 → cut.
    const split = computeStairGeometry(makeHelicalParams());
    expect(split.cutLine).toBeDefined();
    const low = computeStairGeometry(makeHelicalParams({ rise: 50 }));
    expect(low.cutLine).toBeUndefined();
  });

  it("Test 10: treadLabels 'all' → stepCount labels at tread centroids", () => {
    const g = computeStairGeometry(makeHelicalParams({ treadLabelDisplay: 'all' }));
    const treads = allTreads(g);
    const labels = g.treadLabels ?? [];
    expect(labels).toHaveLength(12);
    for (let i = 0; i < labels.length; i++) {
      const t = treads[i];
      const cx = (t[0].x + t[1].x + t[2].x + t[3].x) / 4;
      const cy = (t[0].y + t[1].y + t[2].y + t[3].y) / 4;
      expect(labels[i].position.x).toBeCloseTo(cx, 6);
      expect(labels[i].position.y).toBeCloseTo(cy, 6);
    }
  });
});
