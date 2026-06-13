/**
 * ADR-452 — computeCutPlaneRange (pure, FFL-relative to the active storey).
 */

import { computeCutPlaneRange } from '../cut-plane-range';

describe('computeCutPlaneRange', () => {
  it('returns null when no storey height is known', () => {
    expect(computeCutPlaneRange(null)).toBeNull();
    expect(computeCutPlaneRange(undefined)).toBeNull();
    expect(computeCutPlaneRange(0)).toBeNull();
    expect(computeCutPlaneRange(-100)).toBeNull();
  });

  it('spans 0 .. storeyHeight, default = ceiling', () => {
    const r = computeCutPlaneRange(3000);
    expect(r).toEqual({ minMm: 0, maxMm: 3000, defaultMm: 3000 });
  });

  it('works for a taller storey', () => {
    expect(computeCutPlaneRange(3500)).toEqual({ minMm: 0, maxMm: 3500, defaultMm: 3500 });
  });
});
