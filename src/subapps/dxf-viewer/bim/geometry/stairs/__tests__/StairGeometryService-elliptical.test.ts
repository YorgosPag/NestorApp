/**
 * ADR-358 Phase 4b — `StairGeometryService` elliptical-kind tests.
 *
 * Geometry parameterization (canonical mm):
 *   - stepCount=12, sweepAngle=270°, semiMajor=1500, semiMinor=1000, ccw
 *   - centerPoint=(0,0,0), totalRise=2100, width=800, rotation=0 (unless override)
 *
 * Tolerances match Phase 3a/3b/4a: 1e-6 xy where exact, 1e-9 z, looser bounds
 * for chord-vs-arc comparisons (analytical arc length via Phase 2b
 * `ellipseArcLength`).
 *
 * @see ../StairGeometryService.ts
 * @see ../stair-geometry-elliptical.ts
 */

import { computeStairGeometry } from '../StairGeometryService';
import { ellipseArcLength } from '../../../../rendering/entities/shared/geometry-curve-utils';
import type {
  Polygon3D,
  StairParams,
  StairTreadLabelDisplay,
  StairVariantElliptical,
} from '../../../../types/stair';

const Z_TOL = 1e-9;
const DEG2RAD = Math.PI / 180;

function makeEllipticalParams(overrides?: {
  stepCount?: number;
  sweepAngle?: number;
  turnDirection?: 'cw' | 'ccw';
  semiMajor?: number;
  semiMinor?: number;
  rotation?: number;
  totalRise?: number;
  width?: number;
  cutPlaneHeight?: number;
  treadLabelDisplay?: StairTreadLabelDisplay;
}): StairParams {
  const stepCount = overrides?.stepCount ?? 12;
  const totalRise = overrides?.totalRise ?? 2100;
  const rise = totalRise / stepCount;
  const variant: StairVariantElliptical = {
    kind: 'elliptical',
    centerPoint: { x: 0, y: 0, z: 0 },
    semiMajor: overrides?.semiMajor ?? 1500,
    semiMinor: overrides?.semiMinor ?? 1000,
    sweepAngle: overrides?.sweepAngle ?? 270,
    turnDirection: overrides?.turnDirection ?? 'ccw',
    rotation: overrides?.rotation ?? 0,
  };
  return {
    basePoint: { x: 0, y: 0, z: 0 },
    direction: 0,
    rise,
    tread: 250,
    nosing: 0,
    nosingSide: 'none',
    width: overrides?.width ?? 800,
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

function chordLen(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

describe('StairGeometryService — elliptical', () => {
  it('Test 1: produces stepCount 4-vertex treads', () => {
    const g = computeStairGeometry(makeEllipticalParams());
    const treads = allTreads(g);
    expect(treads).toHaveLength(12);
    for (const t of treads) expect(t).toHaveLength(4);
  });

  it('Test 2: tread vertices co-planar at z = i·rise', () => {
    const g = computeStairGeometry(makeEllipticalParams());
    const treads = allTreads(g);
    const rise = 2100 / 12;
    for (let i = 0; i < treads.length; i++) {
      const expectedZ = rise * i;
      for (const v of treads[i]) expect(Math.abs(v.z - expectedZ)).toBeLessThan(Z_TOL);
    }
  });

  it('Test 3: walkline first vertex at centerPoint + (semiMajor, 0) for rotation=0', () => {
    const g = computeStairGeometry(makeEllipticalParams());
    expect(g.walkline).toHaveLength(13);
    expect(g.walkline[0].x).toBeCloseTo(1500, 6);
    expect(g.walkline[0].y).toBeCloseTo(0, 6);
  });

  it('Test 4: cumulative walkline chord ≈ analytical ellipse arc (tol 2%)', () => {
    const g = computeStairGeometry(makeEllipticalParams());
    const wl = g.walkline;
    let chord = 0;
    for (let i = 1; i < wl.length; i++) chord += chordLen(wl[i - 1], wl[i]);
    const analytical = ellipseArcLength(1500, 1000, 270 * DEG2RAD);
    expect(Math.abs(chord - analytical) / analytical).toBeLessThan(0.02);
  });

  it('Test 5: cw mirrors ccw across x-axis (rotation=0)', () => {
    const ccw = computeStairGeometry(makeEllipticalParams({ turnDirection: 'ccw' }));
    const cw = computeStairGeometry(makeEllipticalParams({ turnDirection: 'cw' }));
    for (let i = 0; i < ccw.walkline.length; i++) {
      expect(cw.walkline[i].x).toBeCloseTo(ccw.walkline[i].x, 6);
      expect(cw.walkline[i].y).toBeCloseTo(-ccw.walkline[i].y, 6);
    }
  });

  it('Test 6: rotation=90° rotates walkline first vertex to (0, semiMajor)', () => {
    const g = computeStairGeometry(makeEllipticalParams({ rotation: 90 }));
    expect(g.walkline[0].x).toBeCloseTo(0, 6);
    expect(g.walkline[0].y).toBeCloseTo(1500, 6);
  });

  it('Test 7: walkline chord lengths approximately uniform (tol 25%)', () => {
    const g = computeStairGeometry(makeEllipticalParams());
    const wl = g.walkline;
    const chords: number[] = [];
    for (let i = 1; i < wl.length; i++) chords.push(chordLen(wl[i - 1], wl[i]));
    const mean = chords.reduce((s, c) => s + c, 0) / chords.length;
    for (const c of chords) {
      expect(Math.abs(c - mean) / mean).toBeLessThan(0.25);
    }
  });

  it('Test 8: cutLine emitted when totalRise > cutPlaneHeight, undefined otherwise', () => {
    const split = computeStairGeometry(makeEllipticalParams()); // 2100 > 1200
    expect(split.cutLine).toBeDefined();
    const low = computeStairGeometry(makeEllipticalParams({ totalRise: 600 }));
    expect(low.cutLine).toBeUndefined();
  });

  it('Test 9: arrow runs from first walkline vertex to last', () => {
    const g = computeStairGeometry(makeEllipticalParams());
    expect(g.arrowSymbol.label).toBe('UP');
    expect(g.arrowSymbol.start.x).toBeCloseTo(g.walkline[0].x, 6);
    expect(g.arrowSymbol.start.y).toBeCloseTo(g.walkline[0].y, 6);
    expect(g.arrowSymbol.end.x).toBeCloseTo(g.walkline[g.walkline.length - 1].x, 6);
    expect(g.arrowSymbol.end.y).toBeCloseTo(g.walkline[g.walkline.length - 1].y, 6);
  });

  it("Test 10: treadLabels 'all' → stepCount labels at tread centroids", () => {
    const g = computeStairGeometry(makeEllipticalParams({ treadLabelDisplay: 'all' }));
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
