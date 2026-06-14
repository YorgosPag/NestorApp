/**
 * ADR-455 — vertical section-cut slider range (pure).
 */

import { computeAxisCutRange } from '../axis-cut-range';

describe('computeAxisCutRange', () => {
  it('builds min/max/default(midpoint) from a valid extent', () => {
    expect(computeAxisCutRange(0, 10)).toEqual({ min: 0, max: 10, default: 5 });
    expect(computeAxisCutRange(-4, 6)).toEqual({ min: -4, max: 6, default: 1 });
  });

  it('returns null for missing/degenerate/inverted extents', () => {
    expect(computeAxisCutRange(null, 10)).toBeNull();
    expect(computeAxisCutRange(0, undefined)).toBeNull();
    expect(computeAxisCutRange(5, 5)).toBeNull(); // zero width
    expect(computeAxisCutRange(10, 0)).toBeNull(); // inverted
    expect(computeAxisCutRange(Number.NaN, 1)).toBeNull();
  });
});
