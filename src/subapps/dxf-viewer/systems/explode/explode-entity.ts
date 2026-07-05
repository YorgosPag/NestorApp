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
import type { Entity, LineEntity, ArcEntity, RectangleEntity, RectEntity, GroupEntity } from '../../types/entities';
import { bulgeToArc, isStraightSegment } from '../../rendering/entities/shared/geometry-bulge-utils';
import { radToDeg } from '../../rendering/entities/shared/geometry-angle-utils';
import { rotatePoint } from '../../utils/rotation-math';
import { inheritEntityStyle } from '../entity-creation/inherit-entity-style';
import { generateEntityId } from '../entity-creation/utils';
import { createRectangleVertices } from '../selection/shared/selection-duplicate-utils';
// ADR-575 — UNGROUP «Κατάργηση Ομαδοποίησης»: exploding a GROUP container restores
// its members. Single SSoT unwrap lives in the group engine.
import { ungroupGroup } from '../group/group-entity';

/** Entity types that EXPLODE can break apart (Φ5.1 + GROUP UNGROUP). */
const EXPLODABLE_TYPES: ReadonlySet<string> = new Set(['polyline', 'lwpolyline', 'rectangle', 'rect', 'group']);

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
  // A DRAWN rectangle persists ONLY corner1/corner2 (drawing-entity-builders); the
  // x/y/width/height fields are optional/computed and stay `undefined`. Read corners
  // defensively so BOTH models work — reading x/y/w/h blindly gave NaN → invisible
  // rectangle (ADR-510 Φ5 Bug 1). Corner→vertices via the canonical SSoT, no re-math.
  const c1: Point2D = source.corner1 ?? { x: source.x, y: source.y };
  const c2: Point2D = source.corner2 ?? { x: source.x + source.width, y: source.y + source.height };
  const verts = createRectangleVertices(c1, c2);
  const rotation = source.rotation ?? 0;
  const pivot: Point2D = { x: (c1.x + c2.x) / 2, y: (c1.y + c2.y) / 2 };
  const pts = rotation ? verts.map((v) => rotatePoint(v, pivot, rotation)) : verts;
  const out: Entity[] = [];
  for (let i = 0; i < 4; i += 1) {
    const a = pts[i];
    const b = pts[(i + 1) % 4];
    // Fresh point objects — never alias the source corner references into new lines.
    out.push(makeLine(source, { x: a.x, y: a.y }, { x: b.x, y: b.y }));
  }
  return out;
}

/** Guard: a derived primitive must carry finite geometry — a broken/degenerate
 *  source must NEVER inject NaN entities into the scene (idempotent, defensive). */
function isFinitePoint(p: Point2D | undefined): boolean {
  return !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
}

function isFiniteEntity(e: Entity): boolean {
  if (e.type === 'line') {
    const l = e as LineEntity;
    return isFinitePoint(l.start) && isFinitePoint(l.end);
  }
  if (e.type === 'arc') {
    const a = e as ArcEntity;
    return isFinitePoint(a.center)
      && Number.isFinite(a.radius)
      && Number.isFinite(a.startAngle)
      && Number.isFinite(a.endAngle);
  }
  return true;
}

/**
 * Break a compound entity into primitives, or `null` if there is nothing to
 * explode (a primitive line/circle/arc/text, or a degenerate polyline).
 */
export function explodeEntity(entity: Entity): Entity[] | null {
  let segs: Entity[] | null = null;
  if (entity.type === 'polyline' || entity.type === 'lwpolyline') {
    segs = explodePolyline(entity);
  } else if (entity.type === 'rectangle' || entity.type === 'rect') {
    segs = explodeRectangle(entity as RectangleEntity | RectEntity);
  } else if (entity.type === 'group') {
    // UNGROUP: a GROUP container breaks back into its members (ADR-575).
    segs = ungroupGroup(entity as GroupEntity);
  }
  if (!segs) return null;
  // Belt-and-suspenders: drop any primitive with non-finite geometry so a broken
  // source can never make an entity "disappear" or poison downstream hit-tests.
  const finite = segs.filter(isFiniteEntity);
  return finite.length > 0 ? finite : null;
}
