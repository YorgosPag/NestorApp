/**
 * complex-symbol-draw — ADR-642 Φ3 (#3): embedded symbol painting for `ComplexLineStroker`.
 *
 * Draws ONE `SymbolElement` at a given arc-length point along a styled polyline
 * (`──×──×──` φράχτης, batting μόνωση, βέλος φοράς). Pure canvas primitive: the stroker
 * walks the path and hands this the point+tangent (`pointAt` → x,y,ux,uy) at each cycle
 * slot; here we resolve the glyph, orient it along the tangent, and stamp its unit-space
 * vector primitives.
 *
 * FULL SSoT reuse (no second glyph mechanism — N.18):
 *   - Glyph geometry → `linetype-symbol-catalog` (unit-space `AnnotationSymbolPrimitive[]`).
 *   - Painter       → `stampSymbolPrimitive` (the ONE annotation+linetype glyph stamper).
 *   - Deg→rad       → `degToRad` (ADR-067).
 * Mirrors `complex-text-draw.drawTextElement` EXACTLY: zero-length slot, X along tangent,
 * Y along the left normal, `scale`×mmToPx, R relative-to-tangent + user rotation.
 *
 * AutoCAD-faithful placement (`.shx` shape linetype): the symbol occupies a ZERO-length
 * pattern slot (it never advances the cycle — the surrounding gaps make its room). Unlike
 * text, a symbol is NOT flipped upright — it rotates fully with the line (a directional
 * arrow follows the travel direction; `×`/`+`/`○` are rotation-insensitive anyway). The
 * placement works in a virtual y-UP frame so the shared stamper's world-CCW / Y-flip
 * conventions apply unchanged, then maps back to the y-DOWN screen.
 */

import type { SymbolElement } from '../../config/complex-linetype-types';
import { getLinetypeSymbol } from '../../config/linetype-symbol-catalog';
import { TEXT_SIZE_LIMITS } from '../../config/text-rendering-config';
import { degToRad } from '../entities/shared/geometry-utils';
import { stampSymbolPrimitive } from '../entities/shared/symbol-primitive-stamp';
import type { TangentPoint } from './complex-text-draw';

/** Nominal glyph height (mm) that a `scale` of 1 maps to — ISO / AutoCAD default (2.5mm). */
const BASE_SYMBOL_HEIGHT_MM = TEXT_SIZE_LIMITS.DEFAULT_HEIGHT;

/** Below this on-screen size a glyph is a sub-pixel smear → skip (never blot the line). */
const MIN_SYMBOL_SIZE_PX = 1;

/**
 * Paint `el`'s glyph centred at the arc-length point `at`, using the SAME mm→px factor the
 * dashes use (so the symbol scales with the pattern). No-op for a sub-pixel size.
 * Self-contained ctx save/restore; solid fills inherit the current stroke colour.
 */
export function drawSymbolElement(
  ctx: CanvasRenderingContext2D,
  el: SymbolElement,
  at: TangentPoint,
  mmToPx: number,
): void {
  if (mmToPx <= 0) return;
  const unitToPx = Math.max(el.scale, 0) * BASE_SYMBOL_HEIGHT_MM * mmToPx;
  if (unitToPx < MIN_SYMBOL_SIZE_PX) return;

  const def = getLinetypeSymbol(el.glyphId);

  // Virtual y-UP frame (like the annotation renderer's world): tangent angle CCW, glyph
  // rotates with it + the user R. The shared stamper expects a world-CCW `rot` and a
  // `toScreen` that owns the Y-flip — so we map unit→(y-up)→screen by negating world-Y
  // about the insertion point.
  const tang = Math.atan2(-at.uy, at.ux);
  const rot = tang + degToRad(el.rotationDeg);
  const ct = Math.cos(tang);
  const st = Math.sin(tang);
  const cr = Math.cos(rot);
  const sr = Math.sin(rot);

  // Insertion: X along the tangent, Y along the left normal (both mm→px), then Y-flip.
  const ox = el.offsetXMm * mmToPx;
  const oy = el.offsetYMm * mmToPx;
  const insX = at.x + (ox * ct - oy * st);
  const insY = at.y - (ox * st + oy * ct);

  const toScreen = ([ux, uy]: readonly [number, number]) => ({
    x: insX + unitToPx * (ux * cr - uy * sr),
    y: insY - unitToPx * (ux * sr + uy * cr),
  });

  ctx.save();
  ctx.fillStyle = ctx.strokeStyle; // solid fills (arrow) match the line colour
  for (const prim of def.geometry) {
    stampSymbolPrimitive(ctx, prim, { toScreen, radiusScale: unitToPx, rot });
  }
  ctx.restore();
}
