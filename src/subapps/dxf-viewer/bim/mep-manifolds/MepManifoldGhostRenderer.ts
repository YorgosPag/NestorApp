/**
 * MepManifoldGhostRenderer — ADR-408 Φ12 (2D placement ghost).
 *
 * Paints the translucent manifold footprint preview directly onto the preview
 * canvas while the plumbing manifold tool awaits a position — the 2D counterpart
 * of the 3D `MepManifoldPlacementGhost`, mirror of `ElectricalPanelGhostRenderer`.
 * Pure ctx draw in CSS pixels; the caller (leaf hook) supplies the ctx + DPR
 * transform and schedules the redraw (ADR-040 — no React re-render above leaf).
 *
 * Palette mirrors `MepManifoldRenderer` (cyan-teal) so the preview reads as
 * "exactly what the click creates" (WYSIWYG).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 */

import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';

/** Cyan-teal manifold palette — mirror of `MepManifoldRenderer`. */
const MANIFOLD_STROKE = '#0891b2';
const MANIFOLD_FILL = 'rgba(8, 145, 178, 0.30)';
const GHOST_LINE_WIDTH = 2;
const ANCHOR_MARKER_SIZE_PX = 5;

export interface MepManifoldGhostRenderInput {
  /** Footprint vertices in world/scene units (from `getGhostFootprint`). */
  readonly footprint: ReadonlyArray<{ x: number; y: number }>;
  /** Cursor world position (anchor marker). */
  readonly cursor: Readonly<Point2D>;
  readonly transform: ViewTransform;
  readonly viewport: { readonly width: number; readonly height: number };
}

export class MepManifoldGhostRenderer {
  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  render(input: Readonly<MepManifoldGhostRenderInput>): void {
    const { footprint, cursor, transform, viewport } = input;
    if (footprint.length >= 3) {
      this.drawFill(footprint, transform, viewport);
      this.drawOutline(footprint, transform, viewport);
    }
    this.drawAnchorMarker(cursor, transform, viewport);
  }

  private tracePath(
    vertices: ReadonlyArray<{ x: number; y: number }>,
    transform: ViewTransform,
    viewport: { readonly width: number; readonly height: number },
  ): void {
    const ctx = this.ctx;
    ctx.beginPath();
    const first = CoordinateTransforms.worldToScreen({ x: vertices[0].x, y: vertices[0].y }, transform, viewport);
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < vertices.length; i++) {
      const s = CoordinateTransforms.worldToScreen({ x: vertices[i].x, y: vertices[i].y }, transform, viewport);
      ctx.lineTo(s.x, s.y);
    }
    ctx.closePath();
  }

  private drawFill(
    vertices: ReadonlyArray<{ x: number; y: number }>,
    transform: ViewTransform,
    viewport: { readonly width: number; readonly height: number },
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = MANIFOLD_FILL;
    this.tracePath(vertices, transform, viewport);
    ctx.fill();
    ctx.restore();
  }

  private drawOutline(
    vertices: ReadonlyArray<{ x: number; y: number }>,
    transform: ViewTransform,
    viewport: { readonly width: number; readonly height: number },
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = MANIFOLD_STROKE;
    ctx.lineWidth = GHOST_LINE_WIDTH;
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
    this.tracePath(vertices, transform, viewport);
    ctx.stroke();
    ctx.restore();
  }

  private drawAnchorMarker(
    cursor: Readonly<Point2D>,
    transform: ViewTransform,
    viewport: { readonly width: number; readonly height: number },
  ): void {
    const s = CoordinateTransforms.worldToScreen(cursor, transform, viewport);
    const half = ANCHOR_MARKER_SIZE_PX / 2;
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = MANIFOLD_STROKE;
    ctx.globalAlpha = 1;
    ctx.fillRect(s.x - half, s.y - half, ANCHOR_MARKER_SIZE_PX, ANCHOR_MARKER_SIZE_PX);
    ctx.restore();
  }
}
