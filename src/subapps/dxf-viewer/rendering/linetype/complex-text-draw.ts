/**
 * complex-text-draw — ADR-642 Φ2 (#2): embedded text painting for `ComplexLineStroker`.
 *
 * Draws ONE `TextElement` at a given arc-length point along a styled polyline
 * (`──GAS──GAS──`). Pure canvas primitive: the stroker walks the path and hands this
 * the point+tangent (`pointAt` → x,y,ux,uy) at each cycle slot; here we place, rotate
 * and paint the glyph run.
 *
 * FULL SSoT reuse (no second text mechanism — N.18):
 *   - Glyph run  → `paintTextRun` + `resolveEntityFont` (the ONE 2D/3D painter,
 *     ADR-557/530): a loaded CAD font draws as vector outlines, else CSS fallback.
 *   - Font string→ `buildUIFont` (the CSS-fallback family/size builder).
 *   - Deg→rad    → `degToRad` (ADR-067).
 * The tangent angle comes from the Φ1 geometry (`pointAt` unit direction), so text
 * follows the line without any new path-tangent math.
 *
 * AutoCAD-faithful placement (`["GAS",STYLE,S,R,X,Y]`): the text occupies a ZERO-length
 * pattern slot (it never advances the cycle — the surrounding gaps make its room). `X`
 * shifts it along the tangent, `Y` along the left normal, `S` scales the base cap-height,
 * `R` rotates (relative to the tangent when `followPath`, else absolute). Screen space is
 * y-DOWN, so R is negated to keep the CAD CCW-positive convention.
 */

import type { TextElement } from '../../config/complex-linetype-types';
import { buildUIFont, TEXT_SIZE_LIMITS } from '../../config/text-rendering-config';
import { degToRad } from '../entities/shared/geometry-utils';
// Direct module imports (NOT the `text-engine/fonts` barrel) — the barrel re-exports
// font-manager (Firebase) + font-loader (fetch); importing it into this hot render path
// would pull those heavy deps into the bundle and break the node test env.
import { resolveEntityFont } from '../../text-engine/fonts/font-resolver';
import { paintTextRun } from '../../text-engine/fonts/glyph-run-draw';

/** Base cap-height (mm) that a `scale` of 1 maps to — ISO 3098 / AutoCAD default (2.5mm). */
const BASE_TEXT_HEIGHT_MM = TEXT_SIZE_LIMITS.DEFAULT_HEIGHT;

/** Below this on-screen height a glyph is a sub-pixel smear → skip (never blot the line). */
const MIN_TEXT_HEIGHT_PX = 0.5;

/** Point + unit tangent along the path (the `pointAt` shape from complex-stroke-geometry). */
export interface TangentPoint {
  readonly x: number;
  readonly y: number;
  readonly ux: number;
  readonly uy: number;
}

/**
 * Paint `el` centred at the arc-length point `at`, using the SAME mm→px factor the
 * dashes use (so text scales with the pattern). No-op for empty text or sub-pixel size.
 * Self-contained ctx save/restore; the glyph inherits the current stroke colour.
 */
export function drawTextElement(
  ctx: CanvasRenderingContext2D,
  el: TextElement,
  at: TangentPoint,
  mmToPx: number,
): void {
  const value = el.value.trim();
  if (!value || mmToPx <= 0) return;
  const heightPx = Math.max(el.scale, 0) * BASE_TEXT_HEIGHT_MM * mmToPx;
  if (heightPx < MIN_TEXT_HEIGHT_PX) return;

  // Insertion point: X along the tangent, Y along the left normal (−uy, ux). Both mm→px.
  const nx = -at.uy;
  const ny = at.ux;
  const ox = el.offsetXMm * mmToPx;
  const oy = el.offsetYMm * mmToPx;
  const px = at.x + ox * at.ux + oy * nx;
  const py = at.y + ox * at.uy + oy * ny;

  // Tangent angle (screen) when following the path, else horizontal; minus user R (CCW+).
  let angle = (el.followPath ? Math.atan2(at.uy, at.ux) : 0) - degToRad(el.rotationDeg);
  // Keep upright: flip a leftward baseline so text is never mirrored/upside-down (GIS default).
  if (Math.cos(angle) < 0) angle += Math.PI;

  const family = el.styleId || 'arial';
  const resolved = resolveEntityFont(family, { bold: false, italic: false });

  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(angle);
  ctx.fillStyle = ctx.strokeStyle; // text matches the line colour (glyph fill + CSS fallback)
  ctx.font = buildUIFont(heightPx, family); // used only by the CSS fallback branch
  paintTextRun(ctx, value, {
    originX: 0,
    originY: 0,
    targetHeight: heightPx,
    align: 'center',
    baseline: 'middle',
    resolved,
  });
  ctx.restore();
}
