/**
 * ADR-650 M8β/Γ — the ONE impure resolver «where does this breakline CANDIDATE sit in the 3D world?».
 *
 * The auto-breakline twin of {@link resolveTopoQaFlagWorld}, and it exists for the same reason: the
 * panel's «zoom to» (camera framing) and the 3D candidate layer (the drawn line) must agree about
 * where a proposal is, or a row click would frame empty ground a few metres off its own green line.
 * Both go through the SAME three transforms the terrain mesh uses, resolved from the SAME SSoTs
 * (`getActiveWorldToDisplayProjector`, `getActiveVerticalDatumMm`).
 *
 * ### Why this one cannot fail to find an elevation (and QA's can)
 * A QA flag is a POINT that sometimes carries no Z of its own — a ring centroid has none — so its
 * resolver samples the TIN underneath and returns `null` when even that cannot answer. A candidate
 * is chained from TIN edges, so every one of its vertices carries a real surveyed elevation: the
 * chain's own mean Z is a MEASURED height of the feature, not an invented one. No sampling, no
 * store read for the elevation, and a `null` only when the coordinates are genuinely non-finite.
 *
 * The mean, not the first vertex: a road edge that falls 4 m along its length would otherwise pull
 * the camera to one end of what the engineer asked to see the whole of.
 *
 * Note the 50 mm `TERRAIN_DISPLAY_DROP_MM` that seats the terrain layers a hair below internal z=0
 * is deliberately NOT applied here. It is a display nudge owned by the scene-layer ROOT (so mesh,
 * contours and candidates drop together); a camera target is framed in metres, where 50 mm is
 * nothing. Applying it here would make this resolver disagree with the QA one for no visible gain.
 *
 * @see ./topo-world-point-math.ts — the pure transform chain
 * @see ./topo-qa-flag-world.ts — the QA sibling
 * @see ../converters/auto-breakline-to-three.ts — the same chain, for the drawn lines
 */

import type { Point2D } from '../../rendering/types/Types';
import type { AutoBreaklineCandidate } from '../../systems/topography/auto-breaklines/auto-breakline-types';
import { getActiveVerticalDatumMm } from '../../systems/topography/vertical-datum';
import { getActiveWorldToDisplayProjector } from '../../systems/geo-referencing/geo-reference-store';
import { topoWorldPointToThree } from './topo-world-point-math';
import type { WorldTriple } from '../viewport/plan-to-world-math';

/**
 * Mean WORLD elevation (canonical mm) of a candidate's vertices, ignoring non-finite ones.
 * `null` when not a single vertex has a usable Z — the caller must then not move the camera.
 * Pure: exported so the anchoring rule can be pinned by tests without a store.
 */
export function meanCandidateElevationMm(candidate: AutoBreaklineCandidate): number | null {
  let sum = 0;
  let count = 0;
  for (const v of candidate.vertices) {
    if (!Number.isFinite(v.z)) continue;
    sum += v.z;
    count += 1;
  }
  return count === 0 ? null : sum / count;
}

/**
 * Where a candidate should be framed in the three-world (metres, Y-up), or `null` when its
 * elevation or `centre` is non-finite — in which case the caller MUST leave the camera alone
 * rather than fly it to an invented height.
 *
 * `centre` comes from the caller's `reviewFocusExtent`, so the 2D fit and the 3D framing target the
 * very same spot; deriving it a second time here is exactly how the two would drift apart.
 */
export function resolveAutoBreaklineCandidateWorld(
  candidate: AutoBreaklineCandidate,
  centre: Point2D,
): WorldTriple | null {
  const elevationMm = meanCandidateElevationMm(candidate);
  if (elevationMm === null) return null;
  return topoWorldPointToThree(centre, elevationMm, {
    projector: getActiveWorldToDisplayProjector(),
    datumMm: getActiveVerticalDatumMm(),
  });
}
