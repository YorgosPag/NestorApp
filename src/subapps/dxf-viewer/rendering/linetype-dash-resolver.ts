/**
 * Linetype Dash Resolver — ADR-510 Φ2 (canvas dash rendering SSoT).
 *
 * Pure bridge between the metric linetype pattern (mm, from
 * `config/linetype-iso-catalog.ts` → `ResolvedStyle.linetype.pattern`) and the
 * `ctx.setLineDash()` argument the canvas expects (screen px, all-positive).
 *
 * Two semantic differences the canvas API does NOT understand are normalised
 * here, so every render path can call one function:
 *   1. DXF/`.LIN` patterns encode gaps as NEGATIVE values (`-6.35`); the canvas
 *      wants positive lengths → `Math.abs`.
 *   2. DXF encodes a dot as `0` (zero-length dash); the canvas treats a `0`
 *      segment as invisible → promoted to `MIN_DOT_PX`.
 *
 * Scaling philosophy (mirror of lineweight, see `resolved-style.types.ts`): the
 * resolver/cascade carries the pattern in mm (zoom-agnostic); the px conversion
 * happens HERE at stroke time, using the live world→screen scale. Unlike
 * lineweight (zoom-INDEPENDENT, AutoCAD LWT), a linetype dash is part of the
 * drawing and therefore scales WITH the zoom — plus the global LTSCALE knob.
 *
 * Reuses `scaleDashPattern` (ADR-083, `config/text-rendering-config.ts`) for the
 * multiply step — NO new `setLineDash` wrapper.
 */

import { scaleDashPattern } from '../config/text-rendering-config';

/** Minimum on-screen length (px) for a dot segment (DXF `0`). */
export const MIN_DOT_PX = 0.5;

/**
 * Convert a metric linetype pattern (mm) to a canvas `setLineDash` array (px).
 *
 * Total scale = zoom × LTSCALE (global) × CELTSCALE (per-object) — exactly the
 * AutoCAD model-space linetype scaling stack.
 *
 * @param patternMm        Catalog pattern: positive = dash, negative = gap,
 *                         `0` = dot, empty = solid (Continuous).
 * @param worldToScreenScale  World-units → screen-px factor (the current zoom).
 * @param ltscale          Global linetype scale (`LinetypeScaleStore`, default 1).
 * @param celtscale        Per-object linetype scale (entity `ltscale`, DXF grp 48,
 *                         default 1). AutoCAD CELTSCALE.
 * @returns All-positive px lengths for `ctx.setLineDash`; `[]` for solid or when
 *          the scale is degenerate (caller renders a continuous line).
 */
export function dashMmToScreenPx(
  patternMm: ReadonlyArray<number>,
  worldToScreenScale: number,
  ltscale: number,
  celtscale = 1,
): number[] {
  if (patternMm.length === 0) return [];
  const totalScale = worldToScreenScale * ltscale * celtscale;
  if (!Number.isFinite(totalScale) || totalScale <= 0) return [];

  // |v| folds gaps (negative) to positive lengths; dots (0) stay 0 for now.
  const positiveMm = patternMm.map((v) => Math.abs(v));
  // Reuse ADR-083 scaler for the single multiply step.
  const scaledPx = scaleDashPattern(positiveMm, totalScale);
  // Promote dots (scaled to 0) to a minimum visible length.
  return scaledPx.map((px) => (px > 0 ? px : MIN_DOT_PX));
}

/** True when a resolved pattern is solid (Continuous) → no dash needed. */
export function isSolidPattern(patternMm: ReadonlyArray<number>): boolean {
  return patternMm.length === 0;
}
