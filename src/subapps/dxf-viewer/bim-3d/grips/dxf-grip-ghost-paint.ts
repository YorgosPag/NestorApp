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
 * no ghost for this case (e.g. text — no wireframe, the grip square alone follows).
 *
 * Pure — no THREE, no React, no canvas. Jest-friendly.
 */

import type { Point2D } from '../../rendering/types/Types';
import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { GripInfo } from '../../hooks/grip-types';
import { circlePolyline, arcPolyline } from '../converters/dxf-arc-circle-sample';
import { arcFromMovedEndpoint } from '../../rendering/entities/shared/geometry-arc-utils';

function translate(p: Point2D, dx: number, dy: number): Point2D {
  return { x: p.x + dx, y: p.y + dy };
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
    case 'arc': {
      // Mirrors the commit (`stretchArc` via `gripToVertexRefs`):
      //   centre (grip 0) + mid (grip 3) are `movesEntity` → rigid translate of the arc;
      //   start (grip 1) / end (grip 2) → bulge-preserving single-endpoint recompute (SSoT
      //   `arcFromMovedEndpoint`, the SAME helper the commit resolves through).
      if (grip.movesEntity) {
        return [arcPolyline(translate(entity.center, dx, dy), entity.radius,
          entity.startAngle, entity.endAngle, entity.counterclockwise)];
      }
      const next = arcFromMovedEndpoint(entity, grip.gripIndex === 1 ? 'start' : 'end', dx, dy);
      if (!next) return [];
      // The commit keeps the original `counterclockwise` flag (only centre/radius/angles
      // change), so sample with it to match the post-commit wireframe.
      return [arcPolyline(next.center, next.radius, next.startAngle, next.endAngle, entity.counterclockwise)];
    }
    default:
      return []; // text — grip square alone follows (no wireframe)
  }
}
