/**
 * measureTextVerticalRatios — THE single source for a text run's VERTICAL box
 * metrics (ADR-557 Φ-attachment, built on ADR-530 glyph metrics). The horizontal
 * sibling is `text-advance.ts` (`measureTextAdvanceWorld`); this is its vertical
 * counterpart.
 *
 * WHY: the attachment-aware text box (`bim/text/text-box.ts`) sized its HEIGHT with
 * the nominal em (`text.height`), while the renderer paints the glyphs at cap height
 * (~0.7·em) seated on the baseline, with the baseline dropped by the FONT ascent
 * (~0.9·em) — so the box was ~0.19·em too tall on top and mis-seated (Giorgio
 * 2026-07-07: «μεγάλο κενό πάνω», measured: box top 93 units above the real cap top).
 *
 * This module returns the two quantities the box needs, both as height-INDEPENDENT
 * ratios of the nominal em height (they scale linearly with size, so one measure at a
 * reference size serves every height):
 *   - `fontAscent` / `fontDescent` — where the renderer seats the BASELINE (mirrors
 *     `TextRenderer.fillGlyphRun`'s `metrics.ascent`-based baseline placement).
 *   - `inkAscent` / `inkDescent` — the REAL glyph ink extent above / below the baseline
 *     (the drawn pixels: cap height for caps, +descenders for g/p/y) → the box top/bottom.
 *
 * Resolution mirrors the renderer's own paint path:
 *   1. A loaded opentype font (`resolveEntityFont`) — font metrics via `measureText`,
 *      ink via the glyph path's `getBoundingBox()` (EXACT parity with the drawn glyphs).
 *   2. No font (SSR / jest / font not yet loaded) — nominal ratios from the centralized
 *      `TEXT_METRICS_RATIOS` (ASCENT/DESCENT + CAP_HEIGHT), so pure callers stay finite.
 *
 * The flaky CSS tier is deliberately OMITTED: `ctx.measureText().actualBoundingBox*` is
 * unreliable/absent on many engines (see `canvas-v2/preview-canvas/overlay-label-layout.ts`
 * and the browser-measured `cssInkAscent = -17` on Giorgio's machine), so a non-opentype
 * font degrades straight to the nominal cap box rather than to garbage ink bounds.
 *
 * @module text-engine/fonts/text-vertical-metrics
 * @see rendering/entities/TextRenderer.ts — fillGlyphRun (the baseline anchor this mirrors)
 * @see text-engine/fonts/text-advance.ts — measureTextAdvanceWorld (the horizontal sibling)
 */

import { resolveEntityFont } from './font-resolver';
import { measureText } from './glyph-renderer';
import { GLYPH_REFERENCE_SIZE } from './glyph-path-cache';
import { TEXT_METRICS_RATIOS } from '../../config/text-rendering-config';

/** Font-resolution inputs for the vertical metrics (the X-scale `widthFactor` is irrelevant here). */
export interface TextVerticalStyle {
  readonly fontFamily?: string;
  readonly bold?: boolean;
  readonly italic?: boolean;
}

/** All four ratios are divided by the nominal em height, so they are size-independent. */
export interface TextVerticalRatios {
  /** Font ascent above the baseline ÷ em — where the renderer seats the baseline. */
  readonly fontAscent: number;
  /** Font descent below the baseline ÷ em. */
  readonly fontDescent: number;
  /** REAL glyph ink ascent above the baseline ÷ em — the box TOP. */
  readonly inkAscent: number;
  /** REAL glyph ink descent below the baseline ÷ em — the box BOTTOM. */
  readonly inkDescent: number;
}

/** No-font fallback: nominal font metrics + a cap-height ink box (all-caps default, zero descender). */
const NOMINAL: TextVerticalRatios = {
  fontAscent: TEXT_METRICS_RATIOS.ASCENT_RATIO,
  fontDescent: TEXT_METRICS_RATIOS.DESCENT_RATIO,
  inkAscent: TEXT_METRICS_RATIOS.CAP_HEIGHT_RATIO,
  inkDescent: 0,
};

/**
 * The vertical box ratios for `text`. Tier 1: a resolved opentype font → real font
 * metrics + glyph ink bounds. Tier 2: the nominal cap box. Never throws; always
 * returns a positive ink extent so the box geometry cannot degenerate.
 */
export function measureTextVerticalRatios(text: string, style?: TextVerticalStyle): TextVerticalRatios {
  if (!text) return NOMINAL;

  const family = style?.fontFamily || 'arial';
  const resolved = resolveEntityFont(family, { bold: style?.bold, italic: style?.italic });
  if (!resolved) return NOMINAL;

  const ref = GLYPH_REFERENCE_SIZE;
  const m = measureText(resolved.font, text, ref);
  const fontAscent = m.ascent / ref;
  const fontDescent = m.descent / ref;

  // Real glyph ink bounds — opentype path is y-DOWN with the baseline at y=0, so the
  // topmost point y1 ≤ 0 (ink above baseline) and the bottom y2 ≥ 0 (descenders).
  let inkAscent = NOMINAL.inkAscent;
  let inkDescent = NOMINAL.inkDescent;
  const path = resolved.font.getPath(text, 0, 0, ref);
  const bb = typeof path?.getBoundingBox === 'function' ? path.getBoundingBox() : null;
  if (bb && Number.isFinite(bb.y1) && Number.isFinite(bb.y2) && bb.y2 > bb.y1) {
    inkAscent = Math.max(0, -bb.y1) / ref;
    inkDescent = Math.max(0, bb.y2) / ref;
  }
  // Guard whitespace / empty-bbox glyphs so the box keeps a positive height.
  if (!(inkAscent + inkDescent > 0)) {
    inkAscent = NOMINAL.inkAscent;
    inkDescent = NOMINAL.inkDescent;
  }

  return { fontAscent, fontDescent, inkAscent, inkDescent };
}
