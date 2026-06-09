/**
 * opening-siblings — pure SSoT for "the other openings hosted on the same wall"
 * (ADR-363 Φ1G.5 Slice 2f, Revit temporary/listening dimensions).
 *
 * The temporary-dimension overlay needs the neighbouring openings on the host wall
 * to find the nearest reference jamb on each side of the dragged opening. This is
 * the pure filter+sort building block (the existing `filterHostedOpenings` is bound
 * to the 2D SyncContext, so it is not reusable here — this is the unit-testable SSoT).
 */

import type { OpeningEntity } from '../types/opening-types';

/**
 * The openings hosted on `wallId`, excluding `excludeId` (the dragged opening),
 * sorted ascending by `offsetFromStart` (left→right along the wall axis).
 */
export function getSiblingOpeningsOnWall(
  wallId: string,
  allOpenings: readonly OpeningEntity[],
  excludeId: string,
): OpeningEntity[] {
  return allOpenings
    .filter((o) => o.params.wallId === wallId && o.id !== excludeId)
    .sort((a, b) => a.params.offsetFromStart - b.params.offsetFromStart);
}
