/**
 * OFFSET — per-entity offset dispatcher (ADR-510 Φ4d).
 *
 * Produces the parallel copy of a source entity at a SIGNED distance (the sign
 * carries the side; see `offset-side.ts` for how it is derived from the cursor).
 * The copy inherits every style/layer property of the source (AutoCAD behaviour)
 * via spread; only geometry + `id` change.
 *
 * Reuses existing geometry SSoT — zero duplicated math:
 *   • LINE      → perpendicular translate (`getPerpendicularUnitVector` + `offsetPoint`)
 *   • CIRCLE/ARC→ `radius + d` (same centre/angles)
 *   • POLYLINE  → straight: `geometry-offset-utils.offsetPolyline` (proven miter/bevel);
 *                 with arcs: `offset-polyline.offsetPolylineWithBulges`
 */

import type { Entity, LineEntity, CircleEntity, ArcEntity, PolylineEntity, LWPolylineEntity } from '../../types/entities';
import {
  isLineEntity,
  isCircleEntity,
  isArcEntity,
  isPolylineEntity,
  isLWPolylineEntity,
} from '../../types/entities';
import type { Point3D } from '../../rendering/types/Types';
import { getPerpendicularUnitVector, offsetPoint } from '../../rendering/entities/shared/geometry-vector-utils';
import { offsetPolyline } from '../../rendering/entities/shared/geometry-offset-utils';
import { isStraightSegment } from '../../rendering/entities/shared/geometry-bulge-utils';
import { offsetPolylineWithBulges } from './offset-polyline';
import { OFFSET_MIN_DIMENSION } from './offset-types';

/** True when `entity` is a type the OFFSET tool can produce a parallel copy of. */
export function isOffsettable(entity: Entity): boolean {
  return (
    isLineEntity(entity) ||
    isCircleEntity(entity) ||
    isArcEntity(entity) ||
    isPolylineEntity(entity) ||
    isLWPolylineEntity(entity)
  );
}

function offsetLine(src: LineEntity, d: number, newId: string): Entity | null {
  const perp = getPerpendicularUnitVector(src.start, src.end);
  if (perp.x === 0 && perp.y === 0) return null;
  return { ...src, id: newId, selected: false, start: offsetPoint(src.start, perp, d), end: offsetPoint(src.end, perp, d) };
}

/** CIRCLE/ARC share the math: `radius + d` (d is outward-positive; see offset-side). */
function offsetRadial(src: CircleEntity | ArcEntity, d: number, newId: string): Entity | null {
  const radius = src.radius + d;
  if (radius <= OFFSET_MIN_DIMENSION) return null;
  return { ...src, id: newId, selected: false, radius };
}

function offsetPolylineEntity(src: PolylineEntity | LWPolylineEntity, d: number, newId: string): Entity | null {
  const closed = src.closed === true;
  // Drop index-aligned width arrays — vertex count can change at miter joins.
  const { bulges: _b, startWidths: _sw, endWidths: _ew, ...rest } = src;

  const hasArcs = (src.bulges ?? []).some((b) => !isStraightSegment(b));
  if (hasArcs) {
    const res = offsetPolylineWithBulges(src.vertices, src.bulges, closed, d);
    if (!res || res.vertices.length < 2) return null;
    return { ...rest, id: newId, selected: false, vertices: res.vertices, bulges: res.bulges };
  }

  // Straight polyline → reuse the proven miter offset. Wrap closed rings with a
  // duplicate first vertex (its detection contract), then strip it back off.
  const pts3d: Point3D[] = src.vertices.map((v) => ({ x: v.x, y: v.y, z: 0 }));
  const ring: Point3D[] = closed && pts3d.length > 0 ? [...pts3d, { ...pts3d[0] }] : pts3d;
  const out = offsetPolyline(ring, d, { join: 'miter' });
  if (out.length < 2) return null;
  let verts = out.map((p) => ({ x: p.x, y: p.y }));
  if (closed && verts.length > 1) verts = verts.slice(0, -1);
  return { ...rest, id: newId, selected: false, vertices: verts };
}

/**
 * Offset `source` by `signedDistance`. Returns the parallel copy (with `newId`)
 * or null when the entity type is unsupported or the copy degenerates.
 */
export function offsetEntity(source: Entity, signedDistance: number, newId: string): Entity | null {
  if (!Number.isFinite(signedDistance) || signedDistance === 0) return null;
  if (isLineEntity(source)) return offsetLine(source, signedDistance, newId);
  if (isCircleEntity(source)) return offsetRadial(source, signedDistance, newId);
  if (isArcEntity(source)) return offsetRadial(source, signedDistance, newId);
  if (isPolylineEntity(source) || isLWPolylineEntity(source)) return offsetPolylineEntity(source, signedDistance, newId);
  return null;
}
