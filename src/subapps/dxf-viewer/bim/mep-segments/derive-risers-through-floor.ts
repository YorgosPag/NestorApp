/**
 * derive-risers-through-floor — ADR-408 Φ15 Task B (cross-floor «riser through»).
 *
 * Pure SSoT for the Revit «cut plane» annotation: given the vertical `mep-segment`
 * risers of OTHER building floors and the active floor's FFL (datum-relative mm),
 * returns one plan mark per riser whose z-span passes through that FFL — a small
 * circle + up/down arrow drawn on the floor it crosses, so the engineer sees that
 * a stack passes through their level even though it is authored elsewhere.
 *
 * Single source of truth = the base-floor riser segments themselves (zero
 * duplicate persistence). The owner floor — the one where the riser is authored
 * (its `startPoint`, base of the span) — is EXCLUDED here: there the full riser
 * glyph is drawn by `MepSegmentRenderer.renderRiser` (the segment lives in that
 * floor's scene), so a through-mark would double it.
 *
 * Convention: `startPoint.z` / `endPoint.z` are datum-relative mm
 * (`resolveSegmentEndpointElevationsMm`), the SAME space as the floor FFL derived
 * via `resolveFloorDatumRelativeElevationMm`, so the comparison is direct.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md §Φ15
 */

import type { Point2D } from '../../rendering/types/Types';
import type { MepSegmentEntity } from '../types/mep-segment-types';
import type { PlumbingSystemClassification } from '../types/mep-connector-types';
import {
  isSegmentVertical,
  riserDirection,
  resolveSegmentEndpointElevationsMm,
} from '../types/mep-segment-types';

/**
 * Boundary tolerance (mm) for the FFL-in-span test and the owner-floor exclusion —
 * absorbs floating-point drift between a floor's derived FFL and a riser endpoint
 * snapped to it.
 */
export const RISER_THROUGH_FFL_TOLERANCE_MM = 1;

/** A derived riser plan mark on a floor the stack passes through. */
export interface RiserThroughMark {
  /** Riser centre in WORLD plan coords (XY) — project via `worldToScreen`. */
  readonly centreXY: Point2D;
  /** `'up'` if the stack rises past this floor, `'down'` if it drops. */
  readonly direction: 'up' | 'down';
  /** System classification of the source riser — drives the glyph colour (Revit:
   *  a cut riser keeps its system colour). `undefined` → default palette. */
  readonly classification?: PlumbingSystemClassification;
}

/**
 * Marks for every vertical riser in `verticalSegments` whose datum-relative z-span
 * contains `currentFloorElevMm`, excluding risers whose base (authored
 * `startPoint`) sits at that FFL (the owner floor draws the full glyph).
 *
 * Non-vertical / degenerate segments are skipped (geometry-driven via
 * `isSegmentVertical`). The caller supplies only NON-active-floor segments, so the
 * active floor is never an owner here — the explicit owner exclusion below also
 * guards the defensive case of a riser based on a coincident floor elevation.
 */
export function deriveRisersThroughFloor(
  verticalSegments: readonly MepSegmentEntity[],
  currentFloorElevMm: number,
): RiserThroughMark[] {
  const tol = RISER_THROUGH_FFL_TOLERANCE_MM;
  const marks: RiserThroughMark[] = [];

  for (const seg of verticalSegments) {
    if (!isSegmentVertical(seg.params)) continue;

    const { startMm, endMm } = resolveSegmentEndpointElevationsMm(seg.params);
    const lo = Math.min(startMm, endMm);
    const hi = Math.max(startMm, endMm);

    // Out of the riser's vertical span → does not cross this floor.
    if (currentFloorElevMm < lo - tol || currentFloorElevMm > hi + tol) continue;
    // Owner floor (authored base) → renderRiser draws the full glyph there.
    if (Math.abs(currentFloorElevMm - startMm) <= tol) continue;

    marks.push({
      centreXY: { x: seg.params.startPoint.x, y: seg.params.startPoint.y },
      direction: riserDirection(seg.params),
      classification: seg.params.classification,
    });
  }

  return marks;
}
