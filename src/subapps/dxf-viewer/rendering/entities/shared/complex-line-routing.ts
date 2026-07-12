/**
 * ADR-642 Φ2-B — full-canvas complex-linetype routing (SSoT seam).
 *
 * Entity renderers (Line/Polyline/Arc/Circle) call {@link strokeStyledEntityPolyline}
 * with their screen-space geometry points. When the entity carries a genuine complex
 * linetype (embedded `──GAS──` text/symbols) it strokes via the ONE complex stroker
 * (`strokeStyledPolyline`) so the text is drawn along the real line; otherwise it
 * returns `false` and the caller does its native `ctx.stroke()` (zero regression —
 * the 99% common solid/dash types never touch the complex path).
 *
 * Arcs & circles have no polyline vertices, so {@link sampleArcScreen} /
 * {@link sampleCircleScreen} tessellate them to screen points first (the stroker walks
 * arc-length in screen space, so tangent-following text is exact on the sampled curve).
 *
 * Pure (points + entity + scale → draw), reads NO hover/selection → ADR-040 cacheable
 * inside the normal-state bitmap. The complex def originates from `LinetypeRegistry`,
 * whose edits already invalidate the bitmap (`useDxfCanvasCacheInvalidation`).
 */

import { strokeStyledPolyline } from '../../linetype/ComplexLineStroker';
import { isSimpleExpressible } from '../../../config/complex-linetype-adapters';
import { getEffectiveLinetypeScale } from '../../../stores/LinetypeScaleStore';
import type { ComplexLinetypeDef } from '../../../config/complex-linetype-types';

/** Screen-space point (canvas px, post world→screen). */
export interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

/** The EntityModel fields the routing seam reads (structural — any model with these). */
export interface ComplexRoutableEntity {
  /** ADR-642 Φ2-B — the resolved complex linetype (embedded text); absent ⇒ native stroke. */
  readonly complex?: ComplexLinetypeDef;
  /** Per-object CELTSCALE («Βήμα», DXF group 48); default 1. */
  readonly ltscale?: number;
}

/** Screen px between tessellation samples on a curve — dense enough for smooth text-follow. */
const CURVE_SAMPLE_PX = 6;

function clampInt(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(value)));
}

/**
 * Stroke a screen-space polyline with the entity's complex linetype when present.
 *
 * @returns `true` when it drew the geometry (the caller MUST NOT also native-stroke);
 *          `false` when the entity has no genuine complex linetype (caller does its
 *          own `ctx.stroke()` on the same points). Simple-expressible complex defs
 *          return `false` too — they belong on the faster native `setLineDash` path.
 */
export function strokeStyledEntityPolyline(
  ctx: CanvasRenderingContext2D,
  screenPoints: readonly ScreenPoint[],
  entity: ComplexRoutableEntity,
  scale: number,
  closed = false,
): boolean {
  const complex = entity.complex;
  if (!complex || isSimpleExpressible(complex)) return false;
  if (screenPoints.length < 2) return false;
  // The complex stroker draws its dashes/text with self-contained save/restore (each dash
  // resets `setLineDash([])`), inheriting only strokeStyle + lineWidth from the phase style.
  strokeStyledPolyline(ctx, screenPoints, complex, {
    worldToScreenScale: scale,
    ltscale: getEffectiveLinetypeScale(),
    celtscale: entity.ltscale ?? 1,
    closed,
  });
  return true;
}

/**
 * Tessellate a screen-space arc into points, matching `ctx.arc(center, r, start, end,
 * counterclockwise)`. Angles are the SAME the renderer feeds `addArcPath` (already
 * Y-flipped: `screenStartRad = -startRad`, `screenCounterclockwise = !ccw`). The sample
 * count scales with the on-screen arc length so text follows the curve smoothly.
 */
export function sampleArcScreen(
  center: ScreenPoint,
  radiusPx: number,
  startRad: number,
  endRad: number,
  counterclockwise: boolean,
): ScreenPoint[] {
  let delta = endRad - startRad;
  const TAU = Math.PI * 2;
  if (!counterclockwise) {
    while (delta < 0) delta += TAU;      // increasing-angle sweep (canvas clockwise, Y-down)
  } else {
    while (delta > 0) delta -= TAU;      // decreasing-angle sweep
  }
  const arcLenPx = Math.abs(delta) * Math.max(radiusPx, 0);
  const n = clampInt(arcLenPx / CURVE_SAMPLE_PX, 12, 512);
  const pts: ScreenPoint[] = [];
  for (let i = 0; i <= n; i++) {
    const t = startRad + delta * (i / n);
    pts.push({ x: center.x + radiusPx * Math.cos(t), y: center.y + radiusPx * Math.sin(t) });
  }
  return pts;
}

/**
 * Tessellate a full screen-space circle into points (pass `closed: true` to the seam so
 * the last→first segment closes the loop — the first point is NOT duplicated).
 */
export function sampleCircleScreen(center: ScreenPoint, radiusPx: number): ScreenPoint[] {
  const TAU = Math.PI * 2;
  const n = clampInt((TAU * Math.max(radiusPx, 0)) / CURVE_SAMPLE_PX, 24, 512);
  const pts: ScreenPoint[] = [];
  for (let i = 0; i < n; i++) {
    const t = (TAU * i) / n;
    pts.push({ x: center.x + radiusPx * Math.cos(t), y: center.y + radiusPx * Math.sin(t) });
  }
  return pts;
}
