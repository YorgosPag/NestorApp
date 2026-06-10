/**
 * ADR-408 Φ-C — SSoT builder for the connected-pipe GHOST set during a host move.
 *
 * When a plumbing host (sink / manifold / boiler / radiator / water-heater) is being
 * dragged, the pipe ends snapped to its connectors must visibly FOLLOW it (Revit
 * "connectors move with host"). This pure builder produces the ghost segment entities
 * — each connected segment with its endpoints retargeted AND its geometry recomputed
 * — ready for ANY renderer to paint.
 *
 * SSoT, single source for every preview surface:
 *   - the 2D `useGripGhostPreview` ghost (PreviewCanvas), and
 *   - any future 3D pipe ghost (ADR-040 proposal-ghost 3Δ family).
 * Both call THIS so the followed-pipe geometry is derived once, identically.
 *
 * Reuses the SAME pure resolver the connectivity-preserving COMMIT uses
 * (`resolveHostMoveConnectedPipePatches`) — so the ghost the user sees during the
 * drag is geometrically identical to what lands on drop (ghost === commit). The only
 * extra step here is recomputing each segment's `geometry` from the retargeted
 * endpoints, because renderers paint a segment from its precomputed `geometry`, not
 * from `params`.
 *
 * Pure: no store / Firestore / command / React / canvas. Returns `[]` for a
 * non-plumbing host (the resolver short-circuits on `pointHostMountingElevationMm`).
 *
 * @see ./mep-move-propagation.ts — resolveHostMoveConnectedPipePatches (the resolver)
 * @see ./build-connectivity-host-update.ts — the COMMIT-side sibling (same resolver)
 * @see ../geometry/mep-segment-geometry.ts — computeMepSegmentGeometry (SSoT geometry)
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md §Φ-C
 */

import type { Entity } from '../../types/entities';
import type { MepSegmentEntity } from '../types/mep-segment-types';
import { resolveHostMoveConnectedPipePatches } from './mep-move-propagation';
import { computeMepSegmentGeometry } from '../geometry/mep-segment-geometry';

/**
 * Build the ghost segment entities for every pipe end snapped to a moving host's
 * connectors. `prevHost`/`nextHost` are the same entity before vs after the move.
 * Each returned segment carries the retargeted `params` AND a freshly computed
 * `geometry` (so renderers paint it at the new position). Empty when nothing follows.
 */
export function buildConnectedPipeGhosts(
  entities: readonly Entity[],
  prevHost: Entity,
  nextHost: Entity,
): MepSegmentEntity[] {
  const patches = resolveHostMoveConnectedPipePatches(entities, prevHost, nextHost);
  return patches.map((patch) => ({
    ...patch.segment,
    params: patch.nextParams,
    geometry: computeMepSegmentGeometry(patch.nextParams),
  }));
}
