/**
 * ADR-357 ambient extension — `adaptive-distance-snap` tests.
 *
 * Coverage:
 *   - adaptiveDistanceStep: nice 1/2/5/10 sequence, scales with zoom, 0 guards.
 *   - quantizeAlongPath: rounds distance-from-anchor to step, preserves sign,
 *     no-op on non-positive step.
 */

import { adaptiveDistanceStep, quantizeAlongPath, quantizePointFromAnchor } from '../adaptive-distance-snap';

describe('adaptiveDistanceStep', () => {
  it('returns a nice 1/2/5/10 × 10^k value', () => {
    // worldPerPixel * 25 → niceRound. 4 * 25 = 100 → 100.
    expect(adaptiveDistanceStep(4)).toBe(100);
    // 0.4 * 25 = 10 → 10.
    expect(adaptiveDistanceStep(0.4)).toBe(10);
    // 2 * 25 = 50 → 50.
    expect(adaptiveDistanceStep(2)).toBe(50);
    // 0.08 * 25 = 2 → 2.
    expect(adaptiveDistanceStep(0.08)).toBe(2);
  });

  it('grows when zoomed out, shrinks when zoomed in', () => {
    const zoomedOut = adaptiveDistanceStep(8);   // coarse
    const zoomedIn = adaptiveDistanceStep(0.05); // fine
    expect(zoomedOut).toBeGreaterThan(zoomedIn);
  });

  it('returns 0 for non-positive / non-finite input', () => {
    expect(adaptiveDistanceStep(0)).toBe(0);
    expect(adaptiveDistanceStep(-1)).toBe(0);
    expect(adaptiveDistanceStep(NaN)).toBe(0);
  });
});

describe('quantizeAlongPath', () => {
  const anchor = { x: 0, y: 0 };

  it('rounds the distance along a horizontal ray to the step', () => {
    // point at x=2326.7 on +X ray, step 100 → 2300.
    const q = quantizeAlongPath({ x: 2326.7, y: 0 }, anchor, 1, 0, 100);
    expect(q.x).toBeCloseTo(2300);
    expect(q.y).toBeCloseTo(0);
  });

  it('rounds up when nearer the next stop', () => {
    const q = quantizeAlongPath({ x: 2384.1, y: 0 }, anchor, 1, 0, 100);
    expect(q.x).toBeCloseTo(2400);
  });

  it('preserves sign on the negative side of the anchor', () => {
    const q = quantizeAlongPath({ x: -847.3, y: 0 }, anchor, 1, 0, 50);
    expect(q.x).toBeCloseTo(-850);
  });

  it('works on a vertical ray', () => {
    const q = quantizeAlongPath({ x: 0, y: 1240 }, anchor, 0, 1, 100);
    expect(q.y).toBeCloseTo(1200);
  });

  it('is a no-op when step is not positive', () => {
    const p = { x: 123.4, y: 0 };
    expect(quantizeAlongPath(p, anchor, 1, 0, 0)).toEqual(p);
  });
});

describe('quantizePointFromAnchor — derive dir from anchor→point, then quantize length', () => {
  const anchor = { x: 0, y: 0 };

  it('quantizes the LENGTH along an angled ray, preserving the direction (3-4-5)', () => {
    // (0.6, 0.8) dir, length 55 → nearest 25-multiple = 50 → (30, 40).
    const q = quantizePointFromAnchor({ x: 33, y: 44 }, anchor, 25);
    expect(q.x).toBeCloseTo(30);
    expect(q.y).toBeCloseTo(40);
  });

  it('measures the length from a non-zero anchor', () => {
    const q = quantizePointFromAnchor({ x: 1033, y: 2044 }, { x: 1000, y: 2000 }, 25);
    expect(q.x).toBeCloseTo(1030);
    expect(q.y).toBeCloseTo(2040);
  });

  it('is a no-op on non-positive step and on a degenerate (point == anchor) input', () => {
    const p = { x: 33, y: 44 };
    expect(quantizePointFromAnchor(p, anchor, 0)).toEqual(p);
    expect(quantizePointFromAnchor({ x: 5, y: 5 }, { x: 5, y: 5 }, 25)).toEqual({ x: 5, y: 5 });
  });
});
