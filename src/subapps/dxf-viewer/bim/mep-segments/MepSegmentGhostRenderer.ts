/**
 * MepSegmentGhostRenderer — ADR-408 Φ8 (2D placement ghost).
 *
 * Paints the translucent segment outline preview (a rubber-band offset-rectangle
 * from the already-committed start point to the live cursor) directly onto the
 * preview canvas while the MEP segment tool awaits the second click (end point).
 *
 * Design:
 *   - During `awaitingEnd`, the caller provides `startPoint` (world, fixed) +
 *     `cursor` (world, live). This renderer builds the offset rectangle from
 *     the segment axis `startPoint → cursor` using the current section width,
 *     and draws it in the domain-specific palette colour.
 *   - Palette: duct = blue (mechanical), pipe = teal (plumbing) — differentiates
 *     from the amber electrical fixture, grey wall, etc.
 *
 * Pure ctx draw in CSS pixels; the caller (leaf hook) supplies the ctx + DPR
 * transform and schedules the redraw via RAF (ADR-040 — no React re-render above
 * the leaf).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md §Φ8
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 */

import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import type { MepSegmentDomain } from '../types/mep-segment-types';

// ─── Palette ──────────────────────────────────────────────────────────────────

/** Duct (mechanical/HVAC) ghost palette — blue, matching convention. */
const DUCT_STROKE = '#2563eb';
const DUCT_FILL   = 'rgba(96, 165, 250, 0.25)';

/** Pipe (plumbing) ghost palette — teal. */
const PIPE_STROKE = '#0891b2';
const PIPE_FILL   = 'rgba(34, 211, 238, 0.25)';

const GHOST_LINE_WIDTH    = 2;
const AXIS_LINE_WIDTH     = 1;
const ANCHOR_MARKER_SIZE  = 5;

// ─── Input ────────────────────────────────────────────────────────────────────

export interface MepSegmentGhostRenderInput {
  /**
   * Fixed start point (world / canvas units) — the first click of the 2-click
   * tool, passed through unchanged from `useMepSegmentTool`.
   */
  readonly startPoint: Readonly<Point2D>;
  /**
   * Live cursor world position (second click pending). The outline rectangle is
   * built from `startPoint → cursor` with half-width = `sectionWidthCanvas / 2`.
   */
  readonly cursor: Readonly<Point2D>;
  /**
   * Section width in canvas units (mirrors the render-time value used by the
   * committed segment; derived from `resolveSegmentSection(params)` + scene-units
   * conversion, or a default from the tool's current params).
   */
  readonly sectionWidthCanvas: number;
  /** MEP domain — selects the default palette colour (duct = blue, pipe = teal). */
  readonly domain: MepSegmentDomain;
  /**
   * ADR-426 Slice 2 — optional palette override. The water auto-design proposal
   * ghost reuses this renderer but paints cold vs hot runs in distinct colours
   * (teal / warm-red); when present these win over the domain default. Leaving
   * them undefined preserves the manual-tool behaviour unchanged.
   */
  readonly strokeOverride?: string;
  readonly fillOverride?: string;
  readonly transform: ViewTransform;
  readonly viewport: { readonly width: number; readonly height: number };
}

// ─── Renderer ─────────────────────────────────────────────────────────────────

export class MepSegmentGhostRenderer {
  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  render(input: Readonly<MepSegmentGhostRenderInput>): void {
    const { startPoint, cursor, sectionWidthCanvas, domain, transform, viewport } = input;

    const stroke = input.strokeOverride ?? (domain === 'duct' ? DUCT_STROKE : PIPE_STROKE);
    const fill   = input.fillOverride   ?? (domain === 'duct' ? DUCT_FILL   : PIPE_FILL);

    // Build the rubber-band offset rectangle: four corners of (start→cursor) ±half-width.
    const outline = buildOutlineRect(startPoint, cursor, sectionWidthCanvas);
    if (outline !== null) {
      this.drawFill(outline, fill, transform, viewport);
      this.drawOutline(outline, stroke, transform, viewport);
    }

    // Always draw the centreline axis rubber-band + start-point anchor marker.
    this.drawAxis(startPoint, cursor, stroke, transform, viewport);
    this.drawAnchorMarker(startPoint, stroke, transform, viewport);
    this.drawAnchorMarker(cursor, stroke, transform, viewport);
  }

  private drawFill(
    verts: ReadonlyArray<Point2D>,
    fillStyle: string,
    transform: ViewTransform,
    viewport: { readonly width: number; readonly height: number },
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = fillStyle;
    tracePolygon(ctx, verts, transform, viewport);
    ctx.fill();
    ctx.restore();
  }

  private drawOutline(
    verts: ReadonlyArray<Point2D>,
    strokeStyle: string,
    transform: ViewTransform,
    viewport: { readonly width: number; readonly height: number },
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = GHOST_LINE_WIDTH;
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
    tracePolygon(ctx, verts, transform, viewport);
    ctx.stroke();
    ctx.restore();
  }

  /** Dashed centreline from start → cursor (rubber-band feedback). */
  private drawAxis(
    start: Readonly<Point2D>,
    end: Readonly<Point2D>,
    strokeStyle: string,
    transform: ViewTransform,
    viewport: { readonly width: number; readonly height: number },
  ): void {
    const s = CoordinateTransforms.worldToScreen(start, transform, viewport);
    const e = CoordinateTransforms.worldToScreen(end, transform, viewport);
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = AXIS_LINE_WIDTH;
    ctx.globalAlpha = 0.7;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(e.x, e.y);
    ctx.stroke();
    ctx.restore();
  }

  /** Small filled square anchor marker at a world point (start or cursor). */
  private drawAnchorMarker(
    pos: Readonly<Point2D>,
    fillStyle: string,
    transform: ViewTransform,
    viewport: { readonly width: number; readonly height: number },
  ): void {
    const s = CoordinateTransforms.worldToScreen(pos, transform, viewport);
    const half = ANCHOR_MARKER_SIZE / 2;
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = fillStyle;
    ctx.globalAlpha = 1;
    ctx.fillRect(s.x - half, s.y - half, ANCHOR_MARKER_SIZE, ANCHOR_MARKER_SIZE);
    ctx.restore();
  }
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Build the plan-view outline rectangle (4 CCW vertices) for a segment axis
 * `start → end` with section half-width `halfW`. Returns null when the axis is
 * degenerate (start === end) so the caller can skip the fill/stroke.
 */
function buildOutlineRect(
  start: Readonly<Point2D>,
  end: Readonly<Point2D>,
  sectionWidthCanvas: number,
): [Point2D, Point2D, Point2D, Point2D] | null {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return null;

  const ux = dx / len;
  const uy = dy / len;
  // CCW perpendicular: (x, y) → (-y, x)
  const px = -uy;
  const py =  ux;
  const half = sectionWidthCanvas / 2;

  // Four corners: start±perp then end±perp (CCW winding)
  return [
    { x: start.x + px * half, y: start.y + py * half },
    { x: start.x - px * half, y: start.y - py * half },
    { x: end.x   - px * half, y: end.y   - py * half },
    { x: end.x   + px * half, y: end.y   + py * half },
  ];
}

function tracePolygon(
  ctx: CanvasRenderingContext2D,
  verts: ReadonlyArray<Point2D>,
  transform: ViewTransform,
  viewport: { readonly width: number; readonly height: number },
): void {
  ctx.beginPath();
  const first = CoordinateTransforms.worldToScreen(verts[0], transform, viewport);
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < verts.length; i++) {
    const s = CoordinateTransforms.worldToScreen(verts[i], transform, viewport);
    ctx.lineTo(s.x, s.y);
  }
  ctx.closePath();
}
