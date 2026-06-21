/**
 * SSOT — tracking-paint (ADR-357 Phase 4 — Object Snap Tracking visuals)
 *
 * Pure 2D-canvas paint helpers for the PreviewRenderer's Object Snap Tracking
 * overlay: acquired `+` markers, dashed alignment paths, intersection halos and
 * the snapped-distance tooltip. Extracted from PreviewRenderer (SRP / 500-line
 * cap) — caller supplies the ctx + transform + viewport + theme palette.
 *
 * @see PreviewRenderer — sole caller
 * @see systems/tracking/TrackingPointStore — acquired markers source
 */

import type { Point2D, ViewTransform, Viewport } from '../../rendering/types/Types';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import type { TrackingPalette } from './tracking-colors';
import type { AcquiredTrackingPoint } from '../../systems/tracking/TrackingPointStore';
import type { TrackingAlignmentPath } from '../../systems/tracking/tracking-resolver';
import { applyOverlayLineStyle } from './overlay-line-style';
import { drawOverlayLabel } from './overlay-text-style';

/** Acquired-point `+` glyphs (persist across drawPreview cycles). */
export function paintTrackingMarkers(
  ctx: CanvasRenderingContext2D,
  markers: readonly AcquiredTrackingPoint[],
  transform: ViewTransform,
  viewport: Viewport,
  palette: TrackingPalette,
): void {
  const SIZE = 7;
  ctx.save();
  ctx.setLineDash([]);
  ctx.strokeStyle = palette.acquiredMarker;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.95;
  for (const m of markers) {
    const s = CoordinateTransforms.worldToScreen({ x: m.x, y: m.y }, transform, viewport);
    ctx.beginPath();
    ctx.moveTo(s.x - SIZE, s.y);
    ctx.lineTo(s.x + SIZE, s.y);
    ctx.moveTo(s.x, s.y - SIZE);
    ctx.lineTo(s.x, s.y + SIZE);
    ctx.stroke();
  }
  ctx.restore();
}

/** Dashed alignment paths emanating from acquired points (extended both ways). */
export function paintAlignmentPaths(
  ctx: CanvasRenderingContext2D,
  paths: readonly TrackingAlignmentPath[],
  transform: ViewTransform,
  viewport: Viewport,
  palette: TrackingPalette,
): void {
  if (paths.length === 0) return;
  const EXTEND = 6000;
  ctx.save();
  applyOverlayLineStyle(ctx, palette.alignmentPath); // SSoT: 0.5px dashed [8,5]
  ctx.globalAlpha = 0.75;
  for (const path of paths) {
    const origin = CoordinateTransforms.worldToScreen(path.origin, transform, viewport);
    // Flip Y for screen space (world is Y-up, screen Y-down).
    const sdx = path.dx;
    const sdy = -path.dy;
    ctx.beginPath();
    ctx.moveTo(origin.x - sdx * EXTEND, origin.y - sdy * EXTEND);
    ctx.lineTo(origin.x + sdx * EXTEND, origin.y + sdy * EXTEND);
    ctx.stroke();
  }
  ctx.restore();
}

/** Intersection halos where alignment paths cross. */
export function paintIntersections(
  ctx: CanvasRenderingContext2D,
  intersections: readonly Point2D[],
  transform: ViewTransform,
  viewport: Viewport,
  palette: TrackingPalette,
): void {
  if (intersections.length === 0) return;
  const RADIUS = 6;
  ctx.save();
  ctx.setLineDash([]);
  ctx.strokeStyle = palette.intersectionStroke;
  ctx.fillStyle = palette.intersectionFill;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.9;
  for (const pt of intersections) {
    const s = CoordinateTransforms.worldToScreen(pt, transform, viewport);
    ctx.beginPath();
    ctx.arc(s.x, s.y, RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

/** Snapped-distance tooltip near the cursor. */
export function paintTooltip(
  ctx: CanvasRenderingContext2D,
  snappedPoint: Point2D,
  label: string | null,
  transform: ViewTransform,
  viewport: Viewport,
  palette: TrackingPalette,
): void {
  if (!label) return;
  const screen = CoordinateTransforms.worldToScreen(snappedPoint, transform, viewport);
  // SSoT overlay label (font only, no background). Colour stays per-palette.
  drawOverlayLabel(ctx, label, screen.x + 14, screen.y - 12, {
    textColor: palette.tooltipText,
    align: 'left',
  });
}
