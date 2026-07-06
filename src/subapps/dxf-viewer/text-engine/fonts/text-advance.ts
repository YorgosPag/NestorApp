/**
 * measureTextAdvanceWorld — THE single source for a text run's rendered advance
 * width in WORLD units (ADR-557 Φ-attachment, built on ADR-530 glyph metrics).
 *
 * WHY: the attachment-aware text box (`bim/text/text-box.ts`: grips + 2D hover
 * frame + hitTest + 3D mesh + culling) previously sized its width with a MONOSPACE
 * approximation (`len·height·CHAR_WIDTH_MONOSPACE`), while the renderer paints the
 * glyphs with the REAL proportional font advance (`getGlyphRun().metrics.width`, or
 * the CSS `ctx.measureText`). For any non-monospace font the two diverged, so the
 * box, the handles and the hover outline never coincided with the drawn text
 * (Giorgio 2026-07-06: hover outline off + grips only grabbable off to one side).
 *
 * This module makes the box measure with the SAME metrics the renderer draws with,
 * so `resolveTextBox` ≡ the glyph draw box (Revit / Figma-grade: the hit box is the
 * real font bounds, one origin shared by every consumer). Resolution tiers mirror
 * the renderer's own paint path exactly:
 *
 *   1. A loaded opentype font (`resolveEntityFont` → `getGlyphRun`) — EXACT parity
 *      with `TextRenderer.fillGlyphRun` (`run.metrics.width / GLYPH_REFERENCE_SIZE`).
 *   2. No glyph font but a DOM canvas is available — `ctx.measureText` with the SAME
 *      font string `buildUIFont` builds, mirroring the renderer's CSS `fillText`
 *      fallback (advance scales linearly with px size → measure once at a ref size).
 *   3. No font AND no DOM (jest / SSR / font not yet loaded) — the monospace
 *      approximation, so pure callers + tests keep a finite, deterministic width.
 *
 * The `text-box` SSoT stays import-time pure: the only DOM touch (tier 2) is lazy and
 * guarded by `typeof document`, evaluated at call time, never at module load.
 *
 * @module text-engine/fonts/text-advance
 * @see rendering/entities/TextRenderer.ts — fillGlyphRun (the paint path this mirrors)
 * @see text-engine/fonts/glyph-path-cache.ts — getGlyphRun / GLYPH_REFERENCE_SIZE
 */

import { resolveEntityFont } from './font-resolver';
import { getGlyphRun, GLYPH_REFERENCE_SIZE } from './glyph-path-cache';
import { TEXT_METRICS_RATIOS, buildUIFont } from '../../config/text-rendering-config';

const CHAR_WIDTH_MONOSPACE = TEXT_METRICS_RATIOS.CHAR_WIDTH_MONOSPACE;

/** Reference px size for the tier-2 offscreen measure (advance scales linearly with size). */
const CSS_MEASURE_REF_PX = 100;

/** Style inputs that drive font resolution + the horizontal X-scale. */
export interface TextAdvanceStyle {
  readonly fontFamily?: string;
  readonly bold?: boolean;
  readonly italic?: boolean;
  /** AutoCAD TEXT X-scale — the horizontal stretch the renderer applies (`ctx.scale(wf,1)`). */
  readonly widthFactor?: number;
}

/** Monospace approximation — the no-font / no-DOM fallback (tier 3). `max(len,1)` never collapses. */
function monospaceAdvance(text: string, height: number): number {
  const len = text ? text.length : 0;
  return Math.max(len, 1) * height * CHAR_WIDTH_MONOSPACE;
}

// Lazy, memoised offscreen 2D context for the tier-2 CSS-fallback measure (browser only).
// `undefined` = not yet probed; `null` = no DOM / no 2D context (→ tier 3).
let measureCtx: CanvasRenderingContext2D | null | undefined;
function cssMeasureContext(): CanvasRenderingContext2D | null {
  if (measureCtx !== undefined) return measureCtx;
  if (typeof document === 'undefined') {
    measureCtx = null;
    return measureCtx;
  }
  try {
    // jsdom (jest) has no 2D backend — getContext returns null (or throws "Not
    // implemented"); either way we memoise `null` and degrade to the monospace tier.
    measureCtx = document.createElement('canvas').getContext('2d');
  } catch {
    measureCtx = null;
  }
  return measureCtx;
}

/** The natural (widthFactor = 1) advance, in world units, via the 3-tier resolution. */
function baseAdvanceWorld(text: string, height: number, style?: TextAdvanceStyle): number {
  // Empty / missing content → a minimum (1-char) box so the geometry never degenerates.
  if (!text) return monospaceAdvance(text, height);

  const family = style?.fontFamily || 'arial';

  // Tier 1 — loaded opentype font: byte-for-byte the renderer's glyph-paint advance.
  const resolved = resolveEntityFont(family, { bold: style?.bold, italic: style?.italic });
  if (resolved) {
    const run = getGlyphRun(resolved.font, resolved.cacheName, text);
    return (run.metrics.width / GLYPH_REFERENCE_SIZE) * height;
  }

  // Tier 2 — CSS fillText parity: same font string, measured at a reference px size.
  const ctx = cssMeasureContext();
  if (ctx) {
    ctx.font = buildUIFont(CSS_MEASURE_REF_PX, family, style?.bold ? 'bold' : 'normal', style?.italic);
    const px = ctx.measureText(text).width;
    if (Number.isFinite(px) && px > 0) return (px / CSS_MEASURE_REF_PX) * height;
  }

  // Tier 3 — no font, no DOM: monospace approximation.
  return monospaceAdvance(text, height);
}

/**
 * The rendered advance width of `text` at `height` (world units), including the
 * AutoCAD X-scale (`widthFactor`). Matches EXACTLY what `TextRenderer` paints, so a
 * box sized with this coincides with the drawn glyphs.
 */
export function measureTextAdvanceWorld(
  text: string,
  height: number,
  style?: TextAdvanceStyle,
): number {
  const widthFactor = style?.widthFactor != null && style.widthFactor > 0 ? style.widthFactor : 1;
  return baseAdvanceWorld(text, height, style) * widthFactor;
}

/** Test-only: reset the memoised measure context (so a jsdom canvas mock can be re-probed). */
export function __resetTextAdvanceMeasureCtx(): void {
  measureCtx = undefined;
}
