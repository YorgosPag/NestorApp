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
 * All fields are height-INDEPENDENT ratios of the DXF TEXT HEIGHT — NOT of the em (ADR-635
 * Φ C.22: the font is drawn at `em = height × unitsPerEm / sCapHeight`, and these ratios already
 * carry that factor). They scale linearly with size, so one measure at a reference size serves
 * every height + X-scale:
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
import { emSizeForTextHeight } from './text-height-scale';
import { TEXT_METRICS_RATIOS } from '../../config/text-rendering-config';

/** The ascent/descent pair a baseline offset is measured against (any consistent unit). */
export interface VerticalBandMetrics {
  /** Font ascent ABOVE the baseline (positive). */
  readonly ascent: number;
  /** Font descent BELOW the baseline (positive magnitude). */
  readonly descent: number;
}

/**
 * ADR-635 Φ C.26 — THE single answer to «how far is the glyph BASELINE from the anchor point?».
 *
 * Returns a **world y-UP** signed offset in the same unit as `m` (px, em, or ÷ text height —
 * the map is a pure linear combination, so it is unit-agnostic): positive ⇒ the baseline sits
 * ABOVE the anchor. A screen-y-DOWN consumer negates ONCE at its own boundary.
 *
 * Before this function the identical rule existed THREE times, in three sign/unit conventions —
 * `glyph-run-draw.baselineY` (px, y-down), `text-box.visualVerticalRatios.baselineDrop`
 * (÷ text height, y-down, then negated) and the 3D atlas — so «where the baseline goes» could
 * be answered differently by the painter and by the box that must hug what the painter drew.
 *
 * `'alphabetic'` → **0**: the anchor IS the baseline (DXF TEXT group 73 = 0). This is the state
 * the 3-row attachment grid cannot express; it used to fall into the `'top'` default and land a
 * whole font ASCENT away. Every other canvas mode (`'hanging'`, `'ideographic'`) keeps the
 * historic `'top'` behaviour — deliberately, they have no DXF meaning here.
 */
export function baselineOffsetFromAnchor(
  anchor: CanvasTextBaseline,
  m: VerticalBandMetrics,
): number {
  switch (anchor) {
    case 'alphabetic':
      return 0;
    case 'bottom':
      return m.descent;
    case 'middle':
      return -(m.ascent - m.descent) / 2;
    default:
      return -m.ascent; // 'top' (+ 'hanging' / 'ideographic', unused by DXF)
  }
}

/**
 * Where the anchor sits inside the font's ascent→descent band, as a fraction (0 = the ascent
 * line, 1 = the descent line). The decoration rules (`underline`/`overline`/`strikethrough`)
 * are calibrated as fractions measured DOWN from that band's top, so this is the one number
 * that re-bases them for any anchor — derived from {@link baselineOffsetFromAnchor}, never a
 * second table: `'top'` → 0, `'middle'` → 0.5, `'bottom'` → 1, `'alphabetic'` → ascent ÷ band.
 * A degenerate band (no metrics) → 0, i.e. the historic `'top'` behaviour.
 */
export function anchorBandFraction(anchor: CanvasTextBaseline, m: VerticalBandMetrics): number {
  const band = m.ascent + m.descent;
  if (!(band > 0)) return 0;
  return (m.ascent + baselineOffsetFromAnchor(anchor, m)) / band;
}

/** Font-resolution inputs (the X-scale `widthFactor` is applied by the consumer, not here). */
export interface TextGlyphInkStyle {
  readonly fontFamily?: string;
  readonly bold?: boolean;
  readonly italic?: boolean;
}

/**
 * All fields are ÷ the DXF TEXT HEIGHT (group 40 / `\H`), so they are size- and X-scale-independent
 * and a consumer recovers world units by multiplying with the entity height. Since ADR-635 Φ C.22
 * that is NOT the same as ÷ the em: the font is drawn at `em = height / capHeightRatio`, and these
 * ratios already carry that factor.
 */
export interface TextGlyphInk {
  /** Font ascent above the baseline ÷ text height — where the renderer seats the baseline. */
  readonly fontAscent: number;
  /** Font descent below the baseline ÷ text height. */
  readonly fontDescent: number;
  /** Glyph ink ascent above the baseline ÷ text height — box TOP. */
  readonly inkAscent: number;
  /** Glyph ink descent below the baseline ÷ text height — box BOTTOM. */
  readonly inkDescent: number;
  /** Glyph ink LEFT edge from the pen origin ÷ text height (leading side bearing). */
  readonly inkLeft: number;
  /** Glyph ink RIGHT edge from the pen origin ÷ text height. */
  readonly inkRight: number;
  /** Pen advance ÷ text height (0 ⇒ no font → consumers apply ZERO horizontal ink insets). */
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
  // ADR-635 Φ C.22 — every field is a ratio of the DXF TEXT HEIGHT (that is what consumers
  // multiply by), while the metrics below are measured in EM units at `ref`. `emSizeForTextHeight(1)`
  // is exactly «em per unit of text height», so this one factor converts the whole set. Without it
  // the box would keep hugging the OLD (≈40% smaller) glyphs while the renderer drew the new ones.
  const emPerRef = emSizeForTextHeight(1, resolved) / ref;
  const fontAscent = m.ascent * emPerRef;
  const fontDescent = m.descent * emPerRef;
  const advance = m.width * emPerRef;

  // Real glyph ink bounds — opentype path is y-DOWN with the baseline at y=0 (topmost
  // point y1 ≤ 0 above the baseline, y2 ≥ 0 for descenders); x is the pen axis (x=0 origin).
  let inkAscent = NOMINAL.inkAscent;
  let inkDescent = NOMINAL.inkDescent;
  let inkLeft = 0;
  let inkRight = advance;
  const path = resolved.font.getPath(text, 0, 0, ref);
  const bb = typeof path?.getBoundingBox === 'function' ? path.getBoundingBox() : null;
  if (bb && Number.isFinite(bb.y1) && Number.isFinite(bb.y2) && bb.y2 > bb.y1) {
    inkAscent = Math.max(0, -bb.y1) * emPerRef;
    inkDescent = Math.max(0, bb.y2) * emPerRef;
  }
  if (bb && Number.isFinite(bb.x1) && Number.isFinite(bb.x2) && bb.x2 > bb.x1) {
    inkLeft = Math.max(0, bb.x1) * emPerRef;
    inkRight = Math.min(m.width, bb.x2) * emPerRef;
  }
  // Guard whitespace / empty-bbox glyphs so the box keeps a positive height.
  if (!(inkAscent + inkDescent > 0)) {
    inkAscent = NOMINAL.inkAscent;
    inkDescent = NOMINAL.inkDescent;
  }

  return { fontAscent, fontDescent, inkAscent, inkDescent, inkLeft, inkRight, advance };
}
