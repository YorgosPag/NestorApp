/**
 * ADR-510 Φ5 — EXPLODE geometry (SSoT, pure): break a COMPOUND entity into its
 * constituent primitives (AutoCAD EXPLODE). Returns `null` when the entity has
 * nothing to explode (already a primitive) so the caller can no-op + hint.
 *
 * Coverage (Φ5.1):
 *   - polyline / lwpolyline (a closed polyline == a drawn polygon) → line/arc
 *     segments. A bulged segment becomes an ARC via the linetype bulge SSoT.
 *   - rectangle / rect → 4 lines (rotation-aware).
 * Every derived primitive INHERITS the source style (layer/colour/lineweight/…).
 *
 * FULL SSoT reuse — zero re-implemented geometry:
 *   - `bulgeToArc` / `isStraightSegment` → rendering/entities/shared/geometry-bulge-utils
 *   - `radToDeg` → geometry-angle-utils (ArcEntity stores DEGREES, bulge math is radians)
 *   - `rotatePoint` → utils/rotation-math
 *   - `inheritEntityStyle` → systems/entity-creation/inherit-entity-style
 *   - `generateEntityId` → systems/entity-creation/utils
 *
 * @see core/commands/entity-commands/ExplodeEntityCommand.ts (undoable wrapper)
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity, LineEntity, ArcEntity, RectangleEntity, RectEntity } from '../../types/entities';
import { bulgeToArc, isStraightSegment } from '../../rendering/entities/shared/geometry-bulge-utils';
import { radToDeg } from '../../rendering/entities/shared/geometry-angle-utils';
import { rotatePoint } from '../../utils/rotation-math';
import { inheritEntityStyle } from '../entity-creation/inherit-entity-style';
import { generateEntityId } from '../entity-creation/utils';

/** Entity types that EXPLODE can break apart (Φ5.1). */
const EXPLODABLE_TYPES: ReadonlySet<string> = new Set(['polyline', 'lwpolyline', 'rectangle', 'rect']);

/** True when EXPLODE would produce a change for this entity type. */
export function isExplodable(entity: Entity): boolean {
  return EXPLODABLE_TYPES.has(entity.type);
}

/** Polyline-shaped read view (polyline + lwpolyline share these fields). */
interface PolylineLike {
  readonly vertices?: readonly Point2D[];
  readonly bulges?: readonly number[];
  readonly closed?: boolean;
}

function makeLine(source: Entity, start: Point2D, end: Point2D): LineEntity {
  return {
    ...inheritEntityStyle(source),
    id: generateEntityId(),
    type: 'line',
    layerId: source.layerId,
    start,
    end,
    selected: false,
  } as LineEntity;
}

function makeArc(
  source: Entity, center: Point2D, radius: number,
  startDeg: number, endDeg: number, counterclockwise: boolean,
): ArcEntity {
  return {
    ...inheritEntityStyle(source),
    id: generateEntityId(),
    type: 'arc',
    layerId: source.layerId,
    center,
    radius,
    startAngle: startDeg,
    endAngle: endDeg,
    counterclockwise,
    selected: false,
  } as ArcEntity;
}

/** Polyline → per-segment line/arc primitives (respects `closed` + bulges). */
function explodePolyline(source: Entity): Entity[] {
  const poly = source as unknown as PolylineLike;
  const verts = poly.vertices;
  if (!verts || verts.length < 2) return [];
  const segCount = poly.closed ? verts.length : verts.length - 1;
  const out: Entity[] = [];
  for (let i = 0; i < segCount; i += 1) {
    const p0 = verts[i];
    const p1 = verts[(i + 1) % verts.length];
    const bulge = poly.bulges?.[i];
    if (isStraightSegment(bulge)) {
      out.push(makeLine(source, p0, p1));
      continue;
    }
    const arc = bulgeToArc(p0, p1, bulge as number);
    if (arc) {
      out.push(makeArc(source, arc.center, arc.radius, radToDeg(arc.startAngle), radToDeg(arc.endAngle), arc.counterclockwise));
    } else {
      out.push(makeLine(source, p0, p1)); // degenerate bulge → straight fallback
    }
  }
  return out;
}

/** Rectangle → 4 boundary lines (rotation-aware, about the rect centre). */
function explodeRectangle(source: RectangleEntity | RectEntity): Entity[] {
  const { x, y, width, height } = source;
  const rotation = source.rotation ?? 0;
  const corners: Point2D[] = [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ];
  const pivot: Point2D = { x: x + width / 2, y: y + height / 2 };
  const pts = rotation ? corners.map((c) => rotatePoint(c, pivot, rotation)) : corners;
  const out: Entity[] = [];
  for (let i = 0; i < 4; i += 1) {
    out.push(makeLine(source, pts[i], pts[(i + 1) % 4]));
  }
  return out;
}

/**
 * Break a compound entity into primitives, or `null` if there is nothing to
 * explode (a primitive line/circle/arc/text, or a degenerate polyline).
 */
export function explodeEntity(entity: Entity): Entity[] | null {
  if (entity.type === 'polyline' || entity.type === 'lwpolyline') {
    const segs = explodePolyline(entity);
    return segs.length > 0 ? segs : null;
  }
  if (entity.type === 'rectangle' || entity.type === 'rect') {
    return explodeRectangle(entity as RectangleEntity | RectEntity);
  }
  return null;
}
