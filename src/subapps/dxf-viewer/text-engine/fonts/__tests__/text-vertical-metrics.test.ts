/**
 * ADR-557 Φ-attachment — `measureTextGlyphInk` SSoT tests (the glyph ink box, both axes).
 *
 * The box must come from the real glyph metrics: FONT ascent/descent (baseline anchor) +
 * glyph INK extent (drawn pixels) vertically, and the ink LEFT/RIGHT vs the pen advance
 * (side bearings) horizontally. A cap stub (ink 0.7 / 0 + side bearings) models a real font;
 * the default stub (ink == metrics, ink spans the full advance) proves the box degrades to
 * the nominal advance/em box (so the pre-metrics geometry tests stay green).
 */

import { measureTextGlyphInk } from '../text-vertical-metrics';
import { emSizeForTextHeight } from '../text-height-scale';
import { fontCache } from '../font-cache';
import { installStubFont } from './_stub-font';

describe('measureTextGlyphInk — cap-height font with side bearings', () => {
  let cleanup: () => void;
  // 'TEST' advance = 4·0.6 = 2.4·em; ink x∈[0.2, 2.2]·em → 0.2 bearing each side.
  beforeAll(() => {
    cleanup = installStubFont(0.6, 'arial', { inkAscentEm: 0.7, inkDescentEm: 0, inkLeftEm: 0.2, inkRightEm: 2.2 });
  });
  afterAll(() => cleanup());

  // ADR-635 Φ C.22 — the returned fields are ratios of the DXF TEXT HEIGHT, while the stub's
  // metrics above are stated in EM. The two differ by the cap-height rule (stub: 800/1000 ⇒ ×1.25).
  // Derived from the SSoT so the expectations track the rule instead of freezing a number.
  const perHeight = (em: number): number =>
    em * emSizeForTextHeight(1, { font: fontCache.get('arial')!, cacheName: 'arial' });

  it('font metrics for the baseline anchor + real ink extent (vertical)', () => {
    const r = measureTextGlyphInk('TEST', { fontFamily: 'arial' });
    expect(r.fontAscent).toBeCloseTo(perHeight(0.8), 9);
    expect(r.fontDescent).toBeCloseTo(perHeight(0.2), 9);
    expect(r.inkAscent).toBeCloseTo(perHeight(0.7), 9);
    expect(r.inkDescent).toBeCloseTo(0, 9);
  });

  it('pen advance + ink left/right edges (horizontal side bearings)', () => {
    const r = measureTextGlyphInk('TEST', { fontFamily: 'arial' });
    expect(r.advance).toBeCloseTo(perHeight(2.4), 9);   // 4 chars × 0.6 em
    expect(r.inkLeft).toBeCloseTo(perHeight(0.2), 9);   // leading bearing
    expect(r.inkRight).toBeCloseTo(perHeight(2.2), 9);  // → trailing bearing 0.2 em
  });

  it('the box grows with the cap-height rule — it must NOT stay on the em box', () => {
    // Guards the Φ C.21 invariant: if a call site forgot the conversion the box would hug the
    // ~40% smaller old glyphs while the renderer painted the new ones (hover/grips off).
    expect(measureTextGlyphInk('TEST', { fontFamily: 'arial' }).advance).toBeGreaterThan(2.4);
  });
});

describe('measureTextGlyphInk — default stub (ink == metrics, ink spans full advance)', () => {
  let cleanup: () => void;
  beforeAll(() => { cleanup = installStubFont(); });
  afterAll(() => cleanup());

  it('ink equals the metrics box vert + the full advance horiz → visual box == em/advance box', () => {
    const r = measureTextGlyphInk('TEST', { fontFamily: 'arial' });
    expect(r.inkAscent).toBeCloseTo(r.fontAscent, 9);
    expect(r.inkDescent).toBeCloseTo(r.fontDescent, 9);
    expect(r.inkLeft).toBeCloseTo(0, 9);
    expect(r.inkRight).toBeCloseTo(r.advance, 9); // zero side bearing
  });
});

describe('measureTextGlyphInk — no font / empty', () => {
  it('empty text → nominal cap fallback, advance 0 (⇒ zero horizontal inset)', () => {
    const r = measureTextGlyphInk('');
    expect(r.inkAscent + r.inkDescent).toBeGreaterThan(0);
    expect(r.fontAscent).toBeCloseTo(0.8, 9); // ASCENT_RATIO
    expect(r.inkAscent).toBeCloseTo(0.7, 9);  // CAP_HEIGHT_RATIO
    expect(r.advance).toBeCloseTo(0, 9);      // → consumers apply no horizontal inset
  });
});
