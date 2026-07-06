/**
 * ADR-557 Φ-attachment — metrics-accurate text advance SSoT tests.
 *
 * Proves `measureTextAdvanceWorld` returns the REAL glyph advance when a font is
 * loaded (tier 1) — the whole point of the fix (box === drawn glyphs) — and degrades
 * to the deterministic monospace approximation with no font + no DOM canvas (tier 3,
 * the SSR / font-not-yet-loaded path).
 *
 * NOTE: the jest jsdom env has a live canvas, so tier 2 (`ctx.measureText`) would
 * otherwise return machine-dependent metrics. Tier-1 tests pin a stub font; the
 * tier-3 test forces `getContext` to null so the monospace fallback is exercised.
 */

import { measureTextAdvanceWorld, __resetTextAdvanceMeasureCtx } from '../text-advance';
import { installStubFont } from './_stub-font';

const MONOSPACE = 0.6; // TEXT_METRICS_RATIOS.CHAR_WIDTH_MONOSPACE

describe('measureTextAdvanceWorld — tier 3 monospace fallback (no font, no DOM canvas)', () => {
  let getContextSpy: jest.SpyInstance;
  beforeAll(() => {
    // No font registered ⇒ resolver misses ⇒ tier 2; force its canvas to null ⇒ tier 3.
    getContextSpy = jest
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(null);
    __resetTextAdvanceMeasureCtx();
  });
  afterAll(() => {
    getContextSpy.mockRestore();
    __resetTextAdvanceMeasureCtx();
  });

  it('natural width = len · height · 0.6', () => {
    expect(measureTextAdvanceWorld('ABC', 10)).toBeCloseTo(3 * 10 * MONOSPACE, 9); // 18
  });

  it('applies the AutoCAD X-scale (widthFactor)', () => {
    expect(measureTextAdvanceWorld('ABC', 10, { widthFactor: 2 })).toBeCloseTo(36, 9);
  });

  it('empty / missing text → a minimum 1-char box (never collapses to 0)', () => {
    expect(measureTextAdvanceWorld('', 10)).toBeCloseTo(6, 9);
  });
});

describe('measureTextAdvanceWorld — tier 1 real glyph metrics (font loaded)', () => {
  const NAME = 'stub-metric-font';
  let cleanup: () => void;

  beforeAll(() => {
    // 0.5 em/char — distinguishable from the 0.6 monospace approximation.
    cleanup = installStubFont(0.5, NAME);
  });
  afterAll(() => cleanup());

  it('uses the font advance (0.5 em/char), NOT the 0.6 monospace approx', () => {
    // 4 chars · 0.5 em · height 20 = 40 world (monospace would give 4·0.6·20 = 48).
    expect(measureTextAdvanceWorld('WXYZ', 20, { fontFamily: NAME })).toBeCloseTo(40, 6);
  });

  it('scales linearly with height and widthFactor', () => {
    expect(measureTextAdvanceWorld('WXYZ', 20, { fontFamily: NAME, widthFactor: 1.5 })).toBeCloseTo(60, 6);
  });
});
