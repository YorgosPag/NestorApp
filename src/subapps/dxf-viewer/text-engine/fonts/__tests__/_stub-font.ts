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

/** A minimal opentype.Font whose advance is `emPerChar` per glyph (proportional-linear). */
export function stubProportionalFont(emPerChar: number): Font {
  return {
    unitsPerEm: 1000,
    ascender: 800,
    descender: -200,
    getAdvanceWidth: (text: string, size: number): number => text.length * emPerChar * size,
    getPath: (): { commands: [] } => ({ commands: [] }),
  } as unknown as Font;
}

/**
 * Register a deterministic stub font under `family` (default 'arial', the resolver
 * default) with `emPerChar` advance (default 0.6 = the monospace ratio, so existing
 * geometry tests keep their widths) and guarantee a Path2D constructor for
 * `getGlyphRun`. Returns a cleanup fn for `afterAll`.
 */
export function installStubFont(emPerChar = 0.6, family = 'arial'): () => void {
  const hadPath2D = 'Path2D' in globalThis;
  if (!hadPath2D) (globalThis as { Path2D?: unknown }).Path2D = class {};
  fontCache.set(family, stubProportionalFont(emPerChar));
  __resetTextAdvanceMeasureCtx();
  return () => {
    fontCache.clear();
    __resetTextAdvanceMeasureCtx();
    if (!hadPath2D) delete (globalThis as { Path2D?: unknown }).Path2D;
  };
}
