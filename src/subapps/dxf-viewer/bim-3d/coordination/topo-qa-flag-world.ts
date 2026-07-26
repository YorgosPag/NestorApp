/**
 * ADR-650 M5α.2 — the ONE impure resolver «where does this QA flag sit in the 3D world?».
 *
 * Both consumers of a flag's 3D position go through here: the marker overlay (draws a ⊙ there
 * every frame the camera moves) and the report panel (frames the camera there on a row click).
 * If they resolved it separately, a marker and its own «zoom to» could point at different spots —
 * the failure mode is invisible in code review and obvious only to the surveyor on screen.
 *
 * It is the impure half of the pure/impure split `TerrainSceneLayer` uses: the store reads live
 * HERE, the math lives in {@link topoQaFlagToWorld}, and both read the SAME SSoTs the terrain mesh
 * reads (`getActiveWorldToDisplayProjector`, `getActiveVerticalDatumMm`) — so a marker cannot seat
 * differently from the hill it is flagging.
 *
 * ### The missing elevation
 * A flag carries `atZMm` only when its check genuinely knows one (a node's Z, a shot's Z, an edge's
 * mean Z). A ring centroid — the boundary/self-intersection flags — has no elevation of its own, so
 * we SAMPLE the surface underneath it (`getTinSampler`, barycentric). If even that cannot answer
 * (the centroid of a concave ring can fall outside the triangulation), the result is `null` and the
 * marker is hidden. «I don't know where this is vertically» must not become «it is at zero»: a
 * marker parked on the datum plane would send the engineer to inspect the wrong place entirely —
 * the same fail-closed discipline as `resolveFinishedGradeAtWorldMm` (ADR-713).
 *
 * @see ./topo-qa-marker-math.ts — the pure transform chain
 * @see ../../systems/topography/tin-sampler.ts — barycentric elevation lookup
 */

import type { TopoQaFlag } from '../../systems/topography/qa/topo-qa-types';
import type { TopoSurfaceId } from '../../systems/topography/topo-types';
import { getTopoSurface } from '../../systems/topography/topo-surface';
import { getTinSampler } from '../../systems/topography/tin-sampler';
import { getActiveVerticalDatumMm } from '../../systems/topography/vertical-datum';
import { getActiveWorldToDisplayProjector } from '../../systems/geo-referencing/geo-reference-store';
import { topoQaFlagToWorld } from './topo-qa-marker-math';
import type { WorldTriple } from '../viewport/plan-to-world-math';

/** The flag's real WORLD elevation (canonical mm), or `null` when nothing can answer for it. */
function resolveElevationMm(flag: TopoQaFlag, surfaceId: TopoSurfaceId): number | null {
  if (flag.atZMm !== undefined && Number.isFinite(flag.atZMm)) return flag.atZMm;
  return getTinSampler(getTopoSurface(surfaceId)).zAtMm(flag.at.x, flag.at.y);
}

/**
 * Where a QA flag sits in the three-world (metres, Y-up), or `null` when its elevation is unknown
 * or its coordinates are non-finite — in which case the caller MUST hide the marker rather than
 * place it at an invented height.
 */
export function resolveTopoQaFlagWorld(
  flag: TopoQaFlag,
  surfaceId: TopoSurfaceId,
): WorldTriple | null {
  const elevationMm = resolveElevationMm(flag, surfaceId);
  if (elevationMm === null) return null;
  return topoQaFlagToWorld(flag.at, elevationMm, {
    projector: getActiveWorldToDisplayProjector(),
    datumMm: getActiveVerticalDatumMm(),
  });
}
