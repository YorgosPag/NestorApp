/// <reference types="jest" />
/**
 * @file glyph-tracking.test.ts
 * @description AutoCAD MTEXT `\T` character tracking — the inter-glyph spacing factor must
 * scale the measured advance (and stay byte-identical at tracking=1), across the glyph-renderer
 * core, the glyph-path cache (tracking in the key), and the `measureTextAdvanceWorld` SSoT that
 * the renderer + the text box share (measure ≡ paint parity).
 *
 * Root cause fixed: `tracking` was written to `run.style.tracking` but NEVER consumed by any
 * measure/paint path, so «Διάκενο» changed nothing on canvas.
 */

import { measureText, stringToPath2D } from '../glyph-renderer';
import { getGlyphRun, clearGlyphPathCache } from '../glyph-path-cache';
import { measureTextAdvanceWorld } from '../text-advance';
import { stubProportionalFont, installStubFont } from './_stub-font';

const EM = 0.6; // stub advance ratio (per char, per em)
const font = stubProportionalFont(EM);

describe('character tracking (AutoCAD \\T spacing factor)', () => {
  beforeEach(() => clearGlyphPathCache());

  it('tracking=1 is byte-identical to font.getAdvanceWidth (kerned fast path)', () => {
    expect(measureText(font, 'ABCD', 100, 1).width).toBe(font.getAdvanceWidth('ABCD', 100));
    expect(measureText(font, 'ABCD', 100).width).toBe(font.getAdvanceWidth('ABCD', 100)); // default arg
  });

  it('tracking scales the advance monotonically (2× wider, 0.5× tighter)', () => {
    const base = measureText(font, 'ABCD', 100, 1).width; // 4 × 0.6 × 100 = 240
    expect(measureText(font, 'ABCD', 100, 2).width).toBeCloseTo(base * 2);
    expect(measureText(font, 'ABCD', 100, 0.5).width).toBeCloseTo(base * 0.5);
    expect(measureText(font, 'ABCD', 100, 1.5).width).toBeGreaterThan(base);
    expect(measureText(font, 'ABCD', 100, 0.8).width).toBeLessThan(base);
  });

  it('ascent/descent are unaffected by tracking (only horizontal spacing changes)', () => {
    const a = measureText(font, 'ABCD', 100, 1);
    const b = measureText(font, 'ABCD', 100, 2);
    expect(b.ascent).toBe(a.ascent);
    expect(b.descent).toBe(a.descent);
  });

  it('getGlyphRun keys on tracking — different factors are distinct cached runs', () => {
    const r1 = getGlyphRun(font, 'stub', 'ABCD', 1);
    const r2 = getGlyphRun(font, 'stub', 'ABCD', 2);
    expect(r1).not.toBe(r2);
    expect(r2.metrics.width).toBeCloseTo(r1.metrics.width * 2);
    // same key → same cached instance
    expect(getGlyphRun(font, 'stub', 'ABCD', 2)).toBe(r2);
  });

  it('stringToPath2D tracked path returns a Path2D (no throw) and advances per glyph', () => {
    // stub glyph paths are empty (commands: []), so this asserts the tracked layout runs.
    expect(() => stringToPath2D(font, 'ABCD', 0, 0, 100, 2)).not.toThrow();
    expect(() => stringToPath2D(font, 'ABCD', 0, 0, 100)).not.toThrow(); // default
  });

  describe('measureTextAdvanceWorld parity (measure ≡ paint SSoT)', () => {
    let cleanup: () => void;
    beforeEach(() => { cleanup = installStubFont(EM, 'arial'); clearGlyphPathCache(); });
    afterEach(() => cleanup());

    it('tracked world advance = 2× the untracked, via the shared getGlyphRun', () => {
      const h = 2.5;
      const base = measureTextAdvanceWorld('ABCD', h, { fontFamily: 'arial', tracking: 1 });
      const tracked = measureTextAdvanceWorld('ABCD', h, { fontFamily: 'arial', tracking: 2 });
      expect(tracked).toBeCloseTo(base * 2);
    });

    it('tracking combines with widthFactor (both horizontal, multiplicative)', () => {
      const h = 2.5;
      const plain = measureTextAdvanceWorld('ABCD', h, { fontFamily: 'arial' });
      const both = measureTextAdvanceWorld('ABCD', h, { fontFamily: 'arial', tracking: 2, widthFactor: 3 });
      expect(both).toBeCloseTo(plain * 2 * 3);
    });
  });
});
