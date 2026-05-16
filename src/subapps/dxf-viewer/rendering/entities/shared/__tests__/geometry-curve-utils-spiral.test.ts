/**
 * ADR-358 Phase 2a — Tests for `spiralSample` (unit Archimedean spiral).
 * Tolerance 1e-6 per §8 testing strategy.
 */
import { archimedeanArcLength, spiralSample } from '../geometry-curve-utils';
import type { Point3D } from '../../../types/Types';

const ORIGIN: Point3D = { x: 0, y: 0, z: 0 };

describe('spiralSample (ADR-358 Phase 2a)', () => {
  it('returns stepCount + 1 points', () => {
    expect(spiralSample(ORIGIN, 180, 'ccw', 8, 100)).toHaveLength(9);
    expect(spiralSample(ORIGIN, 360, 'cw', 16, 2400)).toHaveLength(17);
  });

  it('first sample equals centerPoint (apex r=0)', () => {
    const samples = spiralSample(ORIGIN, 270, 'ccw', 10, 500);
    expect(samples[0].x).toBeCloseTo(0, 9);
    expect(samples[0].y).toBeCloseTo(0, 9);
    expect(samples[0].z).toBeCloseTo(0, 9);
  });

  it('first sample tracks centerPoint when z != 0', () => {
    const center: Point3D = { x: 5, y: 7, z: 10 };
    const samples = spiralSample(center, 180, 'ccw', 4, 800);
    expect(samples[0].x).toBeCloseTo(5, 9);
    expect(samples[0].y).toBeCloseTo(7, 9);
    expect(samples[0].z).toBeCloseTo(10, 9);
  });

  it('last sample z = centerPoint.z + totalRise (linear z progression)', () => {
    const samples = spiralSample({ x: 5, y: 5, z: 10 }, 360, 'cw', 12, 2400);
    expect(samples[samples.length - 1].z).toBeCloseTo(10 + 2400, 9);
  });

  it('arc-length parameterization: each segment has equal analytical arc length', () => {
    const sweep = 270;
    const N = 10;
    const samples = spiralSample(ORIGIN, sweep, 'ccw', N, 1000);
    const sTotal = archimedeanArcLength(sweep * Math.PI / 180);
    const expectedPerStep = sTotal / N;
    for (let i = 0; i < N; i++) {
      // For unit spiral r = θ → θ recovers from radial distance
      const r_i = Math.hypot(samples[i].x, samples[i].y);
      const r_next = Math.hypot(samples[i + 1].x, samples[i + 1].y);
      const segArc = archimedeanArcLength(r_next) - archimedeanArcLength(r_i);
      expect(segArc).toBeCloseTo(expectedPerStep, 6);
    }
  });

  it('z values are monotonically increasing with constant step', () => {
    const samples = spiralSample(ORIGIN, 180, 'ccw', 8, 800);
    const expectedRise = 800 / 8;
    for (let i = 0; i < samples.length - 1; i++) {
      expect(samples[i + 1].z - samples[i].z).toBeCloseTo(expectedRise, 9);
    }
  });

  it('radial distance monotonically grows (spiral expands outward)', () => {
    const samples = spiralSample(ORIGIN, 540, 'ccw', 12, 1200);
    for (let i = 0; i < samples.length - 1; i++) {
      const r_i = Math.hypot(samples[i].x, samples[i].y);
      const r_next = Math.hypot(samples[i + 1].x, samples[i + 1].y);
      expect(r_next).toBeGreaterThan(r_i);
    }
  });

  it('cw mirrors ccw across x-axis: x identical, y negated, z identical', () => {
    const ccw = spiralSample(ORIGIN, 180, 'ccw', 8, 500);
    const cw = spiralSample(ORIGIN, 180, 'cw', 8, 500);
    expect(cw).toHaveLength(ccw.length);
    for (let i = 0; i < ccw.length; i++) {
      expect(cw[i].x).toBeCloseTo(ccw[i].x, 9);
      expect(cw[i].y).toBeCloseTo(-ccw[i].y, 9);
      expect(cw[i].z).toBeCloseTo(ccw[i].z, 9);
    }
  });

  it('stepCount=8, sweepAngle=180°, cw → last sample at angle -π (x<0, y≈0)', () => {
    const samples = spiralSample(ORIGIN, 180, 'cw', 8, 100);
    const last = samples[samples.length - 1];
    expect(last.y).toBeCloseTo(0, 6);
    expect(last.x).toBeLessThan(0);
    // unit-spiral: r = θ_max = π at sweep 180°
    expect(Math.hypot(last.x, last.y)).toBeCloseTo(Math.PI, 9);
  });

  it('stepCount=1 → 2 points (apex + end)', () => {
    const samples = spiralSample(ORIGIN, 90, 'ccw', 1, 50);
    expect(samples).toHaveLength(2);
    expect(samples[0]).toEqual({ x: 0, y: 0, z: 0 });
    const thetaMax = Math.PI / 2;
    expect(samples[1].x).toBeCloseTo(thetaMax * Math.cos(thetaMax), 9);
    expect(samples[1].y).toBeCloseTo(thetaMax * Math.sin(thetaMax), 9);
    expect(samples[1].z).toBeCloseTo(50, 9);
  });

  it('archimedeanArcLength matches analytical reference values', () => {
    // θ=0 → L=0 (boundary)
    expect(archimedeanArcLength(0)).toBe(0);
    // θ=1 → L = ½ · (√2 + asinh(1)) = ½ · (1.41421356… + 0.88137359…)
    expect(archimedeanArcLength(1)).toBeCloseTo(1.1477935746, 9);
    // monotonic increasing
    expect(archimedeanArcLength(2)).toBeGreaterThan(archimedeanArcLength(1));
    expect(archimedeanArcLength(Math.PI)).toBeGreaterThan(archimedeanArcLength(1));
  });
});
