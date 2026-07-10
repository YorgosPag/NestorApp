/**
 * wall-render-paths — pure Canvas2D path-tracing helpers for `WallRenderer`.
 *
 * Extracted from `WallRenderer.ts` (ADR-363) to keep the renderer class under the
 * 500-line Google budget (N.7.1). Zero state, zero store subscriptions — each
 * helper receives the live `ctx` + a `worldToScreen` projector and traces/strokes
 * a path. ADR-040 micro-leaf compliant (no high-frequency subscriptions).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Point3D } from '../types/bim-base';
import type { PlanLineSeg } from '../walls/wall-plan-line-segments';

/** Projects a world-space point to screen (canvas) space. */
type WorldToScreen = (p: Point2D) => Point2D;

/** Traces the wall footprint ring (outer fwd + inner reversed) as a closed path. */
export function traceFootprintRing(
  ctx: CanvasRenderingContext2D,
  toScreen: WorldToScreen,
  outer: readonly Point3D[],
  inner: readonly Point3D[],
): void {
  ctx.beginPath();
  const first = toScreen({ x: outer[0].x, y: outer[0].y });
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < outer.length; i++) {
    const s = toScreen({ x: outer[i].x, y: outer[i].y });
    ctx.lineTo(s.x, s.y);
  }
  for (let i = inner.length - 1; i >= 0; i--) {
    const s = toScreen({ x: inner[i].x, y: inner[i].y });
    ctx.lineTo(s.x, s.y);
  }
  ctx.closePath();
}

/**
 * ADR-458 — traces the wall body: cut pieces (`displayFootprint`, multi-subpath) όταν
 * τέμνεται από κολόνα, αλλιώς το πλήρες outer+inner ring. Ένα seam (fill+stroke) → ίδια
 * γεωμετρία. Κάθε piece είναι ήδη κλειστό ring (outer ring του safeDifference κομματιού).
 */
export function traceWallBody(
  ctx: CanvasRenderingContext2D,
  toScreen: WorldToScreen,
  outer: readonly Point3D[],
  inner: readonly Point3D[],
  pieces?: readonly (readonly Point3D[])[],
): void {
  if (pieces === undefined) {
    traceFootprintRing(ctx, toScreen, outer, inner);
    return;
  }
  ctx.beginPath();
  for (const ring of pieces) {
    if (ring.length < 3) continue;
    const first = toScreen({ x: ring[0].x, y: ring[0].y });
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < ring.length; i++) {
      const s = toScreen({ x: ring[i].x, y: ring[i].y });
      ctx.lineTo(s.x, s.y);
    }
    ctx.closePath();
  }
}

/**
 * Hover halo: tight OBB of the footprint vertices (outer + inner). Stair
 * pattern (ADR-358 §G15) — per-edge halo on composite entities is clobbered
 * by the next stroke, so a single OBB pass guarantees a continuous halo.
 * Caller sets the stroke style; this only traces + strokes.
 */
export function strokePerimeterOutline(
  ctx: CanvasRenderingContext2D,
  toScreen: WorldToScreen,
  outer: readonly Point3D[],
  inner: readonly Point3D[],
): void {
  if (outer.length < 2 || inner.length < 2) return;
  traceFootprintRing(ctx, toScreen, outer, inner);
  ctx.stroke();
}

/**
 * ADR-531 Φ5b.3 — «Μόνο κάτοψη DXF» plan-lines: strokes disjoint 2-point segments (κομμένες
 * παρειές + caps + jamb returns από {@link wallPlanLineSegments}). Caller sets stroke style/width.
 */
export function strokePlanLineSegments(
  ctx: CanvasRenderingContext2D,
  toScreen: WorldToScreen,
  segs: readonly PlanLineSeg[],
): void {
  if (segs.length === 0) return;
  ctx.beginPath();
  for (const s of segs) {
    const a = toScreen(s.a);
    const b = toScreen(s.b);
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  }
  ctx.stroke();
}

/** Strokes a polyline through world-space points (caller sets style/dash). */
export function strokePolyline(
  ctx: CanvasRenderingContext2D,
  toScreen: WorldToScreen,
  points: ReadonlyArray<Point3D>,
): void {
  if (points.length < 2) return;
  ctx.beginPath();
  const first = toScreen({ x: points[0].x, y: points[0].y });
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < points.length; i++) {
    const s = toScreen({ x: points[i].x, y: points[i].y });
    ctx.lineTo(s.x, s.y);
  }
  ctx.stroke();
}
