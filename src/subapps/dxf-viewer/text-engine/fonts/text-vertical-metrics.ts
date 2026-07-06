/**
 * measureTextGlyphInk — THE single source for a text run's GLYPH INK BOX (both axes)
 * in em-ratio units (ADR-557 Φ-attachment, built on ADR-530 glyph metrics). Companion of
 * `text-advance.ts` (`measureTextAdvanceWorld`, the pen advance); this adds the real ink
 * bounds so the VISUAL text box hugs the DRAWN glyphs on all four sides.
 *
 * WHY: the box sized its HEIGHT with the nominal em and its WIDTH with the pen advance,
 * while the renderer paints the glyphs at cap height on the baseline, inset from the pen
 * origin by the side bearings. So the box was too tall on top (Giorgio 2026-07-07:
 * «μεγάλο κενό πάνω», measured 93 units) AND wider than the letters left+right (Greek
 * caps «ΠΑΠΑΠ»: box «επεκτείνεται προς τα έξω» δεξιά/αριστερά).
 *
 * All fields are height-INDEPENDENT ratios of the nominal em height (they scale linearly
 * with size, so one measure at a reference size serves every height + X-scale):
 *   - `fontAscent` / `fontDescent` — where the renderer seats the BASELINE (mirrors
 *     `TextRenderer.fillGlyphRun`'s `metrics.ascent`-based baseline placement).
 *   - `inkAscent` / `inkDescent` — the glyph INK above / below the baseline (box top/bottom).
 *   - `inkLeft` / `inkRight` — the glyph INK left / right edge from the pen origin (x=0),
 *     i.e. the leading side bearing and the ink's right edge; `advance` is the pen advance.
 *     The box's horizontal insets are `inkLeft` (left) and `advance − inkRight` (right).
 *
 * Resolution:
 *   1. A loaded opentype font (`resolveEntityFont`) — font metrics via `measureText`,
 *      ink via the glyph path's `getBoundingBox()` (EXACT parity with the drawn glyphs).
 *   2. No font (SSR / jest / font not yet loaded) — nominal ratios from the centralized
 *      `TEXT_METRICS_RATIOS` (ASCENT/DESCENT + CAP_HEIGHT); `advance = 0` so consumers
 *      derive ZERO horizontal insets (the box keeps the monospace advance width).
 *
 * The flaky CSS tier is deliberately OMITTED: `ctx.measureText().actualBoundingBox*` is
 * unreliable/absent on many engines (see `canvas-v2/preview-canvas/overlay-label-layout.ts`
 * and the browser-measured `cssInkAscent = -17` on Giorgio's machine), so a non-opentype
 * font degrades straight to the nominal box rather than to garbage ink bounds.
 *
 * @module text-engine/fonts/text-vertical-metrics
 * @see rendering/entities/TextRenderer.ts — fillGlyphRun (the baseline anchor this mirrors)
 * @see text-engine/fonts/text-advance.ts — measureTextAdvanceWorld (the pen-advance sibling)
 */

import { resolveEntityFont } from './font-resolver';
import { measureText } from './glyph-renderer';
import { GLYPH_REFERENCE_SIZE } from './glyph-path-cache';
import { TEXT_METRICS_RATIOS } from '../../config/text-rendering-config';

/** Font-resolution inputs (the X-scale `widthFactor` is applied by the consumer, not here). */
export interface TextGlyphInkStyle {
  readonly fontFamily?: string;
  readonly bold?: boolean;
  readonly italic?: boolean;
}

/** All fields are ÷ the nominal em height, so they are size- and X-scale-independent. */
export interface TextGlyphInk {
  /** Font ascent above the baseline ÷ em — where the renderer seats the baseline. */
  readonly fontAscent: number;
  /** Font descent below the baseline ÷ em. */
  readonly fontDescent: number;
  /** Glyph ink ascent above the baseline ÷ em — box TOP. */
  readonly inkAscent: number;
  /** Glyph ink descent below the baseline ÷ em — box BOTTOM. */
  readonly inkDescent: number;
  /** Glyph ink LEFT edge from the pen origin ÷ em (leading side bearing). */
  readonly inkLeft: number;
  /** Glyph ink RIGHT edge from the pen origin ÷ em. */
  readonly inkRight: number;
  /** Pen advance ÷ em (0 ⇒ no font → consumers apply ZERO horizontal ink insets). */
  readonly advance: number;
}

/** No-font fallback: nominal font metrics + cap-height ink, `advance = 0` → no horizontal inset. */
const NOMINAL: TextGlyphInk = {
  fontAscent: TEXT_METRICS_RATIOS.ASCENT_RATIO,
  fontDescent: TEXT_METRICS_RATIOS.DESCENT_RATIO,
  inkAscent: TEXT_METRICS_RATIOS.CAP_HEIGHT_RATIO,
  inkDescent: 0,
  inkLeft: 0,
  inkRight: 0,
  advance: 0,
};

/**
 * The glyph ink box for `text`. Tier 1: a resolved opentype font → real font metrics +
 * glyph path ink bounds. Tier 2: the nominal cap box (no horizontal inset). Never throws;
 * always returns a positive vertical ink extent so the box geometry cannot degenerate.
 */
export function measureTextGlyphInk(text: string, style?: TextGlyphInkStyle): TextGlyphInk {
  if (!text) return NOMINAL;

  const family = style?.fontFamily || 'arial';
  const resolved = resolveEntityFont(family, { bold: style?.bold, italic: style?.italic });
  if (!resolved) return NOMINAL;

  const ref = GLYPH_REFERENCE_SIZE;
  const m = measureText(resolved.font, text, ref);
  const fontAscent = m.ascent / ref;
  const fontDescent = m.descent / ref;
  const advance = m.width / ref;

  // Real glyph ink bounds — opentype path is y-DOWN with the baseline at y=0 (topmost
  // point y1 ≤ 0 above the baseline, y2 ≥ 0 for descenders); x is the pen axis (x=0 origin).
  let inkAscent = NOMINAL.inkAscent;
  let inkDescent = NOMINAL.inkDescent;
  let inkLeft = 0;
  let inkRight = advance;
  const path = resolved.font.getPath(text, 0, 0, ref);
  const bb = typeof path?.getBoundingBox === 'function' ? path.getBoundingBox() : null;
  if (bb && Number.isFinite(bb.y1) && Number.isFinite(bb.y2) && bb.y2 > bb.y1) {
    inkAscent = Math.max(0, -bb.y1) / ref;
    inkDescent = Math.max(0, bb.y2) / ref;
  }
  if (bb && Number.isFinite(bb.x1) && Number.isFinite(bb.x2) && bb.x2 > bb.x1) {
    inkLeft = Math.max(0, bb.x1) / ref;
    inkRight = Math.min(m.width, bb.x2) / ref;
  }
  // Guard whitespace / empty-bbox glyphs so the box keeps a positive height.
  if (!(inkAscent + inkDescent > 0)) {
    inkAscent = NOMINAL.inkAscent;
    inkDescent = NOMINAL.inkDescent;
  }

  return { fontAscent, fontDescent, inkAscent, inkDescent, inkLeft, inkRight, advance };
}
