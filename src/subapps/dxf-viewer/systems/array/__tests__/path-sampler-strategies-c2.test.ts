/**
 * ADR-353 C2 — Tests for EllipseStrategy and SplineStrategy.
 * Extracted from path-arc-length-sampler.test.ts for 500-line compliance.
 */

import { pathTotalLength, samplePath } from '../path-arc-length-sampler';
import type { EllipseEntity, SplineEntity } from '../../../types/entities';

const TWO_PI = Math.PI * 2;

// ── ELLIPSE strategy ──────────────────────────────────────────────────────────

function ellipse(cx: number, cy: number, a: number, b: number, rotation = 0, startParam = 0, endParam = TWO_PI): EllipseEntity {
  return { id: 'e', type: 'ellipse', name: 'e', center: { x: cx, y: cy }, majorAxis: a, minorAxis: b, rotation, startParam, endParam } as EllipseEntity;
}

describe('EllipseStrategy', () => {
  const fullCircle = ellipse(0, 0, 1, 1);

  it('full circle a=b=1: totalLength ≈ 2π (±0.1%)', () => {
    const len = pathTotalLength(fullCircle);
    expect(len).toBeCloseTo(TWO_PI, 3);
  });

  it('sample(0) → (1,0)', () => {
    const s = samplePath(fullCircle, 0)!;
    expect(s.position.x).toBeCloseTo(1);
    expect(s.position.y).toBeCloseTo(0);
  });

  it('sample(0.25) → (0,1) at quarter point', () => {
    const s = samplePath(fullCircle, 0.25)!;
    expect(s.position.x).toBeCloseTo(0, 1);
    expect(s.position.y).toBeCloseTo(1, 1);
  });

  it('sample(0.5) → (-1,0) at half point', () => {
    const s = samplePath(fullCircle, 0.5)!;
    expect(s.position.x).toBeCloseTo(-1, 1);
    expect(s.position.y).toBeCloseTo(0, 1);
  });

  it('sample(0) tangent ≈ 90° (CCW circle at (1,0))', () => {
    const s = samplePath(fullCircle, 0)!;
    expect(s.tangentDeg).toBeCloseTo(90, 0);
  });

  it('reversed: sample(0) → near (1,0) with tangent ≈ -90°', () => {
    const s = samplePath(fullCircle, 0, true)!;
    expect(s.position.x).toBeCloseTo(1, 1);
    expect(s.position.y).toBeCloseTo(0, 1);
    expect(s.tangentDeg).toBeCloseTo(-90, 0);
  });

  it('partial ellipse (half arc): totalLength ≈ π', () => {
    const half = ellipse(0, 0, 1, 1, 0, 0, Math.PI);
    expect(pathTotalLength(half)).toBeCloseTo(Math.PI, 2);
  });

  it('ellipse a=2, b=1: totalLength > 2π (longer than unit circle)', () => {
    const stretched = ellipse(0, 0, 2, 1);
    expect(pathTotalLength(stretched)).toBeGreaterThan(TWO_PI);
  });

  it('degenerate a=0, b=0: totalLength=0, sample returns center', () => {
    const degen = ellipse(3, 4, 0, 0);
    expect(pathTotalLength(degen)).toBeCloseTo(0);
    const s = samplePath(degen, 0.5)!;
    expect(s.position.x).toBeCloseTo(3);
    expect(s.position.y).toBeCloseTo(4);
  });

  it('u < 0 clamped', () => {
    const s = samplePath(fullCircle, -1)!;
    expect(s.position.x).toBeCloseTo(1, 1);
  });

  it('u > 1 clamped', () => {
    const s0 = samplePath(fullCircle, 0)!;
    const s1 = samplePath(fullCircle, 2)!;
    expect(s1.position.x).toBeCloseTo(s0.position.x, 1);
    expect(s1.position.y).toBeCloseTo(s0.position.y, 1);
  });
});

// ── SPLINE strategy ───────────────────────────────────────────────────────────

function spline(pts: [number, number][], closed = false): SplineEntity {
  return { id: 's', type: 'spline', name: 's', controlPoints: pts.map(([x, y]) => ({ x, y })), closed } as SplineEntity;
}

describe('SplineStrategy', () => {
  it('2 control points: totalLength ≈ linear distance', () => {
    const s = spline([[0, 0], [10, 0]]);
    expect(pathTotalLength(s)).toBeCloseTo(10, 1);
  });

  it('4 collinear points: totalLength ≈ total span', () => {
    const s = spline([[0, 0], [10, 0], [20, 0], [30, 0]]);
    expect(pathTotalLength(s)).toBeCloseTo(30, 1);
  });

  it('sample(0.5): midpoint of 2-point spline', () => {
    const s = spline([[0, 0], [10, 0]]);
    const result = samplePath(s, 0.5)!;
    expect(result.position.x).toBeCloseTo(5, 1);
    expect(result.position.y).toBeCloseTo(0, 1);
  });

  it('sample(0) → near start', () => {
    const s = spline([[0, 0], [10, 0]]);
    const result = samplePath(s, 0)!;
    expect(result.position.x).toBeCloseTo(0, 1);
  });

  it('sample(1) → near end', () => {
    const s = spline([[0, 0], [10, 0]]);
    const result = samplePath(s, 1)!;
    expect(result.position.x).toBeCloseTo(10, 1);
  });

  it('reversed: tangent flips (±180° both valid)', () => {
    const s = spline([[0, 0], [10, 0]]);
    const fwd = samplePath(s, 0.5, false)!;
    const rev = samplePath(s, 0.5, true)!;
    expect(fwd.tangentDeg).toBeCloseTo(0, 0);
    expect(Math.abs(rev.tangentDeg)).toBeCloseTo(180, 0);
  });

  it('empty controlPoints: totalLength=0, sample returns origin', () => {
    const s = spline([]);
    expect(pathTotalLength(s)).toBe(0);
    const result = samplePath(s, 0.5)!;
    expect(result.position.x).toBe(0);
    expect(result.position.y).toBe(0);
  });

  it('single control point: sample returns that point', () => {
    const s = spline([[5, 7]]);
    const result = samplePath(s, 0.5)!;
    expect(result.position.x).toBeCloseTo(5);
    expect(result.position.y).toBeCloseTo(7);
  });
});
