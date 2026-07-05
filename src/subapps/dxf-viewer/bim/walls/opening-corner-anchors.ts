/**
 * ADR-370 §5.5 — Opening face-corner world-point exposure (pure SSoT).
 *
 * Exposes the **4 face corners** of a BIM opening (door / window / etc.) as
 * world-coordinate snap targets. These are the 4 vertices of the opening
 * cutout outline rectangle stored in `OpeningEntity.geometry.outline`.
 *
 * Opening is hosted by a wall (FK = `params.wallId`). The cutout outline is
 * already in world coordinates (computed by `computeOpeningGeometry` with
 * the host-wall axis direction factored in). This module does NOT need the
 * host wall reference at call time — the 4 world-coordinate corner points
 * are read directly from the cached geometry.
 *
 * Corner labeling follows the opening's local coordinate system:
 *   - `innerStart`  = outline vertex 0 (inner-face / room-side, at offsetFromStart)
 *   - `innerEnd`    = outline vertex 1 (inner-face, at offsetFromStart + width)
 *   - `outerEnd`    = outline vertex 2 (outer-face, at offsetFromStart + width)
 *   - `outerStart`  = outline vertex 3 (outer-face, at offsetFromStart)
 *
 * (CCW winding matches `computeOpeningGeometry` convention.)
 *
 * Degenerate openings (width or height ≤ 0, outline.vertices.length ≠ 4) →
 * returns [] rather than throwing — matches the defensive null-safety pattern
 * of sibling anchor modules.
 *
 * Pure module: zero React / DOM / Firestore / canvas deps. Idempotent.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-370-bim-corner-snap-system.md §5.5
 * @see bim/types/opening-types.ts  (OpeningGeometry.outline — SSoT vertex source)
 * @see bim/columns/column-anchors.ts  (pattern reference)
 */

import type { Point2D } from '../../rendering/types/Types';
import type { OpeningEntity } from '../types/opening-types';
import { projectPointTo2D } from '../geometry/shared/polygon-utils';

// ─── Tagged result ─────────────────────────────────────────────────────────────

/** Semantic label for each of the 4 opening corners. */
export type OpeningCornerLabel =
  | 'innerStart'
  | 'innerEnd'
  | 'outerEnd'
  | 'outerStart';

/** Labels in CCW order matching `computeOpeningGeometry` outline winding. */
const CORNER_ORDER: readonly OpeningCornerLabel[] = [
  'innerStart',
  'innerEnd',
  'outerEnd',
  'outerStart',
];

/**
 * Tagged opening corner world point.
 * `corner` enables downstream debug tooltips ("snapped to opening outerStart corner").
 */
export interface OpeningCornerWorldPoint {
  readonly corner: OpeningCornerLabel;
  readonly point: Point2D;
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Compute the 4 face-corner world points for an opening entity.
 *
 * Uses the cached `entity.geometry.outline.vertices` (4 vertices, CCW).
 * Returns exactly 4 entries when geometry is valid, [] otherwise.
 */
export function getOpeningCornerWorldPoints(
  opening: Readonly<OpeningEntity>,
): readonly OpeningCornerWorldPoint[] {
  const verts = opening.geometry.outline.vertices;
  if (verts.length !== 4) return [];
  return CORNER_ORDER.map((corner, i) => ({ corner, point: projectPointTo2D(verts[i]) }));
}
