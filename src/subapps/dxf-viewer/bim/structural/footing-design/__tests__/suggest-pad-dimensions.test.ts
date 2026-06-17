/**
 * ADR-459 Phase 2 — suggest-pad-dimensions (sizing SSoT).
 */

import { suggestPadDimensions } from '../suggest-pad-dimensions';

describe('suggestPadDimensions', () => {
  it('falls back to geometric minimum (column + overhang) without load', () => {
    const d = suggestPadDimensions({ columnWidthMm: 400, columnDepthMm: 400 });
    // 400 + 2×150 = 700, rounded to module 50 → 700.
    expect(d).toEqual({ widthMm: 700, lengthMm: 700 });
  });

  it('follows a rectangular column geometrically', () => {
    const d = suggestPadDimensions({ columnWidthMm: 400, columnDepthMm: 600 });
    expect(d).toEqual({ widthMm: 700, lengthMm: 900 });
  });

  it('honours the absolute minimum side', () => {
    const d = suggestPadDimensions({ columnWidthMm: 200, columnDepthMm: 200 });
    // 200 + 300 = 500 < 600 floor → 600.
    expect(d).toEqual({ widthMm: 600, lengthMm: 600 });
  });

  it('sizes a square pad from bearing when load + σ_allow are known', () => {
    // N = 1000 kN, σ = 200 kPa → A = 5 m² → side = 2236 mm → round up 50 → 2250.
    const d = suggestPadDimensions({
      columnWidthMm: 400,
      columnDepthMm: 400,
      axialServiceKn: 1000,
      soilBearingCapacityKpa: 200,
    });
    expect(d).toEqual({ widthMm: 2250, lengthMm: 2250 });
  });

  it('ignores non-positive load / capacity (back to geometric)', () => {
    const d = suggestPadDimensions({
      columnWidthMm: 400,
      columnDepthMm: 400,
      axialServiceKn: 0,
      soilBearingCapacityKpa: 200,
    });
    expect(d).toEqual({ widthMm: 700, lengthMm: 700 });
  });
});
