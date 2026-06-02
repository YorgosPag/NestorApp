/**
 * MepFixtureGhostRenderer — ADR-406 (2D placement ghost).
 *
 * Paints the translucent fixture footprint preview directly onto the preview
 * canvas while the MEP fixture tool awaits a position — the 2D counterpart of
 * the 3D `MepFixturePlacementGhost`, and the mirror of `ColumnAnchorGhostRenderer`
 * (a fixture has a single footprint, not 9 anchor variants). Pure ctx draw in
 * CSS pixels; the caller (leaf hook) supplies the ctx + DPR transform and
 * schedules the redraw (ADR-040 — no React re-render above the leaf).
 *
 * Palette mirrors `MepFixtureRenderer` (amber luminaire) so the preview reads as
 * "exactly what the click creates" (WYSIWYG).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-406-point-based-mep-fixture.md
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 */

import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';

/** Amber luminaire palette — mirror of `MepFixtureRenderer`. */
const FIXTURE_STROKE = '#d97706';
const FIXTURE_FILL = 'rgba(251, 191, 36, 0.30)';
const GHOST_LINE_WIDTH = 2;
const ANCHOR_MARKER_SIZE_PX = 5;

export interface MepFixtureGhostRenderInput {
  /** Footprint vertices in world/scene units (from `useMepFixtureTool.getGhostFootprint`). */
  readonly footprint: ReadonlyArray<{ x: number; y: number }>;
  /** Cursor world position (anchor marker). */
  readonly cursor: Readonly<Point2D>;
  readonly transform: ViewTransform;
  readonly viewport: { readonly width: number; readonly height: number };
}

export class MepFixtureGhostRenderer {
  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  render(input: Readonly<MepFixtureGhostRenderInput>): void {
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
    ctx.fillStyle = FIXTURE_FILL;
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
    ctx.strokeStyle = FIXTURE_STROKE;
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
    ctx.fillStyle = FIXTURE_STROKE;
    ctx.globalAlpha = 1;
    ctx.fillRect(s.x - half, s.y - half, ANCHOR_MARKER_SIZE_PX, ANCHOR_MARKER_SIZE_PX);
    ctx.restore();
  }
}
