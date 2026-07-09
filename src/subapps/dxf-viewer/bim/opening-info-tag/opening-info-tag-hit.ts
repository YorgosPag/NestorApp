/**
 * ADR-612 — Opening Info Tag hit-test + broad-phase bounds SSoT.
 *
 * SIBLING of `bim/scale-bar/scale-bar-hit.ts` (ADR-583 Φ2). Unlike the
 * scale-bar — which mixes a scale-invariant axis span with an annotative
 * *paper* thickness folded through the live `drawingScale` — the opening
 * info tag lives ENTIRELY in world canonical-mm (`types/opening-info-tag.ts`
 * §Sizing model): the whole box scales with the drawing, no annotative term.
 * The precise pick and the broad-phase bbox therefore both reduce to the ONE
 * rotated-box primitives already derived by `opening-info-tag-geometry.ts` —
 * no half-thickness padding term, just a plain tolerance pad on both.
 *
 * This is the ONE place the hit-test/bounds consumers agree (N.18 anti-clone):
 *   - `performDetailedHitTest`               — the spatial-index narrow phase (hover/click)
 *   - `BoundsCalculator.calculateEntityBounds` broad phase
 *   - `ENTITY_BOUNDS_PROVIDERS['opening-info-tag']` — marquee-select bounds
 *
 * @see bim/opening-info-tag/opening-info-tag-geometry.ts — bbox / rotated point-in-box SSoT
 * @see bim/scale-bar/scale-bar-hit.ts — the sibling this file mirrors
 * @see docs/centralized-systems/reference/adrs/ADR-612-opening-info-tag.md
 */

import type { Point2D } from '../../rendering/types/Types';
import {
  computeOpeningInfoTagGeometry,
  openingInfoTagContainsWorld,
} from './opening-info-tag-geometry';
import type { OpeningInfoTagBBox, OpeningInfoTagEntity } from '../../types/opening-info-tag';

/**
 * Precise pick: true when `worldPoint` lands inside the (rotated) box, padded
 * by `toleranceMm`. Delegates to the ONE rotated point-in-box test the
 * renderer / inline editor also use (N.18) — mirrors `hitTestScaleBarAxis`'s
 * boolean return shape so both narrow-phase call sites stay uniform.
 */
export function hitTestOpeningInfoTag(
  entity: OpeningInfoTagEntity,
  worldPoint: Point2D,
  toleranceMm = 0,
): boolean {
  return openingInfoTagContainsWorld(entity, worldPoint, toleranceMm);
}

/**
 * Broad-phase bbox (world canonical-mm), padded by `toleranceMm` — the raw
 * `{minX,minY,maxX,maxY}` shape both `BoundsCalculator` (which wraps it via
 * its own `createBoundingBox`) and `ENTITY_BOUNDS_PROVIDERS` expect. Reuses
 * the DERIVED rotation-aware AABB (`computeOpeningInfoTagGeometry`), never a
 * re-derived one (N.18).
 */
export function calculateOpeningInfoTagBounds(
  entity: OpeningInfoTagEntity,
  toleranceMm = 0,
): OpeningInfoTagBBox {
  const { bbox } = computeOpeningInfoTagGeometry(entity);
  if (toleranceMm === 0) return bbox;
  return {
    minX: bbox.minX - toleranceMm,
    minY: bbox.minY - toleranceMm,
    maxX: bbox.maxX + toleranceMm,
    maxY: bbox.maxY + toleranceMm,
  };
}
