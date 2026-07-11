/**
 * GRIP GHOST PREVIEW — stair ghost draw helper
 *
 * ADR-637 Phase 4-D — the moving STAIR ghost painter. Extracted from
 * `grip-ghost-preview-draw-helpers` (file-size SRP split, N.7.1) and re-exported there so the
 * consuming hook's import path stays unchanged. Pure draw, no subscriptions (ADR-040).
 *
 * @module hooks/tools/grip-ghost-preview-stair-helpers
 * @see hooks/tools/grip-ghost-preview-draw-helpers — re-exports this
 * @see ADR-040 — Preview Canvas Performance
 * @see ADR-637 — Stair rest landings
 */

import type { Point2D, ViewTransform, Viewport } from '../../rendering/types/Types';
import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { resolveGhostStatusColor } from '../../bim/ghosts/ghost-status-color';
import { drawGhostEntity } from '../../rendering/ghost';

/**
 * ADR-637 Phase 4-D (Giorgio 2026-07-11) — paint a moving STAIR ghost in ORANGE during a grip
 * drag, so it clearly stands out from the ORIGINAL stair (which stays painted in its own colour
 * on the main canvas). The default WYSIWYG member-body path (`drawMemberBodyGhostWithJoinMiter`
 * → `drawRealEntityPreview`) repaints the ghost in the stair's OWN colour, so the two overlap
 * indistinguishably — dragging a rest landing looked like nothing moved.
 *
 * Draws the informative skeleton — each TREAD + REST-LANDING outline (thin) so the live re-flow
 * reads (which tread becomes the flat landing, how the run shifts) — plus the STRINGER perimeter
 * (thick) via the SSoT `drawGhostEntity` `'stair'` case (outer fwd + inner reversed). Everything
 * strokes in the shared 'warning' orange (`resolveGhostStatusColor` — same hue as the live
 * column/wall warning outline, zero new hardcoded colour). Pure draw, no subscriptions (ADR-040).
 */
export function drawStairGhostOrange(
  ctx: CanvasRenderingContext2D,
  stairGhost: DxfEntityUnion,
  t: ViewTransform,
  vp: Viewport,
): void {
  const color = resolveGhostStatusColor('warning');
  if (!color) return;
  ctx.save();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = color.stroke;
  ctx.lineJoin = 'round';
  // Treads + rest landings — thin orange outlines (geometry lives on the wrapped stairEntity that
  // `applyEntityPreview` re-derived from the dragged params; falls back to a flat `geometry`).
  const wrapped = stairGhost as unknown as {
    stairEntity?: { geometry?: { treads?: readonly unknown[]; landings?: readonly unknown[] } };
    geometry?: { treads?: readonly unknown[]; landings?: readonly unknown[] };
  };
  const geom = wrapped.stairEntity?.geometry ?? wrapped.geometry;
  if (geom) {
    ctx.lineWidth = 1;
    const toScreen = (p: Point2D) => CoordinateTransforms.worldToScreen(p, t, vp);
    for (const poly of [...(geom.treads ?? []), ...(geom.landings ?? [])]) {
      // ADR-632 trap — a stair Polygon3D is a BARE point array, not `{ vertices }`; guard both.
      const pts = (Array.isArray(poly)
        ? poly
        : (poly as { vertices?: readonly Point2D[] }).vertices) as readonly Point2D[] | undefined;
      if (!pts || pts.length < 2) continue;
      ctx.beginPath();
      const first = toScreen(pts[0]);
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < pts.length; i++) {
        const s = toScreen(pts[i]);
        ctx.lineTo(s.x, s.y);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }
  // Stringer perimeter — thick orange outline via the SSoT stair ghost silhouette.
  ctx.lineWidth = 2;
  drawGhostEntity(ctx, stairGhost, t, vp);
  ctx.restore();
}
