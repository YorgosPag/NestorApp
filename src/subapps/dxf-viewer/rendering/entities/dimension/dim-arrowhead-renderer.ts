/**
 * ADR-362 Phase C1 — Arrowhead stamping.
 *
 * Takes an `ArrowheadBlockDefinition` (Phase A2 — unit space, apex at [0, 0],
 * body extending toward -X) and renders it at a given world anchor + outward
 * direction. Caller pre-converts the anchor to screen coords; this module
 * applies the affine transform (translate → rotate → scale) and stamps each
 * primitive.
 *
 * Conventions (mirrors `dim-arrowhead-blocks.ts` doc):
 *   - Anchor = arrow tip (lies at dim line endpoint / leader tip / extension).
 *   - Direction = OUTWARD unit vector. The block's native -X apex is aligned
 *     with this vector so the arrow body extends back into the dim line.
 *   - Single-arrow case (radial / ordinate) — caller skips this side when the
 *     direction vector is zero (length < EPSILON).
 *   - `flipOnSecondArrow` blocks (architecturalTick / oblique / openSlanted /
 *     integral) are rotated an extra 180° on the second arrow so the tick
 *     points the right way at the opposite endpoint.
 *
 * Sizing: `pixelsPerMm × style.dimasz × style.dimscale` gives the screen-space
 * unit length (1 unit = 1 dimasz mm-paper × dimscale). Caller supplies the
 * pixels-per-mm factor based on the active view scale.
 */

import type {
  ArrowheadBlockDefinition,
  ArrowheadCircle,
  ArrowheadLine,
  ArrowheadPrimitive,
  ArrowheadTriangle,
} from '../../../systems/dimensions/dim-arrowhead-blocks';
import type { Point2D } from '../../types/Types';

/** Length below which a direction vector is treated as "no arrow on this side". */
const ARROW_DIRECTION_EPSILON = 1e-9;

export interface ArrowheadRenderParams {
  readonly screenAnchor: Point2D;
  /** World-space outward unit vector (caller may pass any length; we read its angle). */
  readonly direction: Point2D;
  /** Arrow side index — `2` triggers a 180° flip for `flipOnSecondArrow` blocks. */
  readonly side: 1 | 2;
  /** Screen-space length of one unit (= dimasz mm-paper × dimscale × pxPerMm). */
  readonly unitPx: number;
  readonly strokeColor: string;
  readonly fillColor: string;
}

/**
 * Render one arrowhead onto the canvas 2D context. No-op for `none` blocks or
 * zero-length direction vectors (single-arrow case).
 */
export function renderArrowhead(
  ctx: CanvasRenderingContext2D,
  block: ArrowheadBlockDefinition,
  params: ArrowheadRenderParams,
): void {
  if (block.geometry.length === 0) return;
  const dirLen = Math.hypot(params.direction.x, params.direction.y);
  if (dirLen < ARROW_DIRECTION_EPSILON) return;

  ctx.save();
  ctx.translate(params.screenAnchor.x, params.screenAnchor.y);
  // Screen Y-flip vs world Y-up: invert the angle so the arrow points where
  // the caller expects (matches ADR-344 text rotation convention).
  const angle = -Math.atan2(params.direction.y, params.direction.x);
  ctx.rotate(angle);
  if (params.side === 2 && block.flipOnSecondArrow) {
    ctx.rotate(Math.PI);
  }
  ctx.scale(params.unitPx, params.unitPx);
  // Stroke / fill widths must be unit-corrected since `scale(unitPx, unitPx)`
  // also scales the line width. 1 / unitPx → 1 px on screen.
  ctx.lineWidth = 1 / params.unitPx;
  ctx.strokeStyle = params.strokeColor;
  ctx.fillStyle = params.fillColor;

  for (const prim of block.geometry) {
    stampPrimitive(ctx, prim);
  }

  ctx.restore();
}

function stampPrimitive(ctx: CanvasRenderingContext2D, prim: ArrowheadPrimitive): void {
  switch (prim.kind) {
    case 'line':
      stampLine(ctx, prim);
      return;
    case 'triangle':
      stampTriangle(ctx, prim);
      return;
    case 'circle':
      stampCircle(ctx, prim);
      return;
    default: {
      const _exhaustive: never = prim;
      throw new Error(`[arrowhead-renderer] Unknown primitive kind: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

function stampLine(ctx: CanvasRenderingContext2D, line: ArrowheadLine): void {
  ctx.beginPath();
  ctx.moveTo(line.from[0], line.from[1]);
  ctx.lineTo(line.to[0], line.to[1]);
  ctx.stroke();
}

function stampTriangle(ctx: CanvasRenderingContext2D, tri: ArrowheadTriangle): void {
  ctx.beginPath();
  ctx.moveTo(tri.v1[0], tri.v1[1]);
  ctx.lineTo(tri.v2[0], tri.v2[1]);
  ctx.lineTo(tri.v3[0], tri.v3[1]);
  ctx.closePath();
  if (tri.solid) ctx.fill();
  else ctx.stroke();
}

function stampCircle(ctx: CanvasRenderingContext2D, circle: ArrowheadCircle): void {
  ctx.beginPath();
  ctx.arc(circle.center[0], circle.center[1], circle.radius, 0, Math.PI * 2);
  if (circle.solid) ctx.fill();
  else ctx.stroke();
}
