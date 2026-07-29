/**
 * glyph-run-draw.ts — the ONE single-line text-run paint SSoT (ADR-557 Φάση C).
 *
 * BOTH the 2D canvas renderer (`TextRenderer.paintText`) AND the 3D textured-plane
 * converter (`bim-3d/converters/dxf-text-3d.ts`) paint a text line through THIS module,
 * so a glyph is drawn with the SAME font outlines + tracking + fallback in every viewport.
 * The big players keep ONE font engine across 2D & 3D (Revit model text renders through the
 * same engine in plan and 3D; Cinema 4D text is one outline source per viewport; Figma
 * rasterises with the real font, never a CSS fallback).
 *
 * Before Φάση C the 3D path used a hard-coded `ctx.fillText` + `DEFAULT_FAMILY` string — a
 * SECOND, divergent text mechanism: bold / italic / family / widthFactor / tracking were
 * silently dropped, and a registry-only font (SHX / Τέκτονας) rendered as its real outlines
 * in 2D but as the CSS fallback in 3D. This module removes that second mechanism.
 *
 * Two tiers, mirroring AutoCAD/Revit "the real font if loaded, else the closest CSS substitute":
 *   1. `resolved` (a loaded opentype font, via `resolveEntityFont`) → the cached vector glyph
 *      run (`getGlyphRun`), filled as a Path2D — zoom-stable, tracking baked in.
 *   2. `resolved === null` (italic / no bundled face) → CSS `ctx.fillText` on the font the
 *      CALLER has already set on `ctx.font`, with AutoCAD `\T` tracking via `letterSpacing`.
 *
 * Pure: no React / THREE / store deps. Operates on whatever 2D context it is handed — an
 * on-screen canvas in 2D, an offscreen `CanvasTexture` canvas in 3D.
 *
 * @see rendering/entities/TextRenderer.ts — the 2D consumer (paintText delegates here)
 * @see bim-3d/converters/dxf-text-3d.ts — the 3D consumer (texture glyphs)
 */

import { getGlyphRun, GLYPH_REFERENCE_SIZE, type GlyphRun } from './glyph-path-cache';
import type { ResolvedFont } from './font-resolver';

/** A 2D context that may expose the (recent-browser) `letterSpacing` property. */
type SpacingCtx = CanvasRenderingContext2D & { letterSpacing: string };

/**
 * Run `body` with AutoCAD `\T` tracking applied as canvas `letterSpacing`
 * ((tracking − 1) × emSize between glyphs), restoring the previous value after.
 * `body` measures/paints while the spacing is set so its advance matches the drawn text.
 * When tracking is 1 or `letterSpacing` is unsupported, `body` runs with no spacing change.
 * The ONE place the CSS-fallback tracking dance lives — shared by paint + measure.
 */
function withTrackingSpacing<T>(
  ctx: CanvasRenderingContext2D,
  emSize: number,
  tracking: number,
  body: () => T,
): T {
  const extraPx = tracking !== 1 ? (tracking - 1) * emSize : 0;
  if (extraPx !== 0 && 'letterSpacing' in ctx) {
    const spacingCtx = ctx as SpacingCtx;
    const prev = spacingCtx.letterSpacing;
    spacingCtx.letterSpacing = `${extraPx}px`;
    try {
      return body();
    } finally {
      spacingCtx.letterSpacing = prev;
    }
  }
  return body();
}

/**
 * Fill a cached glyph run's Path2D at (originX, originY), scaled to `emSize`
 * (draw scale = emSize / GLYPH_REFERENCE_SIZE) and positioned per `align`/`baseline`.
 * Glyph paths are baseline-anchored at the reference em size; the baseline map matches the
 * canvas `textBaseline` modes. Returns the drawn advance width in px.
 *
 * ⚠️ `emSize` is a FONT EM SIZE, not a DXF text height — the two differ by the font's cap-height
 * ratio (ADR-635 Φ C.22). A caller holding a text height must convert with
 * `emSizeForTextHeight()`; a caller already working in em space (the 3D glyph atlas rasterises at
 * a fixed em and stores em ratios) passes its em straight through. Naming the unit is what keeps
 * the conversion from being applied twice.
 */
export function drawGlyphRunToCanvas(
  ctx: CanvasRenderingContext2D,
  run: GlyphRun,
  originX: number,
  originY: number,
  emSize: number,
  align: CanvasTextAlign,
  baseline: CanvasTextBaseline,
): number {
  const s = emSize / GLYPH_REFERENCE_SIZE;
  const widthPx = run.metrics.width * s;
  const ascentPx = run.metrics.ascent * s;
  const descentPx = run.metrics.descent * s;
  const xOff = align === 'center' ? -widthPx / 2 : align === 'right' ? -widthPx : 0;
  // Glyph paths are baseline-anchored; map to the canvas textBaseline modes.
  const baselineY = baseline === 'middle' ? (ascentPx - descentPx) / 2
    : baseline === 'bottom' ? -descentPx
      : ascentPx; // 'top' / 'alphabetic' default → drop by ascent so the top sits at originY
  ctx.save();
  ctx.translate(originX + xOff, originY + baselineY);
  ctx.scale(s, s);
  ctx.fill(run.path);
  ctx.restore();
  return widthPx;
}

/** Inputs for a single-line paint through the shared SSoT. */
export interface PaintTextRunOptions {
  readonly originX: number;
  readonly originY: number;
  /**
   * FONT EM SIZE in px — the glyph draw scale, and the CSS `font-size` the fallback tier assumes
   * the caller has already set on `ctx.font`. NOT a DXF text height: convert one with
   * `emSizeForTextHeight()` first (ADR-635 Φ C.22).
   */
  readonly emSize: number;
  readonly align: CanvasTextAlign;
  readonly baseline: CanvasTextBaseline;
  /** A loaded opentype font, or null → CSS `ctx.fillText` on the caller-set `ctx.font`. */
  readonly resolved: ResolvedFont | null;
  /** AutoCAD `\T` tracking factor (1 = normal). */
  readonly tracking?: number;
}

/**
 * Paint ONE text line — the cached glyph path when a CAD font resolved, else the legacy CSS
 * `fillText` (on the font + align/baseline the caller set on `ctx`). Returns the rendered
 * advance width in px (for decoration / box positioning). The SINGLE routine 2D + 3D share.
 */
export function paintTextRun(
  ctx: CanvasRenderingContext2D,
  text: string,
  opts: PaintTextRunOptions,
): number {
  const tracking = opts.tracking ?? 1;
  if (opts.resolved) {
    const run = getGlyphRun(opts.resolved.font, opts.resolved.cacheName, text, tracking);
    return drawGlyphRunToCanvas(ctx, run, opts.originX, opts.originY, opts.emSize, opts.align, opts.baseline);
  }
  // CSS fillText fallback (no loaded opentype font). AutoCAD `\T` → canvas `letterSpacing`
  // applied on BOTH paint + measure so the returned advance matches the drawn text. Requires
  // the caller to have set `ctx.font` (+ textAlign/baseline).
  return withTrackingSpacing(ctx, opts.emSize, tracking, () => {
    ctx.fillText(text, opts.originX, opts.originY);
    return ctx.measureText(text).width;
  });
}

/**
 * Advance width in px WITHOUT drawing — mirrors `paintTextRun`'s two tiers exactly, for
 * pre-allocating a texture canvas (the 3D converter sizes its canvas before drawing). The
 * CSS branch reads the caller-set `ctx.font`.
 */
export function measureTextRunPx(
  ctx: CanvasRenderingContext2D,
  text: string,
  opts: { readonly emSize: number; readonly resolved: ResolvedFont | null; readonly tracking?: number },
): number {
  const tracking = opts.tracking ?? 1;
  if (opts.resolved) {
    const run = getGlyphRun(opts.resolved.font, opts.resolved.cacheName, text, tracking);
    return run.metrics.width * (opts.emSize / GLYPH_REFERENCE_SIZE);
  }
  return withTrackingSpacing(ctx, opts.emSize, tracking, () => ctx.measureText(text).width);
}
