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
import { installStubFont } from './_stub-font';

describe('measureTextGlyphInk — cap-height font with side bearings', () => {
  let cleanup: () => void;
  // 'TEST' advance = 4·0.6 = 2.4·em; ink x∈[0.2, 2.2]·em → 0.2 bearing each side.
  beforeAll(() => {
    cleanup = installStubFont(0.6, 'arial', { inkAscentEm: 0.7, inkDescentEm: 0, inkLeftEm: 0.2, inkRightEm: 2.2 });
  });
  afterAll(() => cleanup());

  it('font metrics for the baseline anchor + real ink extent (vertical)', () => {
    const r = measureTextGlyphInk('TEST', { fontFamily: 'arial' });
    expect(r.fontAscent).toBeCloseTo(0.8, 9);
    expect(r.fontDescent).toBeCloseTo(0.2, 9);
    expect(r.inkAscent).toBeCloseTo(0.7, 9);
    expect(r.inkDescent).toBeCloseTo(0, 9);
  });

  it('pen advance + ink left/right edges (horizontal side bearings)', () => {
    const r = measureTextGlyphInk('TEST', { fontFamily: 'arial' });
    expect(r.advance).toBeCloseTo(2.4, 9);   // 4 chars × 0.6
    expect(r.inkLeft).toBeCloseTo(0.2, 9);   // leading bearing
    expect(r.inkRight).toBeCloseTo(2.2, 9);  // → trailing bearing 0.2
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
