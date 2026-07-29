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
import { emSizeForTextHeight } from '../text-height-scale';
import { fontCache } from '../font-cache';
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

  // ADR-635 Φ C.22 — the advance is per EM, and the em that renders a text height is
  // `height / capHeightRatio` (stub: sCapHeight 800 / em 1000 ⇒ ×1.25). Derived from the SSoT,
  // never hard-coded: if the rule changes, this expectation follows it instead of going red.
  const emOf = (height: number): number => emSizeForTextHeight(height, { font: fontCache.get(NAME)!, cacheName: NAME });

  it('uses the font advance (0.5 em/char), NOT the 0.6 monospace approx', () => {
    // 4 chars · 0.5 em · em(20) = 50 world (monospace would give 4·0.6·20 = 48).
    expect(measureTextAdvanceWorld('WXYZ', 20, { fontFamily: NAME })).toBeCloseTo(4 * 0.5 * emOf(20), 6);
  });

  it('applies the cap-height rule — the em is LARGER than the DXF text height', () => {
    expect(emOf(20)).toBeCloseTo(25, 9); // 20 / (800/1000)
  });

  it('scales linearly with height and widthFactor', () => {
    expect(measureTextAdvanceWorld('WXYZ', 20, { fontFamily: NAME, widthFactor: 1.5 }))
      .toBeCloseTo(4 * 0.5 * emOf(20) * 1.5, 6);
  });
});
