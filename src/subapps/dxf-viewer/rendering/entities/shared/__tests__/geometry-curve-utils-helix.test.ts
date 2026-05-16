/**
 * ADR-358 Phase 2a — Tests for `helixSample` (circular open-well helix).
 * Tolerance 1e-6 per §8 testing strategy.
 */
import { helixSample } from '../geometry-curve-utils';
import type { Point3D } from '../../../types/Types';

const ORIGIN: Point3D = { x: 0, y: 0, z: 0 };

describe('helixSample (ADR-358 Phase 2a)', () => {
  it('returns stepCount + 1 points', () => {
    expect(helixSample(ORIGIN, 100, 200, 180, 'ccw', 8, 500)).toHaveLength(9);
    expect(helixSample(ORIGIN, 100, 200, 180, 'ccw', 1, 500)).toHaveLength(2);
  });

  it('all samples lie on the walkline circle radius = (inner+outer)/2', () => {
    const inner = 100;
    const outer = 250;
    const R = (inner + outer) / 2;
    const samples = helixSample(ORIGIN, inner, outer, 270, 'ccw', 16, 1000);
    for (const s of samples) {
      expect(Math.hypot(s.x, s.y)).toBeCloseTo(R, 6);
    }
  });

  it('walkline arc length = R · sweepRad (analytical, uniform per step)', () => {
    const inner = 100;
    const outer = 200;
    const R = (inner + outer) / 2; // 150
    const sweepDeg = 180;
    const sweepRad = (sweepDeg * Math.PI) / 180;
    const N = 12;
    const samples = helixSample(ORIGIN, inner, outer, sweepDeg, 'ccw', N, 600);
    const expectedPerStepArc = (R * sweepRad) / N;
    for (let i = 0; i < N; i++) {
      const a_i = Math.atan2(samples[i].y, samples[i].x);
      const a_next = Math.atan2(samples[i + 1].y, samples[i + 1].x);
      let da = a_next - a_i;
      if (da < -Math.PI) da += 2 * Math.PI;
      if (da > Math.PI) da -= 2 * Math.PI;
      const segArc = R * Math.abs(da);
      expect(segArc).toBeCloseTo(expectedPerStepArc, 6);
    }
  });

  it('z progression is linear with constant step', () => {
    const samples = helixSample(ORIGIN, 100, 200, 360, 'cw', 16, 3200);
    const expectedRise = 3200 / 16;
    for (let i = 0; i < samples.length - 1; i++) {
      expect(samples[i + 1].z - samples[i].z).toBeCloseTo(expectedRise, 9);
    }
    expect(samples[samples.length - 1].z).toBeCloseTo(3200, 9);
  });

  it('width constraint analytical: outer = inner + width → R = inner + width/2', () => {
    const inner = 100;
    const width = 90;
    const outer = inner + width;
    expect(outer - inner).toBe(width);
    const R = (inner + outer) / 2; // 145
    const samples = helixSample(ORIGIN, inner, outer, 90, 'ccw', 4, 200);
    for (const s of samples) {
      expect(Math.hypot(s.x, s.y)).toBeCloseTo(R, 9);
    }
  });

  it('cw mirrors ccw across x-axis: x identical, y negated, z identical', () => {
    const ccw = helixSample(ORIGIN, 100, 200, 270, 'ccw', 12, 800);
    const cw = helixSample(ORIGIN, 100, 200, 270, 'cw', 12, 800);
    expect(cw).toHaveLength(ccw.length);
    for (let i = 0; i < ccw.length; i++) {
      expect(cw[i].x).toBeCloseTo(ccw[i].x, 9);
      expect(cw[i].y).toBeCloseTo(-ccw[i].y, 9);
      expect(cw[i].z).toBeCloseTo(ccw[i].z, 9);
    }
  });

  it('first sample at angle 0 → (centerPoint.x + R, centerPoint.y, centerPoint.z)', () => {
    const center: Point3D = { x: 10, y: 20, z: 5 };
    const inner = 100;
    const outer = 300;
    const R = 200;
    const samples = helixSample(center, inner, outer, 180, 'ccw', 6, 600);
    expect(samples[0].x).toBeCloseTo(center.x + R, 9);
    expect(samples[0].y).toBeCloseTo(center.y, 9);
    expect(samples[0].z).toBeCloseTo(center.z, 9);
  });

  it('last sample z = centerPoint.z + totalRise', () => {
    const center: Point3D = { x: 0, y: 0, z: 100 };
    const samples = helixSample(center, 100, 200, 270, 'ccw', 9, 1800);
    expect(samples[samples.length - 1].z).toBeCloseTo(100 + 1800, 9);
  });

  it('stepCount=1 → 2 points: start at angle 0, end at sign·sweepRad', () => {
    const samples = helixSample(ORIGIN, 100, 200, 90, 'ccw', 1, 50);
    expect(samples).toHaveLength(2);
    const R = 150;
    expect(samples[0].x).toBeCloseTo(R, 9);
    expect(samples[0].y).toBeCloseTo(0, 9);
    expect(samples[1].x).toBeCloseTo(0, 6);
    expect(samples[1].y).toBeCloseTo(R, 9);
    expect(samples[1].z).toBeCloseTo(50, 9);
  });

  it('innerRadius=0 degenerates to walkline at outerRadius/2 (still valid)', () => {
    const samples = helixSample(ORIGIN, 0, 200, 360, 'ccw', 8, 800);
    const R = 100;
    for (const s of samples) {
      expect(Math.hypot(s.x, s.y)).toBeCloseTo(R, 6);
    }
  });
});
