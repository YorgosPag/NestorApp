/**
 * ColumnAnchorGhostRenderer — ADR-363 Phase 4.5c.1.
 *
 * Paints the 9-state anchor ghost preview overlay directly στο preview canvas
 * (no React, no RAF — caller schedules το redraw). Mirror pattern του
 * `useRotationPreview` ghost drawing: pure ctx draw σε CSS pixels, transform
 * supplied από caller.
 *
 * Visual specs:
 *   - Inactive ghost: kind-stroke @15% opacity, no fill, 1px line.
 *   - Active ghost: kind-stroke @100% opacity, kind-fill @30% opacity, 2px line.
 *   - Anchor marker: 5×5 px filled square στο cursor world position (κοινό
 *     σε όλα τα ghosts του frame). Kind-coloured.
 *
 * SSoT:
 *   - Stroke/fill palette mirror `ColumnRenderer.KIND_STROKE` / `KIND_FILL`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.6 §6 Phase 4.5c.1
 */

import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import type { ColumnKind } from '../types/column-types';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import type { AnchorGhost } from './column-anchor-ghosts';

/** Stroke colour per kind. Mirror του `ColumnRenderer.KIND_STROKE`. */
const KIND_STROKE: Readonly<Record<ColumnKind, string>> = {
  'rectangular': '#5b6478',
  'circular':    '#3a3a40',
  'L-shape':     '#a07a2b',
  'T-shape':     '#3a5a78',
  'polygon':     '#4a5566',
  'shear-wall':  '#5b6478',
  'I-shape':     '#2f3b4d',
  // ADR-363 Phase 2 «από περίγραμμα» — τοιχία ΟΣ (ίδια απόχρωση με shear-wall).
  'U-shape':     '#5b6478',
  'composite':   '#5b6478',
};

/** Active-ghost fill (rgba @30% opacity). Mirror της `ColumnRenderer.KIND_FILL`
 *  λογικής αλλά λίγο πιο intense ώστε το active ghost να ξεχωρίζει από τα
 *  hovered columns. */
const KIND_FILL_ACTIVE: Readonly<Record<ColumnKind, string>> = {
  'rectangular': 'rgba(140, 158, 178, 0.30)',
  'circular':    'rgba(96, 96, 102, 0.30)',
  'L-shape':     'rgba(192, 148, 56, 0.30)',
  'T-shape':     'rgba(110, 140, 178, 0.30)',
  'polygon':     'rgba(120, 138, 158, 0.30)',
  'shear-wall':  'rgba(140, 158, 178, 0.30)',
  'I-shape':     'rgba(90, 110, 138, 0.30)',
  // ADR-363 Phase 2 «από περίγραμμα» — τοιχία ΟΣ (ίδιο fill με shear-wall).
  'U-shape':     'rgba(140, 158, 178, 0.30)',
  'composite':   'rgba(140, 158, 178, 0.30)',
};

const INACTIVE_OPACITY = 0.15;
const INACTIVE_LINE_WIDTH = 1;
const ACTIVE_LINE_WIDTH = 2;
const ANCHOR_MARKER_SIZE_PX = 5;

export interface ColumnAnchorGhostRenderInput {
  readonly ghosts: readonly AnchorGhost[];
  readonly kind: ColumnKind;
  readonly transform: ViewTransform;
  readonly viewport: { readonly width: number; readonly height: number };
}

/**
 * Pure renderer class. Constructor takes a `CanvasRenderingContext2D` — caller
 * (leaf component) supplies the preview canvas ctx + sizes ctx transform via
 * the DPR scheme matching `useRotationPreview`.
 */
export class ColumnAnchorGhostRenderer {
  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  render(input: Readonly<ColumnAnchorGhostRenderInput>): void {
    const { ghosts, kind, transform, viewport } = input;
    if (ghosts.length === 0) return;
    const stroke = KIND_STROKE[kind];
    const fillActive = KIND_FILL_ACTIVE[kind];

    // 1) Inactive ghosts first (background layer).
    for (const g of ghosts) {
      if (g.isActive) continue;
      this.drawGhostOutline(g.footprint.vertices, transform, viewport, stroke, INACTIVE_OPACITY, INACTIVE_LINE_WIDTH);
    }

    // 2) Active ghost on top (fill + bold stroke).
    const active = ghosts.find((g) => g.isActive);
    if (active) {
      this.drawGhostFill(active.footprint.vertices, transform, viewport, fillActive);
      this.drawGhostOutline(active.footprint.vertices, transform, viewport, stroke, 1, ACTIVE_LINE_WIDTH);
    }

    // 3) Anchor marker (cursor) — shared by όλα τα ghosts του frame.
    const cursor = ghosts[0].cursorPos;
    this.drawAnchorMarker(cursor, transform, viewport, stroke);
  }

  private drawGhostOutline(
    vertices: ReadonlyArray<{ x: number; y: number }>,
    transform: ViewTransform,
    viewport: { readonly width: number; readonly height: number },
    stroke: string,
    opacity: number,
    lineWidth: number,
  ): void {
    if (vertices.length < 3) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.globalAlpha = opacity;
    ctx.setLineDash([]);
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

  private drawGhostFill(
    vertices: ReadonlyArray<{ x: number; y: number }>,
    transform: ViewTransform,
    viewport: { readonly width: number; readonly height: number },
    fill: string,
  ): void {
    if (vertices.length < 3) return;
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

  private drawAnchorMarker(
    cursor: Readonly<Point2D>,
    transform: ViewTransform,
    viewport: { readonly width: number; readonly height: number },
    stroke: string,
  ): void {
    const s = CoordinateTransforms.worldToScreen(cursor, transform, viewport);
    const half = ANCHOR_MARKER_SIZE_PX / 2;
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = stroke;
    ctx.globalAlpha = 1;
    ctx.fillRect(s.x - half, s.y - half, ANCHOR_MARKER_SIZE_PX, ANCHOR_MARKER_SIZE_PX);
    ctx.restore();
  }
}
