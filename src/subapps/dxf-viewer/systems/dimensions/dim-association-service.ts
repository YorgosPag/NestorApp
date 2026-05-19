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
 *   intersection/ nearest → position PRESERVED (complex; deferred to Phase J+)
 *
 * @see systems/dimensions/dim-association-graph.ts  — inverse index (J1)
 * @see hooks/dimensions/useDimAssociationObserver.ts — React mount point
 */

import type { Point2D } from '../../rendering/types/Types';
import type { DimensionEntity, DimensionAssociation } from '../../types/dimension';
import type { SceneEntity } from '../../core/commands/interfaces';
import {
  isLineEntity,
  isPolylineEntity,
  isCircleEntity,
  isArcEntity,
  type Entity,
} from '../../types/entities';

// ─── Internal geometry helpers ────────────────────────────────────────────────

function midpt(a: Point2D, b: Point2D): Point2D {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function pointsEqual(a: Point2D, b: Point2D): boolean {
  return a.x === b.x && a.y === b.y;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Derive the new world position for a single association given the current
 * state of the referenced geometry entity.
 *
 * Returns `null` when:
 *   - association type is `intersection` or `nearest` (position preserved by caller)
 *   - entity shape doesn't match the expected association type
 */
export function recomputeAssociatedDefPoint(
  assoc: DimensionAssociation,
  entity: SceneEntity,
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

    case 'intersection':
    case 'nearest':
      // Position is geometry-order-dependent — preserve current defPoint.
      return null;

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

    const newPt = recomputeAssociatedDefPoint(assoc, geoEntity);
    if (newPt === null) continue;

    const idx = assoc.defPointIndex;
    const currentPt = dim.defPoints[idx];
    if (!currentPt || pointsEqual(currentPt, newPt)) continue;

    if (!newDefPoints) {
      newDefPoints = [...dim.defPoints] as Point2D[];
    }
    newDefPoints[idx] = newPt;
  }

  if (!newDefPoints) {
    return { updated: dim, orphanCount };
  }

  // [DIM-DIAG R3] TEMPORARY — log every observer-driven defPoint mutation.
  // eslint-disable-next-line no-console
  console.warn('[DIM-DIAG R3] applyAssociationUpdates mutated', {
    dimId: dim.id,
    before: dim.defPoints.map((p) => ({ x: p.x.toFixed(2), y: p.y.toFixed(2) })),
    after: (newDefPoints as Point2D[]).map((p) => ({ x: p.x.toFixed(2), y: p.y.toFixed(2) })),
    associations: dim.associations,
  });

  return {
    updated: { ...dim, defPoints: newDefPoints as readonly Point2D[] },
    orphanCount,
  };
}
