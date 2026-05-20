/**
 * SlabOpeningGhostRenderer — ADR-363 Phase 3.7b+.
 *
 * Pure canvas renderer for slab-opening placement ghost preview. Draws a
 * dashed-stroke rectangle + 25% opacity fill + centre crosshair marker.
 * No React, no RAF — caller (useSlabOpeningGhostPreview) schedules redraws.
 *
 * Pattern: mirror ColumnAnchorGhostRenderer (Phase 4.5c.1).
 * Palette: mirror SlabRenderer kind colours.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.5 Phase 3.7b+
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 */

import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import type { SlabOpeningKind } from '../types/slab-opening-types';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';

const KIND_STROKE: Readonly<Record<SlabOpeningKind, string>> = {
  shaft:   '#5b4a78',
  well:    '#3a5a78',
  duct:    '#3a5a3a',
  chimney: '#7a3a3a',
};

const KIND_FILL: Readonly<Record<SlabOpeningKind, string>> = {
  shaft:   'rgba(140,110,178,0.25)',
  well:    'rgba(80,140,180,0.25)',
  duct:    'rgba(80,160,80,0.25)',
  chimney: 'rgba(180,80,80,0.25)',
};

const DASH_PATTERN = [6, 4] as const;
const LINE_WIDTH = 1.5;
const CROSSHAIR_HALF_PX = 10;

export interface SlabOpeningGhostRenderInput {
  /** 4 rectangle vertices in mm world coords (CCW). */
  readonly vertices: ReadonlyArray<{ x: number; y: number }>;
  readonly kind: SlabOpeningKind;
  readonly transform: ViewTransform;
  readonly viewport: { readonly width: number; readonly height: number };
}

/**
 * Pure renderer. Constructor receives a `CanvasRenderingContext2D` whose DPR
 * transform is already applied by the caller — same contract as
 * `ColumnAnchorGhostRenderer`.
 */
export class SlabOpeningGhostRenderer {
  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  render(input: Readonly<SlabOpeningGhostRenderInput>): void {
    const { vertices, kind, transform, viewport } = input;
    if (vertices.length < 3) return;
    const stroke = KIND_STROKE[kind];
    const fill = KIND_FILL[kind];

    this.drawFill(vertices, transform, viewport, fill);
    this.drawOutline(vertices, transform, viewport, stroke);

    // Centre crosshair — average of all vertices (rectangle → exact center).
    const cx = vertices.reduce((s, v) => s + v.x, 0) / vertices.length;
    const cy = vertices.reduce((s, v) => s + v.y, 0) / vertices.length;
    this.drawCrosshair({ x: cx, y: cy }, transform, viewport, stroke);
  }

  private drawFill(
    vertices: ReadonlyArray<{ x: number; y: number }>,
    transform: ViewTransform,
    viewport: { readonly width: number; readonly height: number },
    fill: string,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = fill;
    ctx.beginPath();
    const first = CoordinateTransforms.worldToScreen({ x: vertices[0].x, y: vertices[0].y }, transform, viewport);
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < vertices.length; i++) {
      const s = CoordinateTransforms.worldToScreen({ x: vertices[i].x, y: vertices[i].y }, transform, viewport);
      ctx.lineTo(s.x, s.y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawOutline(
    vertices: ReadonlyArray<{ x: number; y: number }>,
    transform: ViewTransform,
    viewport: { readonly width: number; readonly height: number },
    stroke: string,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = LINE_WIDTH;
    ctx.setLineDash([...DASH_PATTERN]);
    ctx.beginPath();
    const first = CoordinateTransforms.worldToScreen({ x: vertices[0].x, y: vertices[0].y }, transform, viewport);
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < vertices.length; i++) {
      const s = CoordinateTransforms.worldToScreen({ x: vertices[i].x, y: vertices[i].y }, transform, viewport);
      ctx.lineTo(s.x, s.y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  private drawCrosshair(
    centerWorld: Readonly<Point2D>,
    transform: ViewTransform,
    viewport: { readonly width: number; readonly height: number },
    stroke: string,
  ): void {
    const s = CoordinateTransforms.worldToScreen(centerWorld, transform, viewport);
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.moveTo(s.x - CROSSHAIR_HALF_PX, s.y);
    ctx.lineTo(s.x + CROSSHAIR_HALF_PX, s.y);
    ctx.moveTo(s.x, s.y - CROSSHAIR_HALF_PX);
    ctx.lineTo(s.x, s.y + CROSSHAIR_HALF_PX);
    ctx.stroke();
    ctx.restore();
  }
}
