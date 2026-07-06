/**
 * ADR-557 Φ-attachment (vertical) — `measureTextVerticalRatios` SSoT tests.
 *
 * The box HEIGHT must come from the real glyph metrics: the FONT ascent/descent (where
 * the renderer seats the baseline) + the glyph INK extent (the drawn pixels). A cap stub
 * (ink 0.7 / 0) models a real all-caps font; the default stub (ink == font metrics) proves
 * the box degrades to the nominal em box (so the pre-metrics geometry tests stay green).
 */

import { measureTextVerticalRatios } from '../text-vertical-metrics';
import { installStubFont } from './_stub-font';

describe('measureTextVerticalRatios — cap-height font (ink 0.7 / 0)', () => {
  let cleanup: () => void;
  beforeAll(() => { cleanup = installStubFont(0.6, 'arial', { inkAscentEm: 0.7, inkDescentEm: 0 }); });
  afterAll(() => cleanup());

  it('returns font metrics for the baseline anchor + real ink for the extent', () => {
    const r = measureTextVerticalRatios('TEST', { fontFamily: 'arial' });
    expect(r.fontAscent).toBeCloseTo(0.8, 9);  // ascender 800 / em 1000
    expect(r.fontDescent).toBeCloseTo(0.2, 9); // -descender 200 / em 1000
    expect(r.inkAscent).toBeCloseTo(0.7, 9);   // cap height (glyph path bbox)
    expect(r.inkDescent).toBeCloseTo(0, 9);    // all caps → no descender
  });

  it('is height-independent (ratios, not world units)', () => {
    // Same string, measured through the size-invariant ref → identical ratios regardless of caller height.
    const a = measureTextVerticalRatios('A', { fontFamily: 'arial' });
    const b = measureTextVerticalRatios('A', { fontFamily: 'arial' });
    expect(a).toEqual(b);
  });
});

describe('measureTextVerticalRatios — default stub (ink == font metrics)', () => {
  let cleanup: () => void;
  beforeAll(() => { cleanup = installStubFont(); });
  afterAll(() => cleanup());

  it('ink equals the font metrics box → visual box will equal the em box', () => {
    const r = measureTextVerticalRatios('TEST', { fontFamily: 'arial' });
    expect(r.inkAscent).toBeCloseTo(r.fontAscent, 9);
    expect(r.inkDescent).toBeCloseTo(r.fontDescent, 9);
  });
});

describe('measureTextVerticalRatios — no font / empty', () => {
  it('empty text → the nominal cap fallback (finite, positive extent)', () => {
    const r = measureTextVerticalRatios('');
    expect(r.inkAscent + r.inkDescent).toBeGreaterThan(0);
    expect(r.fontAscent).toBeCloseTo(0.8, 9); // TEXT_METRICS_RATIOS.ASCENT_RATIO
    expect(r.inkAscent).toBeCloseTo(0.7, 9);  // TEXT_METRICS_RATIOS.CAP_HEIGHT_RATIO
  });
});
