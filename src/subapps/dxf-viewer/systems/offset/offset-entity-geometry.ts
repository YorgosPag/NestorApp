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

  // Straight polyline → reuse the proven miter offset. Η μηχανή είναι γενική στον τύπο
  // σημείου (ADR-791) και δέχεται ρητό `closed`, οπότε το 2Δ πολύγωνο περνά ΑΥΤΟΥΣΙΟ:
  // κανένα lift σε ψεύτικο z, καμία τεχνητή διπλή κορυφή, καμία επαναπροβολή.
  const out = offsetPolyline(src.vertices, d, { join: 'miter', closed });
  if (out.length < 2) return null;
  return { ...rest, id: newId, selected: false, vertices: [...out] };
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
