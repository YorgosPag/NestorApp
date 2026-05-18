/**
 * ADR-359 Phase 11 follow-up — Spatial-index bounds for XLINE / RAY entities.
 *
 * Standalone helpers extracted from `Bounds.ts` to keep that file within the
 * 500-line Google budget (CLAUDE.md N.7.1). XLINE = infinite line in both
 * directions (large nominal square around basePoint). RAY = one-directional
 * (basePoint → direction × EXTENT). Without these bounds, the spatial index
 * never receives the entity → unselectable / no hover.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-359-auxiliary-geometry-tools.md §11
 */

import type { EntityModel } from '../types/Types';
import { createBoundingBox, type BoundingBox } from './Bounds';

const EXTENT = 10000;

export function calculateXLineBounds(entity: EntityModel, tolerance: number): BoundingBox | null {
  type XLike = { basePoint?: { x: number; y: number } };
  const bp = (entity as XLike).basePoint;
  if (!bp) return null;
  return createBoundingBox(
    bp.x - EXTENT - tolerance,
    bp.y - EXTENT - tolerance,
    bp.x + EXTENT + tolerance,
    bp.y + EXTENT + tolerance,
  );
}

export function calculateRayBounds(entity: EntityModel, tolerance: number): BoundingBox | null {
  type RLike = { basePoint?: { x: number; y: number }; direction?: { x: number; y: number } };
  const rl = entity as RLike;
  if (!rl.basePoint) return null;
  const bx = rl.basePoint.x;
  const by = rl.basePoint.y;
  if (!rl.direction) {
    return createBoundingBox(bx - tolerance, by - tolerance, bx + EXTENT + tolerance, by + EXTENT + tolerance);
  }
  const ex = bx + rl.direction.x * EXTENT;
  const ey = by + rl.direction.y * EXTENT;
  return createBoundingBox(
    Math.min(bx, ex) - tolerance,
    Math.min(by, ey) - tolerance,
    Math.max(bx, ex) + tolerance,
    Math.max(by, ey) + tolerance,
  );
}
