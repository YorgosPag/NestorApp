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

import type { Point2D } from '../../rendering/types/Types';
import type { OverlayProjector } from './overlay-projector';
import type { TrackingPalette } from './tracking-colors';
import type { AcquiredTrackingPoint } from '../../systems/tracking/TrackingPointStore';
import type { TrackingAlignmentPath } from '../../systems/tracking/tracking-resolver';
import { applyOverlayLineStyle, OVERLAY_LINE_WIDTH_PX, OVERLAY_LINE_COLORS } from './overlay-line-style';
import { drawOverlayLabel } from './overlay-text-style';

/** Acquired-point `+` glyphs (persist across drawPreview cycles). */
export function paintTrackingMarkers(
  ctx: CanvasRenderingContext2D,
  markers: readonly AcquiredTrackingPoint[],
  project: OverlayProjector,
  palette: TrackingPalette,
): void {
  const SIZE = 7;
  ctx.save();
  ctx.setLineDash([]); // `+` glyph = solid point-indicator (not a dashed guide line)
  ctx.strokeStyle = palette.acquiredMarker;
  ctx.lineWidth = OVERLAY_LINE_WIDTH_PX; // SSoT 0.5px (shared width)
  ctx.globalAlpha = 0.95;
  for (const m of markers) {
    const s = project({ x: m.x, y: m.y });
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
  project: OverlayProjector,
  palette: TrackingPalette,
): void {
  if (paths.length === 0) return;
  const EXTEND = 6000;
  ctx.save();
  applyOverlayLineStyle(ctx, OVERLAY_LINE_COLORS.alignment); // SSoT: 0.5px dashed [8,5], light grey
  ctx.globalAlpha = 0.75;
  for (const path of paths) {
    const origin = project(path.origin);
    // Screen-space direction derived from the projector (projection-agnostic, ADR-544): project a
    // 2nd point one world-unit along the path dir and subtract → the projector owns the Y-flip.
    const ahead = project({ x: path.origin.x + path.dx, y: path.origin.y + path.dy });
    const sdx = ahead.x - origin.x;
    const sdy = ahead.y - origin.y;
    const len = Math.hypot(sdx, sdy) || 1;
    const ux = sdx / len, uy = sdy / len;
    ctx.beginPath();
    ctx.moveTo(origin.x - ux * EXTEND, origin.y - uy * EXTEND);
    ctx.lineTo(origin.x + ux * EXTEND, origin.y + uy * EXTEND);
    ctx.stroke();
  }
  ctx.restore();
}

/** Intersection halos where alignment paths cross. */
export function paintIntersections(
  ctx: CanvasRenderingContext2D,
  intersections: readonly Point2D[],
  project: OverlayProjector,
  palette: TrackingPalette,
): void {
  if (intersections.length === 0) return;
  const RADIUS = 6;
  ctx.save();
  ctx.setLineDash([]); // halo ring = solid point-indicator (not a dashed guide line)
  ctx.strokeStyle = palette.intersectionStroke;
  ctx.fillStyle = palette.intersectionFill;
  ctx.lineWidth = OVERLAY_LINE_WIDTH_PX; // SSoT 0.5px (shared width)
  ctx.globalAlpha = 0.9;
  for (const pt of intersections) {
    const s = project(pt);
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
  project: OverlayProjector,
  palette: TrackingPalette,
): void {
  if (!label) return;
  const screen = project(snappedPoint);
  // SSoT overlay label (font only, no background). Light grey to match the alignment line.
  drawOverlayLabel(ctx, label, screen.x + 14, screen.y - 12, {
    textColor: OVERLAY_LINE_COLORS.alignment,
    align: 'left',
  });
}
