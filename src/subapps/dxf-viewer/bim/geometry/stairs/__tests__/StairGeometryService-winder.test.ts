/**
 * ADR-358 Phase 4b — `StairGeometryService` winder-kind tests.
 *
 * Geometry parameterization (canonical mm):
 *   - stepCount=14, winderCount=4, turnAngle=+90° (ccw), 'equal-going'
 *   - basePoint=(0,0,0), direction=0 (+X), tread=250, width=1000
 *   - n1 = floor((14−4)/2) = 5, n2 = 5
 *   - rise = 175 → totalRise = 2450 (> default cut plane 1200)
 *
 * @see ../StairGeometryService.ts
 * @see ../stair-geometry-winder.ts
 */

import { computeStairGeometry } from '../StairGeometryService';
import type {
  Polygon3D,
  StairParams,
  StairTreadLabelDisplay,
  StairVariantWinder,
  StairWinderMethod,
} from '../../../../bim/types/stair-types';

const Z_TOL = 1e-9;
const DEG2RAD = Math.PI / 180;

function makeWinderParams(overrides?: {
  stepCount?: number;
  winderCount?: number;
  turnAngle?: number;
  winderMethod?: StairWinderMethod;
  rise?: number;
  tread?: number;
  width?: number;
  cutPlaneHeight?: number;
  treadLabelDisplay?: StairTreadLabelDisplay;
}): StairParams {
  const stepCount = overrides?.stepCount ?? 14;
  const rise = overrides?.rise ?? 175;
  const variant: StairVariantWinder = {
    kind: 'winder',
    turnAngle: overrides?.turnAngle ?? 90,
    winderCount: overrides?.winderCount ?? 4,
    winderMethod: overrides?.winderMethod ?? 'equal-going',
  };
  return {
    basePoint: { x: 0, y: 0, z: 0 },
    direction: 0,
    rise,
    tread: overrides?.tread ?? 250,
    nosing: 0,
    nosingSide: 'none',
    width: overrides?.width ?? 1000,
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

describe('StairGeometryService — winder', () => {
  it('Test 1: stepCount=14, winderCount=4 → 14 treads, n1=5 / n2=5 derived', () => {
    const g = computeStairGeometry(makeWinderParams());
    const treads = allTreads(g);
    expect(treads).toHaveLength(14);
    // Flight 1 last tread (index 4) sits at x ≈ (n1-1)·tread = 1000 (back-left corner).
    // Pivot at (n1·tread, +halfW) = (1250, 500) for turnLeft.
    // Confirm by checking flight 1 advances along +X with tread step.
    const f1First = treads[0];
    const f1Last = treads[4];
    expect(f1First[0].x).toBeCloseTo(0, 6);
    expect(f1Last[0].x).toBeCloseTo(4 * 250, 6);
  });

  it('Test 2: tread z progression Δz=rise across all 14 treads', () => {
    const g = computeStairGeometry(makeWinderParams());
    const treads = allTreads(g);
    for (let i = 0; i < treads.length; i++) {
      const expectedZ = 175 * i;
      for (const v of treads[i]) expect(Math.abs(v.z - expectedZ)).toBeLessThan(Z_TOL);
    }
  });

  it('Test 3: balanced winders reach the pivot apex (no hole) with equal interior sweep', () => {
    // ADR-630 Phase 2 — winders are triangles from the shared inner corner P.
    const g = computeStairGeometry(makeWinderParams());
    const treads = allTreads(g);
    // Winder treads occupy indices [n1, n1+winderCount) = [5, 9).
    const apex = treads[5][0];
    for (let k = 5; k < 9; k++) {
      expect(treads[k]).toHaveLength(3);
      // every wedge's first vertex is the SAME pivot apex → fills to the corner.
      expect(Math.hypot(treads[k][0].x - apex.x, treads[k][0].y - apex.y)).toBeLessThan(1e-6);
    }
    // Interior wedges (not the two junction wedges) sweep the balanced equal
    // angle g/R where g = (2·tread + R·Θ)/(W+2), R = width/2.
    const R = 1000 / 2;
    const g0 = (2 * 250 + R * (90 * DEG2RAD)) / (4 + 2);
    const expectedSweep = g0 / R;
    for (const k of [6, 7]) {
      const t = treads[k];
      const a1 = { x: t[1].x - apex.x, y: t[1].y - apex.y };
      const a2 = { x: t[2].x - apex.x, y: t[2].y - apex.y };
      const ang = Math.acos(
        (a1.x * a2.x + a1.y * a2.y) / (Math.hypot(a1.x, a1.y) * Math.hypot(a2.x, a2.y)),
      );
      expect(ang).toBeCloseTo(expectedSweep, 4);
    }
  });

  it('Test 3b: flight-end treads are transition trapezoids that reach the pivot', () => {
    const g = computeStairGeometry(makeWinderParams());
    const treads = allTreads(g);
    const apex = treads[5][0]; // pivot (shared by the winders)
    // Last flight-1 tread (index n1-1 = 4) and first flight-2 tread (index 9)
    // are 4-vertex trapezoids, each carrying the pivot P as one vertex.
    for (const k of [4, 9]) {
      expect(treads[k]).toHaveLength(4);
      const hasPivot = treads[k].some(
        (v) => Math.hypot(v.x - apex.x, v.y - apex.y) < 1e-6,
      );
      expect(hasPivot).toBe(true);
    }
  });

  it("Test 4: both winder methods emit 3-vertex triangle wedges (ADR-630 Phase 2)", () => {
    // ADR-630 Phase 2 — balanced winders are always triangles reaching the pivot
    // P (independent of code profile); the winder method (`pie`/`equal-going`)
    // no longer changes the wedge vertex count. The transition trapezoids are
    // the flight-end treads (covered by Test 3b), not the wedges.
    const pie = computeStairGeometry(makeWinderParams({ winderMethod: 'pie' }));
    const eq = computeStairGeometry(makeWinderParams({ winderMethod: 'equal-going' }));
    const pieTreads = allTreads(pie);
    const eqTreads = allTreads(eq);
    for (let k = 5; k < 9; k++) expect(pieTreads[k]).toHaveLength(3);
    for (let k = 5; k < 9; k++) expect(eqTreads[k]).toHaveLength(3);
  });

  it('Test 5: flight 2 advances along u2 = rotate(u1, +90°) = (0,1)', () => {
    const g = computeStairGeometry(makeWinderParams());
    const treads = allTreads(g);
    // Flight 2 indices: [n1 + winderCount, stepCount) = [9, 14).
    const t9 = treads[9];
    const t10 = treads[10];
    expect(t10[0].x - t9[0].x).toBeCloseTo(0, 6);
    expect(t10[0].y - t9[0].y).toBeCloseTo(250, 6);
  });

  it('Test 6: stepCount=11, winderCount=3 → n1=4 (floor), n2=4 (ceil over even remainder)', () => {
    // remaining = 11 − 3 = 8 (even) → n1=4, n2=4.
    const g = computeStairGeometry(makeWinderParams({ stepCount: 11, winderCount: 3 }));
    const treads = allTreads(g);
    expect(treads).toHaveLength(11);
    // Flight 1 last (index n1-1=3) back-left at x = (n1-1)·tread = 750.
    expect(treads[3][0].x).toBeCloseTo(750, 6);
    // Flight 2 starts at index n1+winderCount=7. Its back-left = pivot at x = n1·tread = 1000.
    expect(treads[7][0].x).toBeCloseTo(1000, 6);
  });

  it('Test 7: walkline includes winder zone vertices (winderCount+3 = 7 total)', () => {
    const g = computeStairGeometry(makeWinderParams());
    expect(g.walkline).toHaveLength(7); // basePoint + (winderCount+1) winder samples + flight2 end
  });

  it('Test 8: stringers continuous through winder zone (same vertex count as walkline)', () => {
    const g = computeStairGeometry(makeWinderParams());
    expect(g.stringers.inner.length).toBe(g.walkline.length);
    expect(g.stringers.outer.length).toBe(g.walkline.length);
  });

  it('Test 9: cutLine emitted by default (totalRise=2450 > 1200), undefined for low rise', () => {
    const g = computeStairGeometry(makeWinderParams());
    expect(g.cutLine).toBeDefined();
    const low = computeStairGeometry(makeWinderParams({ rise: 50 }));
    expect(low.cutLine).toBeUndefined();
  });

  it("Test 10: 'kite'/'balanced' winderMethod throws /Phase 4c/", () => {
    expect(() => computeStairGeometry(makeWinderParams({ winderMethod: 'kite' })))
      .toThrow(/Phase 4c/);
    expect(() => computeStairGeometry(makeWinderParams({ winderMethod: 'balanced' })))
      .toThrow(/Phase 4c/);
  });

  it("Test 11: treadLabels 'all' span all stepCount treads", () => {
    const g = computeStairGeometry(makeWinderParams({ treadLabelDisplay: 'all' }));
    expect(g.treadLabels).toHaveLength(14);
  });

  it('Test 12: turnAngle=180° → u2 = -u1 = (-1,0); flight 2 advances along -X', () => {
    const g = computeStairGeometry(makeWinderParams({ turnAngle: 180 }));
    const treads = allTreads(g);
    const t9 = treads[9];
    const t10 = treads[10];
    expect(t10[0].x - t9[0].x).toBeCloseTo(-250, 6);
    expect(t10[0].y - t9[0].y).toBeCloseTo(0, 6);
  });
});
