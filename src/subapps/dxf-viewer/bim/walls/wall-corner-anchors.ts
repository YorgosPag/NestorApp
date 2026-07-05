/**
 * ADR-370 §5.1 — Wall face-corner world-point exposure (pure SSoT).
 *
 * Exposes the **4 face corners** of a BIM wall entity as world-coordinate
 * snap targets: 2 corners on the outer edge (start + end) and 2 on the
 * inner edge (start + end). These are the precise termination points of
 * the `outerEdge` / `innerEdge` polylines returned by `computeWallGeometry`.
 *
 * For a straight wall the 4 corners form the 4 vertices of the plan-view
 * rectangle. For curved / polyline walls only the START and END face corners
 * are exposed (not all Bezier subdivision vertices) — a deliberate design
 * decision to avoid snap noise on long curved walls (ADR-370 §2.3).
 *
 * Pure module: zero React / DOM / Firestore / canvas deps. Idempotent.
 * Re-derives geometry from `params` on every call — geometry cache is
 * intentionally NOT read so that callers need not worry about stale cache.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-370-bim-corner-snap-system.md §5.1
 * @see bim/geometry/wall-geometry.ts (computeWallGeometry — SSoT geometry source)
 * @see bim/columns/column-anchors.ts  (pattern reference)
 */

import type { Point2D } from '../../rendering/types/Types';
import type { WallEntity } from '../types/wall-types';
import { computeWallGeometry } from '../geometry/wall-geometry';
import { projectPointTo2D } from '../geometry/shared/polygon-utils';

// ─── Tagged result ─────────────────────────────────────────────────────────────

/** Which of the two face-edges the corner belongs to. */
export type WallFaceSide = 'outer' | 'inner';

/** Which end of the wall axis the corner sits on. */
export type WallAxisEnd = 'start' | 'end';

/**
 * Tagged wall face-corner world point.
 * `side` + `end` together uniquely identify which of the 4 corners this is.
 * Enables downstream debug tooltips ("snapped to wall outer-end corner") and
 * per-corner priority weighting in future phases.
 */
export interface WallCornerWorldPoint {
  readonly side: WallFaceSide;
  readonly end: WallAxisEnd;
  readonly point: Point2D;
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Compute the 4 face-corner world points for a wall entity.
 *
 * Order (matches CCW rectangle for straight walls):
 *   [0] outer-start, [1] outer-end, [2] inner-end, [3] inner-start
 *
 * For curved / polyline walls the result is still exactly 4 points —
 * the start and end of each edge polyline — NOT all intermediate vertices.
 *
 * Degenerate walls (start === end, zero thickness) → all 4 collapse to
 * the same point; callers de-duplicate via spatial index.
 */
export function getWallCornerWorldPoints(
  wall: Readonly<WallEntity>,
): readonly WallCornerWorldPoint[] {
  const geo = computeWallGeometry(wall.params, wall.kind);
  const outer = geo.outerEdge.points;
  const inner = geo.innerEdge.points;

  return [
    { side: 'outer', end: 'start', point: projectPointTo2D(outer[0]) },
    { side: 'outer', end: 'end',   point: projectPointTo2D(outer[outer.length - 1]) },
    { side: 'inner', end: 'end',   point: projectPointTo2D(inner[inner.length - 1]) },
    { side: 'inner', end: 'start', point: projectPointTo2D(inner[0]) },
  ];
}
