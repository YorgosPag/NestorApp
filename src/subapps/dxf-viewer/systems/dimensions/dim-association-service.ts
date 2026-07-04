/**
 * ADR-362 Phase J2 — Dimension Association Service (pure recompute functions).
 *
 * Two pure functions consumed by the React observer hook and the
 * DimReassociateCommand:
 *
 *   `recomputeAssociatedDefPoint` — derive a new Point2D from current geometry
 *   `applyAssociationUpdates`     — apply all association updates to a dim entity
 *
 * No React, no Firestore, no canvas deps. All geometry reads go through the
 * caller-supplied `getEntity` lookup so tests can inject stubs.
 *
 * Association type semantics:
 *   endpoint    → start (subIndex 0) / end (subIndex 1+) of line or polyline vertex
 *   midpoint    → midpoint of line's start/end, or midpoint of polyline edge
 *   center      → center of circle or arc
 *   nearest     → parametric re-projection on the host (line/polyline `param`=t,
 *                 circle/arc `param`=angle). Legacy capture (no `param`) → preserved.
 *   intersection→ re-solve `geometryId` × `geometryId2` (ADR-362 Phase J3, gap #2).
 *                 Legacy capture (no `geometryId2`) → preserved.
 *
 * @see systems/dimensions/dim-association-graph.ts  — inverse index (J1)
 * @see systems/dimensions/dim-intersection-resolver.ts — intersection re-projection
 * @see hooks/dimensions/useDimAssociationObserver.ts — React mount point
 */

import type { Point2D } from '../../rendering/types/Types';
import type { DimensionEntity, DimensionAssociation } from '../../types/dimension';
import type { SceneEntity } from '../../core/commands/interfaces';
import {
  isLineEntity,
  isPolylineEntity,
  isLWPolylineEntity,
  isCircleEntity,
  isArcEntity,
  isWallEntity,
  type Entity,
} from '../../types/entities';
import { pointOnCircle } from '../../rendering/entities/shared/geometry-vector-utils';
import { resolveIntersectionDefPoint } from './dim-intersection-resolver';
// ADR-563 Φ2 — BIM host bbox→2D SSoT, reused for `bimExtent` re-projection.
import { calculateBimEntity2DBounds } from '../../bim/utils/bim-bounds';
// ADR-362 Phase N — wall span key-points SSoT, reused for pick-entity `endpoint` follow.
import { getBimEntityKeyPoints2D } from '../../bim/utils/bim-entity-points';

/**
 * Optional context for `recomputeAssociatedDefPoint` — only the `intersection`
 * type needs it (to fetch the 2nd host + disambiguate multi-point solutions).
 * Omitting it keeps the legacy 2-arg signature: intersection then preserves.
 */
export interface RecomputeContext {
  /** Resolve a SceneEntity by id (for the 2nd intersection host). */
  readonly resolveEntity?: (id: string) => SceneEntity | undefined;
  /** Current def point position — hint to pick the right intersection branch. */
  readonly currentDefPoint?: Point2D | null;
}

// ─── Internal geometry helpers ────────────────────────────────────────────────

function midpt(a: Point2D, b: Point2D): Point2D {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function lerp(a: Point2D, b: Point2D, t: number): Point2D {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function pointsEqual(a: Point2D, b: Point2D): boolean {
  return a.x === b.x && a.y === b.y;
}

/** Resolve the (start, end) of the polyline edge addressed by `segIndex`. */
function polylineEdge(
  verts: readonly Point2D[],
  segIndex: number,
): readonly [Point2D, Point2D] | null {
  if (verts.length < 2) return null;
  const i = Math.min(Math.max(segIndex, 0), verts.length - 2);
  return [verts[i], verts[i + 1]];
}

/**
 * `nearest` re-projection: evaluate the stored `param` on the CURRENT geometry.
 * Returns null when `param` is absent (legacy preserve) or the shape is unknown.
 */
function recomputeNearest(assoc: DimensionAssociation, e: Entity): Point2D | null {
  if (assoc.param === undefined) return null; // 2026-05-19 hotfix back-compat
  if (isLineEntity(e)) {
    return lerp(e.start, e.end, assoc.param);
  }
  if (isPolylineEntity(e) || isLWPolylineEntity(e)) {
    const edge = polylineEdge(e.vertices, assoc.subIndex ?? 0);
    return edge ? lerp(edge[0], edge[1], assoc.param) : null;
  }
  if (isCircleEntity(e) || isArcEntity(e)) {
    return pointOnCircle(e.center, e.radius, assoc.param);
  }
  return null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Derive the new world position for a single association given the current
 * state of the referenced geometry entity.
 *
 * Returns `null` when:
 *   - `nearest` with no `param` / `intersection` with no `geometryId2` (legacy
 *     capture — position preserved by caller)
 *   - `intersection` whose hosts no longer cross (preserved)
 *   - entity shape doesn't match the expected association type
 */
export function recomputeAssociatedDefPoint(
  assoc: DimensionAssociation,
  entity: SceneEntity,
  ctx?: RecomputeContext,
): Point2D | null {
  const e = entity as unknown as Entity;

  switch (assoc.associationType) {
    case 'endpoint': {
      // ADR-362 2026-05-19 hotfix: when `subIndex` is undefined (e.g. old
      // dims captured before snap-aware association landed), preserve the
      // current defPoint instead of defaulting to `e.end`. Defaulting was
      // snapping committed linear/aligned dims onto the line's far endpoint.
      if (assoc.subIndex === undefined) return null;
      if (isLineEntity(e)) {
        return assoc.subIndex === 0 ? e.start : e.end;
      }
      if (isPolylineEntity(e)) {
        const verts = e.vertices;
        if (!verts?.length) return null;
        return verts[Math.min(assoc.subIndex, verts.length - 1)];
      }
      if (isArcEntity(e)) {
        // ADR-362 Phase J3 — arcLength anchors arcStart (subIndex 0) / arcEnd
        // (subIndex 1) to the arc's own start/end angle so they follow re-shapes.
        const angle = assoc.subIndex === 0 ? e.startAngle : e.endAngle;
        return pointOnCircle(e.center, e.radius, angle);
      }
      if (isWallEntity(e)) {
        // ADR-362 Phase N — pick-entity span endpoints ride the wall's centerline
        // key-points (subIndex 0 = first, else last) so the dim tracks moves/resizes.
        const kp = getBimEntityKeyPoints2D(e);
        if (kp.length < 2) return null;
        return assoc.subIndex === 0 ? kp[0] : kp[kp.length - 1];
      }
      return null;
    }

    case 'midpoint': {
      if (isLineEntity(e)) {
        return midpt(e.start, e.end);
      }
      if (isPolylineEntity(e)) {
        const verts = e.vertices;
        if (!verts || verts.length < 2) return null;
        const idx = assoc.subIndex ?? 0;
        const a = verts[Math.min(idx, verts.length - 1)];
        const b = verts[Math.min(idx + 1, verts.length - 1)];
        return midpt(a, b);
      }
      return null;
    }

    case 'center': {
      if (isCircleEntity(e)) return e.center;
      if (isArcEntity(e)) return e.center;
      return null;
    }

    case 'nearest':
      // ADR-362 Phase J3 — parametric re-projection on the current geometry.
      return recomputeNearest(assoc, e);

    case 'intersection': {
      // ADR-362 Phase J3 — re-solve geometryId × geometryId2. Legacy capture
      // (no geometryId2) or missing 2nd host / no-longer-crossing → preserve.
      if (!assoc.geometryId2) return null;
      const e2raw = ctx?.resolveEntity?.(assoc.geometryId2);
      if (!e2raw) return null;
      return resolveIntersectionDefPoint(
        e,
        e2raw as unknown as Entity,
        ctx?.currentDefPoint ?? null,
      );
    }

    case 'bimExtent': {
      // ADR-563 Φ2 — auto-dimension anchor to a BIM host's 2D bbox extent,
      // locked to the parent dim's measured axis. Reuses the bbox→2D SSoT so
      // the follow-on-move matches exactly how the extraction picked the point.
      const anchor = assoc.bimAnchor;
      if (!anchor) return null;
      const bounds = calculateBimEntity2DBounds(e);
      if (!bounds) return null;
      const lo = anchor.axis === 'x' ? bounds.min.x : bounds.min.y;
      const hi = anchor.axis === 'x' ? bounds.max.x : bounds.max.y;
      const coord = anchor.edge === 'min' ? lo : anchor.edge === 'max' ? hi : (lo + hi) / 2;
      // Update only the measured axis; keep the perpendicular (extension baseline).
      const current = ctx?.currentDefPoint ?? null;
      return anchor.axis === 'x'
        ? { x: coord, y: current?.y ?? 0 }
        : { x: current?.x ?? 0, y: coord };
    }

    default: {
      const _exhaustive: never = assoc.associationType;
      void _exhaustive;
      return null;
    }
  }
}

/**
 * Apply all association updates to a dimension entity and return the result.
 *
 * - Missing geometry entity → association is **orphaned**: defPoint preserved,
 *   `orphanCount` incremented (caller can show visual indicator).
 * - Unchanged position → defPoint array reference preserved (no allocation).
 * - Returns the **same `dim` reference** when nothing changed (identity check
 *   lets the caller skip the updateEntity call efficiently).
 */
export function applyAssociationUpdates(
  dim: DimensionEntity,
  getEntity: (id: string) => SceneEntity | undefined,
): { updated: DimensionEntity; orphanCount: number } {
  if (!dim.associations?.length) {
    return { updated: dim, orphanCount: 0 };
  }

  let orphanCount = 0;
  let newDefPoints: Point2D[] | null = null;

  for (const assoc of dim.associations) {
    const geoEntity = getEntity(assoc.geometryId);
    if (!geoEntity) {
      orphanCount++;
      continue;
    }

    const idx = assoc.defPointIndex;
    const currentPt = dim.defPoints[idx];

    const newPt = recomputeAssociatedDefPoint(assoc, geoEntity, {
      resolveEntity: getEntity,
      currentDefPoint: currentPt ?? null,
    });
    if (newPt === null) continue;

    if (!currentPt || pointsEqual(currentPt, newPt)) continue;

    if (!newDefPoints) {
      newDefPoints = [...dim.defPoints] as Point2D[];
    }
    newDefPoints[idx] = newPt;
  }

  if (!newDefPoints) {
    return { updated: dim, orphanCount };
  }

  return {
    updated: { ...dim, defPoints: newDefPoints as readonly Point2D[] },
    orphanCount,
  };
}
