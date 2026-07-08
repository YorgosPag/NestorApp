/**
 * ADR-363 Φ1G.5 Slice 2i — Wall FACE-line snap engine (face-to-face magnetism).
 *
 * The generic BIM corner engine (`BimCharacteristicSnapEngine`, ADR-597) snaps to the
 * 4 corner POINTS of a wall; this engine snaps to the 2 face LINES (outer + inner) — the
 * missing piece for Revit "drag a wall flush against another wall's face". A probe
 * point (e.g. a moving wall's face corner, fed as a characteristic offset by the 3D
 * gizmo) projects perpendicularly onto the nearest static wall face line; the whole
 * dragged wall then shifts so that face touches the reference face.
 *
 * Query-time projection (mirrors `NearestSnapEngine`) — NO spatial index: faces are
 * lines, not points, so they are re-derived per query from the wall geometry SSoT
 * (`getWallCornerWorldPoints`). The winning candidate carries `referenceSegment` =
 * the static face line, so the gizmo draws a dashed alignment line along it.
 *
 * Priority `BIM_WALL_FACE` (-1.8): below face corners (-2, so a corner still wins at
 * a wall extremity), above MEP connector / column centre / endpoint (so the face
 * line is preferred over a generic nearest/axis snap when sliding a wall flush).
 *
 * @see bim/walls/wall-corner-anchors.ts — SSoT for the 4 face-corner world points
 * @see snapping/engines/BimCharacteristicSnapEngine.ts — the corner-POINT sibling (ADR-597)
 * @see snapping/engines/NearestSnapEngine.ts     — query-time projection pattern
 */

import type { Point2D, EntityModel } from '../../rendering/types/Types';
import { ExtendedSnapType, type SnapCandidate } from '../extended-types';
import { BaseSnapEngine, type SnapEngineContext, type SnapEngineResult } from '../shared/BaseSnapEngine';
import { SNAP_ENGINE_PRIORITIES } from '../../config/tolerance-config';
import { isWallEntity } from '../../types/entities';
// 🏢 ADR-378: SSoT snap-visibility predicate (imported DXF entities omit `visible`)
import { isEntityVisibleForSnap } from '../shared/snap-visibility';
import { getWallCornerWorldPoints } from '../../bim/walls/wall-corner-anchors';
import { getNearestPointOnLine } from '../../rendering/entities/shared/geometry-utils';
import { calculateDistance } from '../../rendering/entities/shared/geometry-rendering-utils';

/** A clamped projection of the cursor onto one wall face line. */
interface FaceHit {
  readonly point: Point2D;
  readonly segment: { start: Point2D; end: Point2D };
  readonly distance: number;
}

/** One face line + its midpoint and outward unit normal (null for a zero-thickness wall). */
interface SidedFace {
  readonly start: Point2D;
  readonly end: Point2D;
  readonly mid: Point2D;
  readonly outward: Point2D | null;
}

/**
 * ADR-363 Φ1G.5 Slice 2j — flush-touching tolerance (mm). A probe sitting exactly ON
 * (or ≤1 mm behind) a face still counts as "outside" so the dragged wall can rest flush
 * against the face without losing the snap. 1 mm penetration is sub-pixel / invisible.
 */
const OUTWARD_EPS_MM = 1;

export class WallFaceSnapEngine extends BaseSnapEngine {
  constructor() {
    super(ExtendedSnapType.BIM_WALL_FACE);
  }

  // Faces are re-derived per query (lines, not indexable points) — no init state.
  initialize(_entities: EntityModel[]): void {}

  findSnapCandidates(cursorPoint: Point2D, context: SnapEngineContext): SnapEngineResult {
    if (!Array.isArray(context.entities)) return { candidates: [] };
    const radius = context.worldRadiusForType(cursorPoint, ExtendedSnapType.BIM_WALL_FACE);
    const priority = SNAP_ENGINE_PRIORITIES.BIM_WALL_FACE;

    let best: { hit: FaceHit; entityId: string } | null = null;
    for (const entity of context.entities) {
      if (context.excludeEntityId && entity.id === context.excludeEntityId) continue;
      if (!isEntityVisibleForSnap(entity) || !isWallEntity(entity)) continue;

      const hit = nearestFaceOnWall(entity, cursorPoint);
      if (!hit || hit.distance > radius) continue;
      if (!best || hit.distance < best.hit.distance) best = { hit, entityId: entity.id };
    }

    if (!best) return { candidates: [] };
    const candidate: SnapCandidate = this.createCandidate(
      best.hit.point, 'bim-wall-face', best.hit.distance, priority, best.entityId, best.hit.segment,
    );
    return { candidates: [candidate] };
  }

  dispose(): void {}
}

/**
 * Nearest clamped projection of `cursor` (a drag probe) onto the wall's face lines —
 * but only onto a face the probe approaches from OUTSIDE (sidedness, ADR-363 Φ1G.5
 * Slice 2j). Picking purely by distance let an overshooting probe grab the wall's BACK
 * face, snapping the dragged wall INTO the static body (~1 wall-thickness penetration,
 * Giorgio's T-junction overshoot). Gating each face by its outward normal makes the
 * magnet pull the wall flush against the confronting face and never suck it through.
 *
 * If the probe is inside the wall body (no face faces it) → `null` (no pull inward).
 * Zero-thickness wall (outward normal undefined) → falls back to plain nearest.
 */
function nearestFaceOnWall(wall: EntityModel, cursor: Point2D): FaceHit | null {
  if (!isWallEntity(wall)) return null;
  const corners = getWallCornerWorldPoints(wall);
  if (corners.length < 4) return null;
  // Order: [0] outer-start, [1] outer-end, [2] inner-end, [3] inner-start.
  const faces = buildSidedFaces(
    { start: corners[0].point, end: corners[1].point }, // outer face
    { start: corners[3].point, end: corners[2].point }, // inner face
  );

  let best: FaceHit | null = null;
  for (const face of faces) {
    if (face.outward && !probeIsOutside(cursor, face)) continue; // skip the back face
    const point = getNearestPointOnLine(cursor, face.start, face.end, true);
    const distance = calculateDistance(cursor, point);
    if (!best || distance < best.distance) {
      best = { point, segment: { start: face.start, end: face.end }, distance };
    }
  }
  return best;
}

/** Tag the outer/inner face lines with their midpoint + outward unit normal. */
function buildSidedFaces(
  outer: { start: Point2D; end: Point2D },
  inner: { start: Point2D; end: Point2D },
): readonly SidedFace[] {
  const outerMid = midpoint(outer.start, outer.end);
  const innerMid = midpoint(inner.start, inner.end);
  // Outer face points away from the wall centerline, i.e. from the inner face toward it.
  const outwardOuter = unitDir(innerMid, outerMid);
  const outwardInner = outwardOuter ? { x: -outwardOuter.x, y: -outwardOuter.y } : null;
  return [
    { ...outer, mid: outerMid, outward: outwardOuter },
    { ...inner, mid: innerMid, outward: outwardInner },
  ];
}

/** True when `probe` is on the outward side of `face` (or flush within `OUTWARD_EPS_MM`). */
function probeIsOutside(probe: Point2D, face: SidedFace): boolean {
  const n = face.outward;
  if (!n) return true; // degenerate — gating disabled
  return (probe.x - face.mid.x) * n.x + (probe.y - face.mid.y) * n.y >= -OUTWARD_EPS_MM;
}

function midpoint(a: Point2D, b: Point2D): Point2D {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Unit vector `from → to`, or `null` if the two points coincide (zero-thickness wall). */
function unitDir(from: Point2D, to: Point2D): Point2D | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  return len > 1e-6 ? { x: dx / len, y: dy / len } : null;
}
