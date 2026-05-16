/**
 * ADR-358 Phase 4c — `StairGeometryService` triangular-fan tests.
 *
 * Geometry parameterization (canonical mm):
 *   - stepCount=10, stepCountPerArc=10, openingAngle=90°, ccw
 *   - apexPoint=(0,0,0), width=1500 (outer radius), totalRise=1750
 *   - rise = 175 → exceeds default cut plane (1200) by tread index 7
 *
 * @see ../StairGeometryService.ts
 * @see ../stair-geometry-triangular-fan.ts
 */

import { computeStairGeometry } from '../StairGeometryService';
import type {
  Polygon3D,
  StairParams,
  StairTreadLabelDisplay,
  StairVariantTriangularFan,
} from '../../../types/stair';

const Z_TOL = 1e-9;
const XY_TOL = 1e-6;
const DEG2RAD = Math.PI / 180;

function makeFanParams(overrides?: {
  stepCount?: number;
  stepCountPerArc?: number;
  openingAngle?: number;
  turnDirection?: 'cw' | 'ccw';
  width?: number;
  totalRise?: number;
  cutPlaneHeight?: number;
  treadLabelDisplay?: StairTreadLabelDisplay;
}): StairParams {
  const stepCount = overrides?.stepCount ?? 10;
  const totalRise = overrides?.totalRise ?? 1750;
  const rise = totalRise / stepCount;
  const variant: StairVariantTriangularFan = {
    kind: 'triangular-fan',
    apexPoint: { x: 0, y: 0, z: 0 },
    openingAngle: overrides?.openingAngle ?? 90,
    stepCountPerArc: overrides?.stepCountPerArc ?? stepCount,
    turnDirection: overrides?.turnDirection ?? 'ccw',
  };
  return {
    basePoint: { x: 0, y: 0, z: 0 },
    direction: 0,
    rise,
    tread: 250,
    nosing: 0,
    nosingSide: 'none',
    width: overrides?.width ?? 1500,
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

describe('StairGeometryService — triangular-fan', () => {
  it('Test 1: stepCount=10, openingAngle=90° → 10 triangular treads, walkline length 11', () => {
    const g = computeStairGeometry(makeFanParams());
    const treads = allTreads(g);
    expect(treads).toHaveLength(10);
    expect(g.walkline).toHaveLength(11);
  });

  it('Test 2: every tread is 3-vertex with apex at apexPoint', () => {
    const g = computeStairGeometry(makeFanParams());
    const treads = allTreads(g);
    for (const t of treads) {
      expect(t).toHaveLength(3);
      expect(Math.abs(t[0].x)).toBeLessThan(XY_TOL);
      expect(Math.abs(t[0].y)).toBeLessThan(XY_TOL);
    }
  });

  it('Test 3: outer corners at radius = width', () => {
    const g = computeStairGeometry(makeFanParams());
    const treads = allTreads(g);
    for (const t of treads) {
      for (let k = 1; k < 3; k++) {
        const r = Math.hypot(t[k].x, t[k].y);
        expect(r).toBeCloseTo(1500, 6);
      }
    }
  });

  it('Test 4: angular increment = openingAngle/stepCount = 9° (cos/sin compare)', () => {
    const g = computeStairGeometry(makeFanParams());
    const treads = allTreads(g);
    // Compare angular gap between successive outer corners.
    const expectedStep = 9 * DEG2RAD;
    for (let i = 0; i < treads.length; i++) {
      const a = treads[i][1]; // outerA at theta_i
      const b = treads[i][2]; // outerB at theta_{i+1}
      // For ccw, theta_i = i·step, theta_{i+1} = (i+1)·step
      const cosA = Math.cos(i * expectedStep);
      const sinA = Math.sin(i * expectedStep);
      const cosB = Math.cos((i + 1) * expectedStep);
      const sinB = Math.sin((i + 1) * expectedStep);
      expect(a.x / 1500).toBeCloseTo(cosA, 6);
      expect(a.y / 1500).toBeCloseTo(sinA, 6);
      expect(b.x / 1500).toBeCloseTo(cosB, 6);
      expect(b.y / 1500).toBeCloseTo(sinB, 6);
    }
  });

  it('Test 5: z = i·rise co-planar per tread', () => {
    const g = computeStairGeometry(makeFanParams());
    const treads = allTreads(g);
    const rise = 1750 / 10;
    for (let i = 0; i < treads.length; i++) {
      for (const v of treads[i]) {
        expect(Math.abs(v.z - rise * i)).toBeLessThan(Z_TOL);
      }
    }
  });

  it('Test 6: cw mirrors ccw across x-axis (apex at origin)', () => {
    const ccw = computeStairGeometry(makeFanParams({ turnDirection: 'ccw' }));
    const cw = computeStairGeometry(makeFanParams({ turnDirection: 'cw' }));
    for (let i = 0; i < ccw.walkline.length; i++) {
      expect(cw.walkline[i].x).toBeCloseTo(ccw.walkline[i].x, 6);
      expect(cw.walkline[i].y).toBeCloseTo(-ccw.walkline[i].y, 6);
    }
  });

  it('Test 7: cutLine emitted when totalRise > cutPlaneHeight, undefined when below', () => {
    const high = computeStairGeometry(makeFanParams()); // 1750 > 1200
    expect(high.cutLine).toBeDefined();
    const low = computeStairGeometry(makeFanParams({ totalRise: 600 }));
    expect(low.cutLine).toBeUndefined();
  });

  it("Test 8: treadLabels 'all' → stepCount labels at tread centroids", () => {
    const g = computeStairGeometry(makeFanParams({ treadLabelDisplay: 'all' }));
    const treads = allTreads(g);
    const labels = g.treadLabels ?? [];
    expect(labels).toHaveLength(10);
    for (let i = 0; i < labels.length; i++) {
      const t = treads[i];
      const cx = (t[0].x + t[1].x + t[2].x) / 3;
      const cy = (t[0].y + t[1].y + t[2].y) / 3;
      expect(labels[i].position.x).toBeCloseTo(cx, 6);
      expect(labels[i].position.y).toBeCloseTo(cy, 6);
    }
  });

  it('Test 9: stepCount ≠ stepCountPerArc → throws', () => {
    expect(() =>
      computeStairGeometry(makeFanParams({ stepCount: 10, stepCountPerArc: 5 })),
    ).toThrow(/triangular-fan requires stepCount === stepCountPerArc/);
  });
});
