/**
 * text-height-scale.ts — THE single conversion «DXF text height → font em size» (ADR-635 Φ C.22).
 *
 * WHY: DXF group 40 (and the MTEXT `\H`) carry a TEXT HEIGHT, **not** an em size. AutoCAD scales
 * a font so that the height of a CAPITAL LETTER equals that value; the em box is therefore
 * LARGER than the text height, by a factor that varies from font to font. We used to pass the
 * text height straight through as the em size, so every imported text rendered ~40% too small
 * and wrapped at the wrong words.
 *
 * ═══ HOW THE RULE WAS ESTABLISHED (measured, not quoted) ═══════════════════════════════════
 * The two public authorities disagree, so neither was trusted:
 *   • Autodesk («About Setting Text Height», ACAD 2021) says the text height is «a capital letter
 *     plus an accent area» — i.e. an ASCENDER-like metric, caps SMALLER than the text height.
 *   • ezdxf (`ttfonts.py`, `get_scaling_factor`) scales by the INK of the glyph «A».
 *
 * Calibration, 2026-07-29 (Giorgio's AutoCAD 2021): four TEXT entities of height 10 (`HXO`) were
 * drawn in AutoCAD, converted to outlines with `TXTEXP` and re-imported; the «H» stem height was
 * measured off the resulting polylines (yMax−yMin of one polyline, so any offset cancels):
 *
 *   font         measured   if `OS/2.sCapHeight`=height   if glyph INK=height
 *   Arial          9.9972      9.9932  (err 0.04%)          10.0000  (err 0.03%)
 *   Calibri       10.0417     10.0464  (err 0.05%)          10.0000  (err 0.42%)
 *   Tahoma         9.9972     10.0000  (err 0.03%)          10.0000  (err 0.03%)
 *   romans.shx     9.9972         —                             —
 *
 * Calibri decided it: it is the only one whose DECLARED `sCapHeight` (1294) differs from the real
 * ink of «H» (1300) — by +0.46% — and the measurement came out +0.45% tall. So AutoCAD reads the
 * **declared `OS/2.sCapHeight`**, not the outlines. Both authorities above are wrong.
 * Cross-check on an INDEPENDENT axis: with `em` from this rule, the opentype advance width of
 * «HXO» matches the measured outline width to 0.21–0.24% for all three fonts.
 *
 * `romans.shx` landed on the SAME 9.9972 as the TrueType fonts ⇒ **there is no TTF/SHX branch**:
 * one rule covers every font (and `shx-parser/shx-renderer.ts`, which scales by the SHX file's own
 * cap height, already agrees). A substituted face is scaled by ITS OWN cap height, which is what
 * keeps a romans.shx drawing the same visual size as in AutoCAD.
 *
 * ⚠️ ONE function, called by EVERY «height → em» site (glyph paint, glyph measure, glyph ink box,
 * 3D atlas layout). If a call site computes its own factor, measurement and painting drift apart
 * and the Φ C.21 «ΦΕΚ405» class of bug (overlapping words + overflowing lines) comes straight back.
 *
 * @module text-engine/fonts/text-height-scale
 * @see text-engine/fonts/font-resolver.ts — ResolvedFont (`cacheName` is this module's memo key)
 * @see docs/centralized-systems/reference/adrs/ADR-635-autocad-dxf-import-entity-coverage.md
 */

import type { Font } from 'opentype.js';
import type { ResolvedFont } from './font-resolver';
import { TEXT_METRICS_RATIOS } from '../../config/text-rendering-config';

/**
 * Plausible band for capHeight ÷ em. Real text faces sit around 0.63–0.78 (Calibri 0.63,
 * Arial 0.72, Tahoma 0.73); display/CJK faces reach higher. A value outside this band means a
 * broken or non-Latin `OS/2` table, and dividing by it would explode (or collapse) every glyph on
 * screen — so the nominal ratio is used instead. Belt-and-suspenders, not a guess about fonts.
 */
const MIN_CAP_RATIO = 0.3;
const MAX_CAP_RATIO = 1.5;

/** Memo of capHeight ÷ em per FontCache name — the PC has no GPU, this runs per span. */
const capRatioByFont = new Map<string, number>();

/** Ink height of `char` above the baseline, in font units, or null when it has no outline. */
function inkCapHeight(font: Font, char: string): number | null {
  const upm = font.unitsPerEm || 1000;
  const path = font.getPath(char, 0, 0, upm);
  const bb = typeof path?.getBoundingBox === 'function' ? path.getBoundingBox() : null;
  // opentype paths are y-DOWN with the baseline at 0, so the top of the ink is `-y1`.
  if (!bb || !Number.isFinite(bb.y1)) return null;
  const ink = -bb.y1;
  return ink > 0 ? ink : null;
}

/**
 * capHeight ÷ em for `font`: the DECLARED `OS/2.sCapHeight` (what AutoCAD reads — see the module
 * note), falling back to the ink of «H», then «A», then the nominal ratio. Never returns 0.
 */
function readCapHeightRatio(font: Font): number {
  const upm = font.unitsPerEm || 1000;
  const inBand = (r: number): boolean => r >= MIN_CAP_RATIO && r <= MAX_CAP_RATIO;

  const declared = font.tables?.os2?.sCapHeight;
  if (typeof declared === 'number' && inBand(declared / upm)) return declared / upm;

  // No (or implausible) `sCapHeight`: OS/2 below version 2 does not define the field at all.
  for (const char of ['H', 'A']) {
    const ink = inkCapHeight(font, char);
    if (ink != null && inBand(ink / upm)) return ink / upm;
  }
  return TEXT_METRICS_RATIOS.CAP_HEIGHT_RATIO;
}

/** capHeight ÷ em of a resolved face (memoised by `cacheName`); the nominal ratio when unresolved. */
export function capHeightRatio(resolved: ResolvedFont | null): number {
  if (!resolved) return TEXT_METRICS_RATIOS.CAP_HEIGHT_RATIO;
  const hit = capRatioByFont.get(resolved.cacheName);
  if (hit !== undefined) return hit;
  const ratio = readCapHeightRatio(resolved.font);
  capRatioByFont.set(resolved.cacheName, ratio);
  return ratio;
}

/**
 * The font em size that renders `textHeight` as AutoCAD does — i.e. with capital letters exactly
 * `textHeight` tall. THE conversion; call it wherever a DXF text height becomes a font size.
 *
 * With no resolved font (`null` — the CSS `fillText` tier, SSR, jest, font still loading) the
 * text height is returned UNCHANGED: no font means no cap height to divide by, and the CSS tier
 * measures and paints with that same size, so measure ≡ paint still holds within that tier.
 */
export function emSizeForTextHeight(textHeight: number, resolved: ResolvedFont | null): number {
  if (!resolved) return textHeight;
  const ratio = capHeightRatio(resolved);
  return ratio > 0 ? textHeight / ratio : textHeight;
}

/** Test-only: drop the memo (a fixture font may be re-registered under an already-seen name). */
export function __resetCapHeightCache(): void {
  capRatioByFont.clear();
}
