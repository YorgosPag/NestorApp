/**
 * MepBoilerGhostRenderer — ADR-408 Εύρος Β #2 (2D placement ghost).
 *
 * Paints the translucent boiler footprint preview directly onto the preview
 * canvas while the heating boiler tool awaits a position — the 2D counterpart of
 * the 3D `MepBoilerPlacementGhost`, mirror of `MepRadiatorGhostRenderer`. Pure
 * ctx draw in CSS pixels; the caller (leaf hook) supplies the ctx + DPR transform
 * and schedules the redraw (ADR-040 — no React re-render above leaf).
 *
 * Palette mirrors `MepBoilerRenderer` (warm-red) so the preview reads as "exactly
 * what the click creates" (WYSIWYG).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 */

import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import type { BoilerSymbolGeometry } from './mep-boiler-symbol';
import { resolveSegmentClassificationColor } from '../mep-systems/mep-system-color';

/** Warm-red boiler palette — mirror of `MepBoilerRenderer`. */
const BOILER_STROKE = '#dc2626';
const BOILER_FILL = 'rgba(220, 38, 38, 0.28)';
const GHOST_LINE_WIDTH = 2;
/** Thinner weight for the divider/flame glyph — mirrors the placed renderer's THIN. */
const GHOST_GLYPH_LINE_WIDTH = 1.25;
const ANCHOR_MARKER_SIZE_PX = 5;

export interface MepBoilerGhostRenderInput {
  /** Footprint vertices in world/scene units (from `getGhostFootprint`). */
  readonly footprint: ReadonlyArray<{ x: number; y: number }>;
  /** Cursor world position (anchor marker). */
  readonly cursor: Readonly<Point2D>;
  /**
   * Full 2D symbol (connector stubs + flue vent + divider/flame glyph) from
   * `getGhostSymbol`. When present, drawn on top of the footprint so the preview is
   * byte-for-byte what a click commits (WYSIWYG). Optional — falls back to the bare
   * footprint when absent.
   */
  readonly symbol?: Readonly<BoilerSymbolGeometry> | null;
  readonly transform: ViewTransform;
  readonly viewport: { readonly width: number; readonly height: number };
}

export class MepBoilerGhostRenderer {
  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  render(input: Readonly<MepBoilerGhostRenderInput>): void {
    const { footprint, cursor, symbol, transform, viewport } = input;
    if (footprint.length >= 3) {
      this.drawFill(footprint, transform, viewport);
      this.drawOutline(footprint, transform, viewport);
    }
    if (symbol) {
      this.drawSymbol(symbol, transform, viewport);
    }
    this.drawAnchorMarker(cursor, transform, viewport);
  }

  /**
   * Draw the full boiler symbol on top of the footprint (WYSIWYG): connector stubs +
   * flue vent chevron + fuel-cock glyph at `GHOST_LINE_WIDTH`, divider/flame glyph at the
   * thinner `GHOST_GLYPH_LINE_WIDTH` — same read as the placed `MepBoilerRenderer`. Connector
   * stubs are coloured by their System Classification via the `resolveSegmentClassificationColor`
   * SSoT (supply red, return blue, DHW hot/cold, drainage brown, flue exhaust grey); the
   * fuel-cock + body keep the warm-red boiler palette. Strokes arrive in world units (open polylines).
   */
  private drawSymbol(
    symbol: Readonly<BoilerSymbolGeometry>,
    transform: ViewTransform,
    viewport: { readonly width: number; readonly height: number },
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
    ctx.lineWidth = GHOST_LINE_WIDTH;
    for (const { line, classification } of symbol.strokes) {
      ctx.strokeStyle = resolveSegmentClassificationColor(classification) ?? BOILER_STROKE;
      this.traceStroke(line, transform, viewport);
    }
    for (const { line, classification } of symbol.ventStrokes) {
      ctx.strokeStyle = resolveSegmentClassificationColor(classification) ?? BOILER_STROKE;
      this.traceStroke(line, transform, viewport);
    }
    ctx.strokeStyle = BOILER_STROKE;
    for (const stroke of symbol.fuelStrokes) this.traceStroke(stroke, transform, viewport);
    ctx.lineWidth = GHOST_GLYPH_LINE_WIDTH;
    for (const stroke of symbol.glyphStrokes) this.traceStroke(stroke, transform, viewport);
    ctx.restore();
  }

  /** Stroke an OPEN world-space polyline (symbol stub / glyph). */
  private traceStroke(
    points: ReadonlyArray<{ x: number; y: number }>,
    transform: ViewTransform,
    viewport: { readonly width: number; readonly height: number },
  ): void {
    if (points.length < 2) return;
    const ctx = this.ctx;
    ctx.beginPath();
    const first = CoordinateTransforms.worldToScreen({ x: points[0].x, y: points[0].y }, transform, viewport);
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < points.length; i++) {
      const s = CoordinateTransforms.worldToScreen({ x: points[i].x, y: points[i].y }, transform, viewport);
      ctx.lineTo(s.x, s.y);
    }
    ctx.stroke();
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
    ctx.fillStyle = BOILER_FILL;
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
    ctx.strokeStyle = BOILER_STROKE;
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
    ctx.fillStyle = BOILER_STROKE;
    ctx.globalAlpha = 1;
    ctx.fillRect(s.x - half, s.y - half, ANCHOR_MARKER_SIZE_PX, ANCHOR_MARKER_SIZE_PX);
    ctx.restore();
  }
}
