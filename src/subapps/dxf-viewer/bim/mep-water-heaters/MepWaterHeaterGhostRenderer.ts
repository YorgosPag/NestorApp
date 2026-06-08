/**
 * MepWaterHeaterGhostRenderer — ADR-408 DHW (2D placement ghost).
 *
 * Paints the translucent water heater footprint preview directly onto the preview
 * canvas while the domestic hot water heater tool awaits a position — the 2D counterpart
 * of the 3D `MepWaterHeaterPlacementGhost`, mirror of `MepBoilerGhostRenderer`. Pure
 * ctx draw in CSS pixels; the caller (leaf hook) supplies the ctx + DPR transform
 * and schedules the redraw (ADR-040 — no React re-render above leaf).
 *
 * Palette mirrors `MepWaterHeaterRenderer` (blue-cyan) so the preview reads as "exactly
 * what the click creates" (WYSIWYG).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 */

import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';

/** Blue-cyan water heater palette — mirror of `MepWaterHeaterRenderer`. */
const WATER_HEATER_STROKE = '#0284c7';
const WATER_HEATER_FILL = 'rgba(2, 132, 199, 0.28)';
const GHOST_LINE_WIDTH = 2;
const ANCHOR_MARKER_SIZE_PX = 5;

export interface MepWaterHeaterGhostRenderInput {
  /** Footprint vertices in world/scene units (from `getGhostFootprint`). */
  readonly footprint: ReadonlyArray<{ x: number; y: number }>;
  /** Cursor world position (anchor marker). */
  readonly cursor: Readonly<Point2D>;
  readonly transform: ViewTransform;
  readonly viewport: { readonly width: number; readonly height: number };
}

export class MepWaterHeaterGhostRenderer {
  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  render(input: Readonly<MepWaterHeaterGhostRenderInput>): void {
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
    ctx.fillStyle = WATER_HEATER_FILL;
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
    ctx.strokeStyle = WATER_HEATER_STROKE;
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
    ctx.fillStyle = WATER_HEATER_STROKE;
    ctx.globalAlpha = 1;
    ctx.fillRect(s.x - half, s.y - half, ANCHOR_MARKER_SIZE_PX, ANCHOR_MARKER_SIZE_PX);
    ctx.restore();
  }
}
