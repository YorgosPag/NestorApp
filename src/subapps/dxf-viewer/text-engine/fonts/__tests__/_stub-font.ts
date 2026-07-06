/**
 * Test fixture (NOT a suite — no `.test.` suffix, so jest's testMatch skips it):
 * deterministic opentype.Font stubs so the metrics-accurate text-advance SSoT is
 * environment-independent in unit tests.
 *
 * The jest jsdom env has a live canvas backend, so the tier-2 CSS `measureText`
 * fallback returns REAL (machine-dependent) font metrics — non-deterministic across
 * OSes/CI. Registering a stub font forces tier 1 (opentype metrics) with a KNOWN
 * advance ratio, so geometry tests keep their hand-computed widths.
 *
 * @module text-engine/fonts/__tests__/_stub-font
 */

import type { Font } from 'opentype.js';
import { fontCache } from '../font-cache';
import { __resetTextAdvanceMeasureCtx } from '../text-advance';

/** Ink-bounds override (em ratios) for the stub glyph path — see `stubProportionalFont`. */
export interface StubInkBounds {
  /** Glyph ink ascent above baseline ÷ em. Default = the font ascent (0.8) → ink == metrics. */
  inkAscentEm?: number;
  /** Glyph ink descent below baseline ÷ em. Default = the font descent (0.2) → ink == metrics. */
  inkDescentEm?: number;
  /** Glyph ink LEFT edge from the pen origin ÷ em (leading side bearing). Default 0 → no inset. */
  inkLeftEm?: number;
  /** Glyph ink RIGHT edge from the pen origin ÷ em. Default = the full advance → no inset. */
  inkRightEm?: number;
}

/**
 * A minimal opentype.Font whose advance is `emPerChar` per glyph (proportional-linear).
 *
 * `getPath(...).getBoundingBox()` returns the glyph INK box (opentype y-DOWN, baseline at 0)
 * so `measureTextGlyphInk` is deterministic. DEFAULT ink = the font metrics box vertically
 * (ascent 0.8 / descent 0.2) + the FULL advance horizontally (x1=0, x2=advance), so the
 * VISUAL text box equals the NOMINAL em box and the pre-metrics geometry tests stay unchanged.
 * Pass `ink` (cap 0.7 / descent 0, or `inkLeftEm`/`inkRightEm` side bearings) to model a real
 * font for the glyph-ink tests.
 */
export function stubProportionalFont(emPerChar: number, ink?: StubInkBounds): Font {
  const inkAscentEm = ink?.inkAscentEm ?? 0.8; // = ascender / unitsPerEm
  const inkDescentEm = ink?.inkDescentEm ?? 0.2; // = -descender / unitsPerEm
  return {
    unitsPerEm: 1000,
    ascender: 800,
    descender: -200,
    getAdvanceWidth: (text: string, size: number): number => text.length * emPerChar * size,
    getPath: (text: string, _x: number, _y: number, size: number) => {
      const advance = (text?.length ?? 0) * emPerChar * size;
      return {
        commands: [] as [],
        // y-DOWN: top (ink ascent) is negative, bottom (ink descent) is positive.
        getBoundingBox: () => ({
          x1: ink?.inkLeftEm != null ? ink.inkLeftEm * size : 0,
          y1: -inkAscentEm * size,
          x2: ink?.inkRightEm != null ? ink.inkRightEm * size : advance,
          y2: inkDescentEm * size,
        }),
      };
    },
  } as unknown as Font;
}

/**
 * Register a deterministic stub font under `family` (default 'arial', the resolver
 * default) with `emPerChar` advance (default 0.6 = the monospace ratio, so existing
 * geometry tests keep their widths) and guarantee a Path2D constructor for
 * `getGlyphRun`. Returns a cleanup fn for `afterAll`.
 */
export function installStubFont(emPerChar = 0.6, family = 'arial', ink?: StubInkBounds): () => void {
  const hadPath2D = 'Path2D' in globalThis;
  if (!hadPath2D) (globalThis as { Path2D?: unknown }).Path2D = class {};
  fontCache.set(family, stubProportionalFont(emPerChar, ink));
  __resetTextAdvanceMeasureCtx();
  return () => {
    fontCache.clear();
    __resetTextAdvanceMeasureCtx();
    if (!hadPath2D) delete (globalThis as { Path2D?: unknown }).Path2D;
  };
}
