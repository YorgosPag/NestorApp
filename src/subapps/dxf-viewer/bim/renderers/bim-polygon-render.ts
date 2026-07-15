/**
 * SSoT (N.18) — shared screen-space polygon painters for the BIM plan renderers.
 *
 * Column / Slab / Opening / Wall each inlined the SAME primitives: a
 * beginPath→closePath screen-space trace, a bare plan-line outline stroke, the
 * hover-halo glow, a destination-out cutout fill, and a bbox+ray-cast hit test.
 * This module owns them once so the renderers call these instead of copies.
 *
 * All helpers work in SCREEN space via the caller's `worldToScreen`; none touch
 * `save`/`restore` beyond what their doc comment states, so the caller keeps its
 * own compositing/clip state.
 */
import type { Point2D, GripInfo } from '../../rendering/types/Types';
import type { GripInfo as ParametricGripInfo } from '../../hooks/grip-types';
import { RENDER_LINE_WIDTHS } from '../../config/text-rendering-config';
import { HOVER_HIGHLIGHT } from '../../config/color-config';
import { pointInPolygon } from '../geometry/shared/polygon-utils';

type ScreenPt = { x: number; y: number };
type ToScreen = (p: ScreenPt) => ScreenPt;
type Vertices = ReadonlyArray<{ x: number; y: number }>;

/** Trace a closed polygon path in SCREEN space (beginPath..closePath, no paint). */
export function tracePolygonScreenPath(
  ctx: CanvasRenderingContext2D,
  toScreen: ToScreen,
  vertices: Vertices,
): void {
  if (vertices.length < 3) return;
  ctx.beginPath();
  const first = toScreen(vertices[0]);
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < vertices.length; i++) {
    const s = toScreen(vertices[i]);
    ctx.lineTo(s.x, s.y);
  }
  ctx.closePath();
}

/** Trace + fill a closed polygon in screen space. Caller owns save/composite state. */
export function fillPolygonScreen(
  ctx: CanvasRenderingContext2D,
  toScreen: ToScreen,
  vertices: Vertices,
): void {
  tracePolygonScreenPath(ctx, toScreen, vertices);
  ctx.fill();
}

/** Bare plan-line outline: save → thin dashless stroke in `strokeStyle` → restore. */
export function strokePolygonOutline(
  ctx: CanvasRenderingContext2D,
  toScreen: ToScreen,
  vertices: Vertices,
  strokeStyle: string,
  lineWidthPx: number = RENDER_LINE_WIDTHS.THIN,
): void {
  ctx.save();
  ctx.setLineDash([]);
  ctx.lineWidth = lineWidthPx;
  ctx.strokeStyle = strokeStyle;
  tracePolygonScreenPath(ctx, toScreen, vertices);
  ctx.stroke();
  ctx.restore();
}

/** Hover-halo glow outline — no-op unless `highlighted`. Self-contained save/restore. */
export function paintPolygonHoverHalo(
  ctx: CanvasRenderingContext2D,
  toScreen: ToScreen,
  vertices: Vertices,
  highlighted: boolean,
): void {
  if (!highlighted) return;
  ctx.save();
  ctx.strokeStyle = HOVER_HIGHLIGHT.ENTITY.glowColor;
  ctx.lineWidth = RENDER_LINE_WIDTHS.NORMAL + HOVER_HIGHLIGHT.ENTITY.glowExtraWidth;
  ctx.globalAlpha = HOVER_HIGHLIGHT.ENTITY.glowOpacity;
  ctx.setLineDash([]);
  tracePolygonScreenPath(ctx, toScreen, vertices);
  ctx.stroke();
  ctx.restore();
}

/** Bbox quick-reject (tolerance-padded) then ray-cast point-in-polygon (world space). */
export function polygonBboxHitTest(
  bbox: { min: Point2D; max: Point2D },
  vertices: Vertices,
  point: Point2D,
  tolerance: number,
): boolean {
  if (
    point.x < bbox.min.x - tolerance ||
    point.x > bbox.max.x + tolerance ||
    point.y < bbox.min.y - tolerance ||
    point.y > bbox.max.y + tolerance
  ) {
    return false;
  }
  return pointInPolygon(point, vertices);
}

/**
 * Map raw parametric grips → render `GripInfo` (id/position/type/entityId/
 * isVisible/gripIndex). Center/midpoint kinds are preserved, everything else
 * becomes a plain 'vertex'. Pass `resolveShape` to attach a per-grip glyph
 * (move/rotation handles) — the caller keeps its own `gripKindOf`/glyph SSoT.
 *
 * Δύο ΔΙΑΦΟΡΕΤΙΚΑ `GripInfo` παίζουν εδώ: το input είναι το parametric/data-model
 * grip (`hooks/grip-types` — φέρει `movesEntity`/`gripKind`) που επιστρέφουν τα
 * `getXxxGrips()`, ενώ το output είναι το render grip (`rendering/types/Types` —
 * φέρει `id`/`isVisible`/`shape`). Αυτή η συνάρτηση ΕΙΝΑΙ η μετατροπή, οπότε οι δύο
 * τύποι πρέπει να δηλώνονται ξεχωριστά.
 */
export function mapBimGrips(
  grips: readonly ParametricGripInfo[],
  resolveShape?: (g: ParametricGripInfo) => GripInfo['shape'],
): GripInfo[] {
  return grips.map((g) => {
    const mapped: GripInfo = {
      id: `${g.entityId}-grip-${g.gripIndex}`,
      position: g.position,
      type: g.type === 'center' ? 'center' : g.type === 'midpoint' ? 'midpoint' : 'vertex',
      entityId: g.entityId,
      isVisible: true,
      gripIndex: g.gripIndex,
    };
    return resolveShape ? { ...mapped, shape: resolveShape(g) } : mapped;
  });
}
