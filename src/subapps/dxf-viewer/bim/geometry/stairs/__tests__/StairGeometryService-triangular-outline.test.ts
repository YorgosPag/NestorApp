/**
 * ADR-358 Phase 4c — `StairGeometryService` triangular-outline tests.
 *
 * Geometry parameterization (canonical mm):
 *   - triangleVertices = [(0,0,0), (3000,0,0), (0,3000,0)] (right triangle)
 *   - entrySide=0 → entry edge V0→V1 (along +X), apex V2 at (0,3000,0)
 *   - stepCount=6, ccw, totalRise=1050 → rise=175, exceeds default cut plane
 *
 * @see ../StairGeometryService.ts
 * @see ../stair-geometry-triangular-outline.ts
 */

import { computeStairGeometry } from '../StairGeometryService';
import type {
  Point3D,
  Polygon3D,
  StairParams,
  StairTreadLabelDisplay,
  StairVariantTriangularOutline,
} from '../../../../bim/types/stair-types';

const Z_TOL = 1e-9;
const XY_TOL = 1e-6;

function makeOutlineParams(overrides?: {
  triangleVertices?: readonly [Point3D, Point3D, Point3D];
  entrySide?: 0 | 1 | 2;
  orientation?: 'cw' | 'ccw';
  stepCount?: number;
  width?: number;
  totalRise?: number;
  cutPlaneHeight?: number;
  treadLabelDisplay?: StairTreadLabelDisplay;
}): StairParams {
  const stepCount = overrides?.stepCount ?? 6;
  const totalRise = overrides?.totalRise ?? 1050;
  const rise = totalRise / stepCount;
  const variant: StairVariantTriangularOutline = {
    kind: 'triangular-outline',
    triangleVertices: overrides?.triangleVertices ?? [
      { x: 0, y: 0, z: 0 },
      { x: 3000, y: 0, z: 0 },
      { x: 0, y: 3000, z: 0 },
    ],
    entrySide: overrides?.entrySide ?? 0,
    orientation: overrides?.orientation ?? 'ccw',
  };
  return {
    basePoint: { x: 0, y: 0, z: 0 },
    direction: 0,
    rise,
    tread: 250,
    nosing: 0,
    nosingSide: 'none',
    width: overrides?.width ?? 600,
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
    treadLabelRestartPerFlight: false,
    codeProfile: 'none',
  };
}

function allTreads(g: ReturnType<typeof computeStairGeometry>): readonly Polygon3D[] {
  return [...g.treadsBelowCut, ...g.treadsAboveCut];
}

// Sign of the cross product (V_b - V_a) × (P - V_a). Same sign for all vertices
// of a triangle ⇒ point inside (strict-interior test would require all > 0; we
// allow ≥ 0 to admit boundary points produced by degenerate apex tread).
function pointInTriangle(
  P: { x: number; y: number },
  v0: { x: number; y: number },
  v1: { x: number; y: number },
  v2: { x: number; y: number },
): boolean {
  const cross = (a: typeof v0, b: typeof v0, p: typeof v0): number =>
    (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
  const d1 = cross(v0, v1, P);
  const d2 = cross(v1, v2, P);
  const d3 = cross(v2, v0, P);
  const hasNeg = d1 < -1e-6 || d2 < -1e-6 || d3 < -1e-6;
  const hasPos = d1 > 1e-6 || d2 > 1e-6 || d3 > 1e-6;
  return !(hasNeg && hasPos);
}

describe('StairGeometryService — triangular-outline', () => {
  it('Test 1: stepCount=6 → 6 treads, walkline length 7', () => {
    const g = computeStairGeometry(makeOutlineParams());
    expect(allTreads(g)).toHaveLength(6);
    expect(g.walkline).toHaveLength(7);
  });

  it('Test 2: every tread centroid lies inside the triangle', () => {
    const g = computeStairGeometry(makeOutlineParams());
    const treads = allTreads(g);
    const v0 = { x: 0, y: 0 };
    const v1 = { x: 3000, y: 0 };
    const v2 = { x: 0, y: 3000 };
    for (const t of treads) {
      let cx = 0;
      let cy = 0;
      for (const v of t) {
        cx += v.x;
        cy += v.y;
      }
      cx /= t.length;
      cy /= t.length;
      expect(pointInTriangle({ x: cx, y: cy }, v0, v1, v2)).toBe(true);
    }
  });

  it('Test 3: treads ascend perpendicular to entry edge (entry edge along +X ⇒ centroid y monotonic)', () => {
    const g = computeStairGeometry(makeOutlineParams());
    const treads = allTreads(g);
    const ys: number[] = [];
    for (const t of treads) {
      let sy = 0;
      for (const v of t) sy += v.y;
      ys.push(sy / t.length);
    }
    for (let i = 1; i < ys.length; i++) expect(ys[i]).toBeGreaterThan(ys[i - 1]);
  });

  it('Test 4: z = i·rise co-planar per tread', () => {
    const g = computeStairGeometry(makeOutlineParams());
    const treads = allTreads(g);
    const rise = 1050 / 6;
    for (let i = 0; i < treads.length; i++) {
      for (const v of treads[i]) expect(Math.abs(v.z - rise * i)).toBeLessThan(Z_TOL);
    }
  });

  it('Test 5: orientation cw reverses polygon vertex order vs ccw (same vertex set)', () => {
    const ccw = computeStairGeometry(makeOutlineParams({ orientation: 'ccw' }));
    const cw = computeStairGeometry(makeOutlineParams({ orientation: 'cw' }));
    const ccwT = allTreads(ccw);
    const cwT = allTreads(cw);
    // ccw order: [lowA, lowB, highB, highA] ; cw order: [lowA, highA, highB, lowB]
    // lowA / highB shared at indices 0 / 2 between the two orderings.
    for (let i = 0; i < ccwT.length; i++) {
      expect(cwT[i][0].x).toBeCloseTo(ccwT[i][0].x, 6);
      expect(cwT[i][0].y).toBeCloseTo(ccwT[i][0].y, 6);
      expect(cwT[i][2].x).toBeCloseTo(ccwT[i][2].x, 6);
      expect(cwT[i][2].y).toBeCloseTo(ccwT[i][2].y, 6);
    }
  });

  it('Test 6: cutLine emitted when totalRise > cutPlaneHeight, undefined when below', () => {
    const high = computeStairGeometry(makeOutlineParams()); // 1050 < 1200
    expect(high.cutLine).toBeUndefined();
    const cleared = computeStairGeometry(makeOutlineParams({ totalRise: 2400 }));
    expect(cleared.cutLine).toBeDefined();
  });

  it('Test 7: walkline ascends from entry-edge midpoint toward opposite vertex', () => {
    const g = computeStairGeometry(makeOutlineParams());
    const first = g.walkline[0];
    const last = g.walkline[g.walkline.length - 1];
    // Entry midpoint of edge [(0,0)-(3000,0)] = (1500, 0)
    expect(first.x).toBeCloseTo(1500, 6);
    expect(first.y).toBeCloseTo(0, 6);
    // Opposite vertex = (0, 3000)
    expect(last.x).toBeCloseTo(0, 6);
    expect(last.y).toBeCloseTo(3000, 6);
  });

  it("Test 8: treadLabels 'all' → stepCount labels", () => {
    const g = computeStairGeometry(makeOutlineParams({ treadLabelDisplay: 'all' }));
    expect(g.treadLabels).toBeDefined();
    expect(g.treadLabels?.length).toBe(6);
  });

  it("Test 9: last tread degenerates to apex (two corners coincide)", () => {
    const g = computeStairGeometry(makeOutlineParams());
    const treads = allTreads(g);
    const last = treads[treads.length - 1];
    // For ccw winding the two apex-side corners are indices 2 and 3 (highB, highA).
    // Both should coincide with the opposite vertex (0,3000).
    expect(Math.abs(last[2].x - last[3].x)).toBeLessThan(XY_TOL);
    expect(Math.abs(last[2].y - last[3].y)).toBeLessThan(XY_TOL);
    expect(last[2].x).toBeCloseTo(0, 6);
    expect(last[2].y).toBeCloseTo(3000, 6);
  });
});
