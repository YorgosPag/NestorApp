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

  it('tolerant-ceil: sub-ULP float dust δεν προκαλεί 50mm oversize (1300 όχι 1350)', () => {
    // Regression: το `effectiveFaces` un-rotate παράγει dust (1000.0000000000146).
    // +2×150 overhang = 1300.0000000000146· naive Math.ceil → 1350. Πρέπει → 1300.
    const dust = 1000.0000000000146;
    const d = suggestPadDimensions({ columnWidthMm: dust, columnDepthMm: dust });
    expect(d).toEqual({ widthMm: 1300, lengthMm: 1300 });
  });

  it('μια ΠΡΑΓΜΑΤΙΚΗ τιμή ελάχιστα πάνω από module ΑΝΕΒΑΙΝΕΙ κανονικά (όχι false-snap)', () => {
    // Guard: το epsilon δεν «τρώει» πραγματικές διαστάσεις. 1000.5 + 300 = 1300.5 → 1350.
    const d = suggestPadDimensions({ columnWidthMm: 1000.5, columnDepthMm: 1000.5 });
    expect(d).toEqual({ widthMm: 1350, lengthMm: 1350 });
  });
});
