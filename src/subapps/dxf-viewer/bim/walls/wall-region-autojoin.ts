/**
 * ADR-363 Phase 1K — Region-fill wall auto-join (Revit "Allow Join").
 *
 * A wall created by «κλικ μέσα σε περιοχή» / «από περίγραμμα» fills exactly its
 * detected rectangle, so its axis endpoints sit on the bounding DXF lines — i.e.
 * on the FACE of the neighbouring wall, not on the neighbour's centreline. The
 * junction trim (`wall-trims.ts`) then bevels the stem by the neighbour's
 * half-thickness assuming the endpoint was at the centreline, pulling it BACK
 * from the face → a visible gap ("δεν κόλλησε").
 *
 * Fix (mirrors Revit auto-join): before inserting a filling wall, EXTEND each of
 * its endpoints along its own axis to the neighbouring wall's centreline. The
 * existing trim solver then bevels it back to the face → a clean butt, zero gap.
 *
 * Pure + idempotent: re-running on an already-joined wall returns it unchanged.
 * Only fill walls go through this; freehand walls already snap while drawing.
 *
 * @see ./wall-in-region.ts (filling-wall builder)
 * @see ./wall-trims.ts (junction trim that consumes the joined endpoints)
 */

import type { Point3D } from '../types/bim-base';
import type { WallEntity, WallParams } from '../types/wall-types';
import { computeWallGeometry } from '../geometry/wall-geometry';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';

/** Slack (mm) for "the endpoint sits on the neighbour's boundary line". */
const AUTOJOIN_TOL_MM = 50;

/**
 * Distance along the unit ray (o + t·û) at which it crosses segment [a,b], plus
 * whether the crossing lies within the segment. `null` when parallel.
 * Solves o + t·û = a + s·(b−a) for (t, s); `within` ⇔ s ∈ [0,1] (± slack).
 */
function rayHitsSegment(
  ox: number, oy: number,
  ux: number, uy: number,
  ax: number, ay: number,
  bx: number, by: number,
): { dist: number; within: boolean } | null {
  const sx = bx - ax, sy = by - ay;
  const det = sx * uy - ux * sy;
  if (Math.abs(det) < 1e-9) return null;
  const wx = ax - ox, wy = ay - oy;
  const dist = (-wx * sy + sx * wy) / det; // t along the ray (û is unit → distance)
  const s = (ux * wy - uy * wx) / det;     // param along a→b
  return { dist, within: s >= -1e-6 && s <= 1 + 1e-6 };
}

/**
 * Find where one endpoint should extend to. Walks neighbours; picks the nearest
 * whose centreline the outward ray meets within `[−slack, halfThickness+slack]`
 * (i.e. the endpoint is sitting on that neighbour's face). Returns the centreline
 * hit point, or `null` to leave the endpoint where it is.
 */
function resolveExtension(
  ex: number, ey: number,
  ux: number, uy: number,
  neighbours: readonly WallEntity[],
  wallId: string,
  scale: number,
): { x: number; y: number } | null {
  const slack = AUTOJOIN_TOL_MM * scale;
  let best: { dist: number; x: number; y: number } | null = null;
  for (const n of neighbours) {
    if (n.id === wallId) continue;
    const nHalf = (n.params.thickness / 2) * mmToSceneUnits(n.params.sceneUnits ?? 'mm');
    const hit = rayHitsSegment(ex, ey, ux, uy, n.params.start.x, n.params.start.y, n.params.end.x, n.params.end.y);
    if (!hit || !hit.within) continue;
    // The endpoint must be on/near the neighbour's face: 0 ≤ dist ≤ half + slack.
    if (hit.dist < -slack || hit.dist > nHalf + slack) continue;
    if (hit.dist <= slack) continue; // already at (or past) the centreline → no move
    if (!best || hit.dist < best.dist) {
      best = { dist: hit.dist, x: ex + ux * hit.dist, y: ey + uy * hit.dist };
    }
  }
  return best ? { x: best.x, y: best.y } : null;
}

/**
 * Return `wall` with its endpoints extended to coincident neighbour centrelines
 * (Revit auto-join). Geometry is recomputed when an endpoint moves; otherwise the
 * same entity is returned (referential no-op for the "nothing to join" case).
 */
export function extendFillingWallToNeighbors(
  wall: WallEntity,
  neighbours: readonly WallEntity[],
  sceneUnits: SceneUnits,
): WallEntity {
  if (neighbours.length === 0) return wall;
  const { start, end } = wall.params;
  const dx = end.x - start.x, dy = end.y - start.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return wall;
  const ux = dx / len, uy = dy / len;
  const scale = mmToSceneUnits(sceneUnits);

  // start extends along −û (outward), end along +û.
  const newStart = resolveExtension(start.x, start.y, -ux, -uy, neighbours, wall.id, scale);
  const newEnd = resolveExtension(end.x, end.y, ux, uy, neighbours, wall.id, scale);
  if (!newStart && !newEnd) return wall;

  const nextStart: Point3D = newStart ? { x: newStart.x, y: newStart.y, z: start.z } : start;
  const nextEnd: Point3D = newEnd ? { x: newEnd.x, y: newEnd.y, z: end.z } : end;
  const nextParams: WallParams = { ...wall.params, start: nextStart, end: nextEnd };
  return { ...wall, params: nextParams, geometry: computeWallGeometry(nextParams, wall.kind) };
}
