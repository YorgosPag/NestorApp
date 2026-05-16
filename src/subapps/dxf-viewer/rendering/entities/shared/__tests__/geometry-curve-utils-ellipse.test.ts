/**
 * ADR-358 Phase 2b — Tests for `ellipseArcLength` + `ellipseSample`.
 * Tolerance 1e-6 vs analytical (circular limit), ~1e-5 vs Ramanujan
 * approximation (numerical integration). §8 testing strategy.
 */
import { ellipseArcLength, ellipseSample } from '../geometry-curve-utils';
import type { Point3D } from '../../../types/Types';

const ORIGIN: Point3D = { x: 0, y: 0, z: 0 };
const HALF_PI = Math.PI / 2;
const TWO_PI = 2 * Math.PI;

/** Ramanujan's 2nd approximation for ellipse perimeter. */
function ramanujanPerimeter(a: number, b: number): number {
  return Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
}

describe('ellipseArcLength (ADR-358 Phase 2b)', () => {
  it('reduces to circular arc R·θ when semiMajor === semiMinor', () => {
    const R = 250;
    expect(ellipseArcLength(R, R, HALF_PI)).toBeCloseTo(R * HALF_PI, 6);
    expect(ellipseArcLength(R, R, TWO_PI)).toBeCloseTo(R * TWO_PI, 6);
    expect(ellipseArcLength(R, R, 1.2345)).toBeCloseTo(R * 1.2345, 6);
  });

  it('θ=0 returns 0 exactly', () => {
    expect(ellipseArcLength(300, 100, 0)).toBe(0);
    expect(ellipseArcLength(100, 100, 0)).toBe(0);
  });

  it('quarter-ellipse matches Ramanujan / 4 (low-eccentricity, relative 1e-6)', () => {
    // Ramanujan-II error ~ h^10 where h = (a-b)/(a+b). For a/b ratio ~1.33,
    // error is well below 1e-8 relative, leaving room for Simpson 1e-6.
    const a = 200;
    const b = 150;
    const quarter = ellipseArcLength(a, b, HALF_PI);
    const expected = ramanujanPerimeter(a, b) / 4;
    expect(Math.abs(quarter - expected) / expected).toBeLessThan(1e-6);
  });

  it('full perimeter matches Ramanujan (low-eccentricity, relative 1e-6)', () => {
    const a = 250;
    const b = 200;
    const full = ellipseArcLength(a, b, TWO_PI);
    const expected = ramanujanPerimeter(a, b);
    expect(Math.abs(full - expected) / expected).toBeLessThan(1e-6);
  });

  it('full perimeter high-eccentricity within Ramanujan error band (relative 1e-3)', () => {
    // a/b = 3 → Ramanujan-II relative error ~1e-4 (not Simpson's fault). This
    // validates the Simpson result sits inside the Ramanujan band: our
    // integration is not orders of magnitude off, even when the reference
    // approximation itself degrades.
    const a = 300;
    const b = 100;
    const full = ellipseArcLength(a, b, TWO_PI);
    const expected = ramanujanPerimeter(a, b);
    expect(Math.abs(full - expected) / expected).toBeLessThan(1e-3);
  });

  it('monotonically increases with θ', () => {
    const a = 200;
    const b = 90;
    let prev = 0;
    for (let i = 1; i <= 32; i++) {
      const theta = (i / 32) * TWO_PI;
      const L = ellipseArcLength(a, b, theta);
      expect(L).toBeGreaterThan(prev);
      prev = L;
    }
  });

  it('|negative θ| is treated as |θ| (arc length is unsigned)', () => {
    const a = 200;
    const b = 90;
    expect(ellipseArcLength(a, b, -1.2345)).toBeCloseTo(ellipseArcLength(a, b, 1.2345), 9);
  });
});

describe('ellipseSample (ADR-358 Phase 2b)', () => {
  it('returns stepCount + 1 points', () => {
    expect(ellipseSample(ORIGIN, 300, 100, 180, 'ccw', 0, 8, 400)).toHaveLength(9);
    expect(ellipseSample(ORIGIN, 300, 100, 360, 'ccw', 0, 1, 100)).toHaveLength(2);
  });

  it('first sample = centerPoint + (semiMajor, 0) when rotation=0', () => {
    const center: Point3D = { x: 10, y: 20, z: 5 };
    const a = 300;
    const samples = ellipseSample(center, a, 100, 180, 'ccw', 0, 8, 400);
    expect(samples[0].x).toBeCloseTo(center.x + a, 9);
    expect(samples[0].y).toBeCloseTo(center.y, 9);
    expect(samples[0].z).toBeCloseTo(center.z, 9);
  });

  it('first sample rotated by 90° → (0, semiMajor) from center', () => {
    const center: Point3D = { x: 10, y: 20, z: 0 };
    const a = 300;
    const samples = ellipseSample(center, a, 100, 180, 'ccw', 90, 8, 400);
    expect(samples[0].x).toBeCloseTo(center.x, 6);
    expect(samples[0].y).toBeCloseTo(center.y + a, 6);
  });

  it('last sample z = centerPoint.z + totalRise', () => {
    const center: Point3D = { x: 0, y: 0, z: 50 };
    const samples = ellipseSample(center, 300, 100, 270, 'ccw', 0, 12, 1200);
    expect(samples[samples.length - 1].z).toBeCloseTo(50 + 1200, 9);
  });

  it('z progression is linear with constant step', () => {
    const samples = ellipseSample(ORIGIN, 250, 80, 360, 'cw', 0, 16, 1600);
    const expectedRise = 1600 / 16;
    for (let i = 0; i < samples.length - 1; i++) {
      expect(samples[i + 1].z - samples[i].z).toBeCloseTo(expectedRise, 9);
    }
  });

  it('cumulative chord ≈ analytical arc length (arc-length parameterization works)', () => {
    const a = 300;
    const b = 100;
    const sweepDeg = 270;
    const N = 64;
    const samples = ellipseSample(ORIGIN, a, b, sweepDeg, 'ccw', 0, N, 0);
    const total = ellipseArcLength(a, b, (sweepDeg * Math.PI) / 180);
    let cum = 0;
    for (let i = 0; i < N; i++) {
      cum += Math.hypot(samples[i + 1].x - samples[i].x, samples[i + 1].y - samples[i].y);
    }
    // Chord polyline underestimates arc; for N=64 over 270° on an a/b=3 ellipse the
    // discretization error stays below 0.1%.
    expect(cum).toBeGreaterThan(total * 0.999);
    expect(cum).toBeLessThan(total * 1.001);
  });

  it('per-step ARC length is uniform (parameterization invariant, NOT chord)', () => {
    // On an ellipse, chords are NOT equal between equal-arc samples (curvature
    // varies). Recover θ from each sample and verify analytical arc-length
    // increments stay constant.
    const a = 300;
    const b = 100;
    const sweepDeg = 270;
    const sweepRad = (sweepDeg * Math.PI) / 180;
    const N = 32;
    const samples = ellipseSample(ORIGIN, a, b, sweepDeg, 'ccw', 0, N, 0);
    const total = ellipseArcLength(a, b, sweepRad);
    const expectedPerStep = total / N;
    let prevTheta = 0;
    let prevS = 0;
    for (let i = 1; i <= N; i++) {
      // Local ellipse: x = a·cos(t), y = b·sin(t) → t = atan2(y/b, x/a).
      let t = Math.atan2(samples[i].y / b, samples[i].x / a);
      while (t < prevTheta - 1e-6) t += 2 * Math.PI;
      const s = ellipseArcLength(a, b, t);
      expect(s - prevS).toBeCloseTo(expectedPerStep, 4);
      prevTheta = t;
      prevS = s;
    }
  });

  it('cw mirrors ccw across x-axis when rotation=0', () => {
    const a = 300;
    const b = 100;
    const ccw = ellipseSample(ORIGIN, a, b, 270, 'ccw', 0, 12, 600);
    const cw = ellipseSample(ORIGIN, a, b, 270, 'cw', 0, 12, 600);
    expect(cw).toHaveLength(ccw.length);
    for (let i = 0; i < ccw.length; i++) {
      expect(cw[i].x).toBeCloseTo(ccw[i].x, 6);
      expect(cw[i].y).toBeCloseTo(-ccw[i].y, 6);
      expect(cw[i].z).toBeCloseTo(ccw[i].z, 9);
    }
  });

  it('a === b reduces to circular helix sampling (uniform angular)', () => {
    const R = 200;
    const sweepDeg = 180;
    const N = 8;
    const samples = ellipseSample(ORIGIN, R, R, sweepDeg, 'ccw', 0, N, 400);
    // Each sample sits on the circle of radius R, uniform angular spacing
    for (const s of samples) {
      expect(Math.hypot(s.x, s.y)).toBeCloseTo(R, 6);
    }
    const sweepRad = (sweepDeg * Math.PI) / 180;
    for (let i = 0; i <= N; i++) {
      const expectedAngle = (i / N) * sweepRad;
      expect(samples[i].x).toBeCloseTo(R * Math.cos(expectedAngle), 6);
      expect(samples[i].y).toBeCloseTo(R * Math.sin(expectedAngle), 6);
    }
  });
});
