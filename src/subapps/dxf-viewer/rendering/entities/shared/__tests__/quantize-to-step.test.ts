/**
 * Unit tests for the `quantizeToStep` scalar-quantization SSoT (ADR-572 §8 WI-2) and the
 * `projectPointOnLine` ↔ `getNearestPointOnLine` equivalence (WI-5).
 */

import { quantizeToStep, getNearestPointOnLine } from '../geometry-utils';
import { CoordinateUtils } from '../../../../systems/constraints/constraints-geometry';

describe('quantizeToStep — hard round to nearest multiple of step', () => {
  it('rounds to the nearest multiple (no tolerance gate)', () => {
    expect(quantizeToStep(47, 15)).toBe(45);
    expect(quantizeToStep(52, 15)).toBe(45); // 52/15 = 3.47 → 3
    expect(quantizeToStep(53, 15)).toBe(60); // 53/15 = 3.53 → 4
    expect(quantizeToStep(7, 5)).toBe(5);
    expect(quantizeToStep(8, 5)).toBe(10);
  });

  it('does NOT normalize — negative values stay negative (caller owns range policy)', () => {
    expect(quantizeToStep(-30, 15)).toBe(-30);
    expect(quantizeToStep(-37, 15)).toBe(-30); // -37/15 = -2.47 → -2 → -30
  });

  it('is a no-op when step ≤ 0 (returns value verbatim, never NaN)', () => {
    expect(quantizeToStep(123, 0)).toBe(123);
    expect(quantizeToStep(123, -5)).toBe(123);
  });

  it('is a no-op for non-finite input', () => {
    expect(quantizeToStep(Number.NaN, 15)).toBeNaN();
    expect(quantizeToStep(Number.POSITIVE_INFINITY, 15)).toBe(Number.POSITIVE_INFINITY);
  });

  it('is exact on multiples', () => {
    expect(quantizeToStep(45, 15)).toBe(45);
    expect(quantizeToStep(90, 15)).toBe(90);
    expect(quantizeToStep(0, 15)).toBe(0);
  });
});

describe('projectPointOnLine ≡ getNearestPointOnLine(..., clampToSegment=false)', () => {
  const cases: Array<[{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }]> = [
    [{ x: 5, y: 5 }, { x: 0, y: 0 }, { x: 10, y: 0 }],   // above a horizontal segment
    [{ x: -3, y: 4 }, { x: 0, y: 0 }, { x: 10, y: 0 }],  // beyond the start (extension)
    [{ x: 13, y: -2 }, { x: 0, y: 0 }, { x: 10, y: 0 }], // beyond the end (extension)
    [{ x: 2, y: 9 }, { x: 1, y: 1 }, { x: 4, y: 5 }],    // oblique line
  ];

  it.each(cases)('matches for point %o on line %o→%o', (p, a, b) => {
    const viaAlias = CoordinateUtils.projectPointOnLine(p, a, b);
    const viaSsot = getNearestPointOnLine(p, a, b, false);
    expect(viaAlias.x).toBeCloseTo(viaSsot.x, 9);
    expect(viaAlias.y).toBeCloseTo(viaSsot.y, 9);
  });

  it('returns a fresh point on a degenerate (zero-length) line', () => {
    const start = { x: 4, y: 7 };
    const out = CoordinateUtils.projectPointOnLine({ x: 1, y: 1 }, start, { x: 4, y: 7 });
    expect(out).toEqual(start);
    expect(out).not.toBe(start); // copy, not the same reference (no aliasing)
  });
});
