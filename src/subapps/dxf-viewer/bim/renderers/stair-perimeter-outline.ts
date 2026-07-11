/**
 * Stair perimeter outline — hover/highlight halo geometry (ADR-358 Phase 8).
 *
 * Pure canvas-drawing helpers extracted from `StairRenderer` (file-size SRP split,
 * N.7.1 / ADR-623 Φ2) so the renderer stays under the 500-line limit and the halo
 * geometry stays testable in isolation. Takes an explicit `worldToScreen` projector
 * (the renderer's own) so there is no dependency on the renderer instance.
 *
 * @module bim/renderers/stair-perimeter-outline
 * @see bim/renderers/StairRenderer — the consumer
 */

import type { Point2D } from '../../rendering/types/Types';
import type { StairEntity } from '../types/stair-types';

/** World→screen projector (the renderer's `worldToScreen`). */
type WorldToScreen = (p: Point2D) => Point2D;

/**
 * Glow halo for hover/highlight (ADR-358 Phase 8, Giorgio 2026-07-10 revision).
 *
 * Follows the ACTUAL stair footprint — for an L / U / Γ / curved stair the halo is
 * an L / U / Γ / curved outline that COINCIDES with the shape, NOT a rectangular
 * bounding box that engulfs the empty inner corner (the exact bug Giorgio flagged:
 * «να μην είναι τετράγωνο»). The footprint boundary is `outer stringer forward +
 * inner stringer reversed` — both stringers are the walkline offset by ±width/2
 * (`buildStringersFromWalkline`), so the closed loop hugs the run for EVERY variant
 * (straight → rectangle, L/U/Γ → the bent shape, spiral/sketch → the curved band).
 *
 * Falls back to the local-frame OBB only when the stringers are degenerate (< 2
 * points) — e.g. a not-yet-computed geometry.
 */
export function drawStairPerimeterOutline(
  ctx: CanvasRenderingContext2D,
  worldToScreen: WorldToScreen,
  stair: StairEntity,
): void {
  const { outer, inner } = stair.geometry.stringers;
  if (outer.length >= 2 && inner.length >= 2) {
    ctx.beginPath();
    const first = worldToScreen({ x: outer[0].x, y: outer[0].y });
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < outer.length; i++) {
      const s = worldToScreen({ x: outer[i].x, y: outer[i].y });
      ctx.lineTo(s.x, s.y);
    }
    // inner stringer reversed → closes the band along the OTHER long edge.
    for (let i = inner.length - 1; i >= 0; i--) {
      const s = worldToScreen({ x: inner[i].x, y: inner[i].y });
      ctx.lineTo(s.x, s.y);
    }
    ctx.closePath();
    ctx.stroke();
    return;
  }
  drawStairPerimeterOutlineObb(ctx, worldToScreen, stair);
}

/**
 * Fallback halo: a tight Oriented Bounding Box (OBB) in the stair's local frame,
 * used only when the stringers are degenerate. Folds every tread + stringer vertex
 * into `min/max` along the `direction` axes so it wraps the full footprint.
 */
function drawStairPerimeterOutlineObb(
  ctx: CanvasRenderingContext2D,
  worldToScreen: WorldToScreen,
  stair: StairEntity,
): void {
  const params = stair.params;
  const dirRad = (params.direction * Math.PI) / 180;
  const cos = Math.cos(dirRad);
  const sin = Math.sin(dirRad);
  const bp = params.basePoint;

  let uMin = Infinity, uMax = -Infinity, vMin = Infinity, vMax = -Infinity;
  const fold = (px: number, py: number): void => {
    const dx = px - bp.x;
    const dy = py - bp.y;
    const u = cos * dx + sin * dy;
    const v = -sin * dx + cos * dy;
    if (u < uMin) uMin = u;
    if (u > uMax) uMax = u;
    if (v < vMin) vMin = v;
    if (v > vMax) vMax = v;
  };

  for (const tread of stair.geometry.treadsBelowCut) {
    for (const p of tread) fold(p.x, p.y);
  }
  for (const p of stair.geometry.stringers.outer) fold(p.x, p.y);
  for (const p of stair.geometry.stringers.inner) fold(p.x, p.y);

  if (uMin === Infinity) return; // no vertices — defensive

  const localCorners = [
    { u: uMin, v: vMin },
    { u: uMax, v: vMin },
    { u: uMax, v: vMax },
    { u: uMin, v: vMax },
  ];
  ctx.beginPath();
  const first = worldToScreen({
    x: bp.x + cos * localCorners[0].u - sin * localCorners[0].v,
    y: bp.y + sin * localCorners[0].u + cos * localCorners[0].v,
  });
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < localCorners.length; i++) {
    const c = localCorners[i];
    const s = worldToScreen({
      x: bp.x + cos * c.u - sin * c.v,
      y: bp.y + sin * c.u + cos * c.v,
    });
    ctx.lineTo(s.x, s.y);
  }
  ctx.closePath();
  ctx.stroke();
}
