/**
 * dxf-grip-ghost-paint.ts — PURE live-ghost geometry for a RAW DXF grip drag in 3D
 * (ADR-537). While a grip is dragged, the committed wireframe stays put and a light
 * GHOST of the entity-in-progress follows the cursor (the Canvas2D overlay strokes it
 * with the same plan→canvas projector the grips use). This builds that ghost in plan-mm:
 * the entity's geometry with the dragged grip moved to `livePlanPos`.
 *
 * Mirrors the vertex semantics of `computeDxfEntityGrips` (the same SSoT the commit
 * resolves through `gripToVertexRefs`): a `movesEntity` grip (line midpoint / circle &
 * arc centre) translates the whole entity; an `edgeVertexIndices` grip moves both edge
 * vertices; a plain vertex grip moves its one point (by `gripIndex`).
 *
 * Returns an array of poly-lines (each a plan-mm point list) to stroke. Empty array =
 * no ghost for this case (e.g. arc reshape — the grip square alone follows in v1).
 *
 * Pure — no THREE, no React, no canvas. Jest-friendly.
 */

import type { Point2D } from '../../rendering/types/Types';
import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { GripInfo } from '../../hooks/grip-types';

/** Circle approximation segment count (matches DxfToThreeConverter's 48). */
const CIRCLE_SEGMENTS = 48;

function translate(p: Point2D, dx: number, dy: number): Point2D {
  return { x: p.x + dx, y: p.y + dy };
}

/** Sample a circle into a closed plan-mm poly-line. */
function circlePolyline(center: Point2D, radius: number): Point2D[] {
  const pts: Point2D[] = [];
  for (let i = 0; i <= CIRCLE_SEGMENTS; i++) {
    const a = (i / CIRCLE_SEGMENTS) * Math.PI * 2;
    pts.push({ x: center.x + radius * Math.cos(a), y: center.y + radius * Math.sin(a) });
  }
  return pts;
}

/** Ghost for a line: move start / end / both (midpoint = whole-entity). */
function lineGhost(start: Point2D, end: Point2D, grip: GripInfo, dx: number, dy: number): Point2D[] {
  if (grip.movesEntity) return [translate(start, dx, dy), translate(end, dx, dy)];
  const s = grip.gripIndex === 0 ? translate(start, dx, dy) : start;
  const e = grip.gripIndex === 1 ? translate(end, dx, dy) : end;
  return [s, e];
}

/** Ghost for a polyline: translate whole, move both edge vertices, or move one vertex. */
function polylineGhost(
  vertices: readonly Point2D[],
  closed: boolean,
  grip: GripInfo,
  dx: number,
  dy: number,
): Point2D[] {
  const moved = new Set<number>();
  if (grip.movesEntity) vertices.forEach((_, i) => moved.add(i));
  else if (grip.edgeVertexIndices) grip.edgeVertexIndices.forEach((i) => moved.add(i));
  else if (grip.gripIndex < vertices.length) moved.add(grip.gripIndex);
  const out = vertices.map((v, i) => (moved.has(i) ? translate(v, dx, dy) : { x: v.x, y: v.y }));
  if (closed && out.length > 1) out.push({ x: out[0].x, y: out[0].y });
  return out;
}

/**
 * Build the live ghost poly-lines (plan-mm) for a raw DXF grip drag, or `[]` when there
 * is no ghost for the case. `livePlanPos` is the snapped position the dragged grip renders
 * at; `delta = livePlanPos − grip.position` drives the vertex moves.
 */
export function buildDxfGhostSegments(
  entity: DxfEntityUnion,
  grip: GripInfo,
  livePlanPos: Point2D,
): Point2D[][] {
  const dx = livePlanPos.x - grip.position.x;
  const dy = livePlanPos.y - grip.position.y;
  switch (entity.type) {
    case 'line':
      return [lineGhost(entity.start, entity.end, grip, dx, dy)];
    case 'polyline':
      return [polylineGhost(entity.vertices, entity.closed, grip, dx, dy)];
    case 'circle': {
      // Centre grip → translate; quadrant grip → resize radius to the live point.
      if (grip.movesEntity) return [circlePolyline(translate(entity.center, dx, dy), entity.radius)];
      const r = Math.hypot(livePlanPos.x - entity.center.x, livePlanPos.y - entity.center.y);
      return [circlePolyline(entity.center, r)];
    }
    default:
      return []; // arc / text — grip square alone follows in v1
  }
}
