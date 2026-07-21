/**
 * Shared «rubber band» leader paint — the gold dashed pivot→cursor line drawn by the Move and Rotation
 * previews (and any future transform preview). ONE SSoT for the style so the two gestures cannot drift
 * (extracted 2026-07-12 — CHECK 3.28 de-dup of the pre-existing Move/Rotation twins).
 */

import type { Point2D, ViewTransform, Viewport } from '../../rendering/types/Types';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';

/** Gold dashed straight leader between two SCREEN-space points (pivot → cursor). */
export function drawRubberBandLine(
  ctx: CanvasRenderingContext2D,
  fromScreen: Point2D,
  toScreen: Point2D,
): void {
  ctx.save();
  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(fromScreen.x, fromScreen.y);
  ctx.lineTo(toScreen.x, toScreen.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

/**
 * WORLD-space convenience twin — projects both endpoints then draws the leader.
 * ONE SSoT for the base→destination rubber band shared by the Move + Copy previews
 * (N.18 — no parallel `worldToScreen ×2 + drawRubberBandLine` triplets in each hook).
 */
export function drawRubberBandWorld(
  ctx: CanvasRenderingContext2D,
  fromWorld: Point2D,
  toWorld: Point2D,
  transform: ViewTransform,
  viewport: Viewport,
): void {
  drawRubberBandLine(
    ctx,
    CoordinateTransforms.worldToScreen(fromWorld, transform, viewport),
    CoordinateTransforms.worldToScreen(toWorld, transform, viewport),
  );
}
