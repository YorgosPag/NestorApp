/**
 * Wall ↔ Structural-Host Coordinator — ADR-401 Phase C (attach-to-structural).
 *
 * Walls can "attach" their top to a structural host (beam / slab) via
 * `WallParams.attachTopToIds` (Revit "Attach Top"). The wall's vertical extent
 * is a PURE derivation of the live scene: `BimSceneLayer.syncWalls` (3D),
 * `section-intersect` (2D section) and `wall-boq-feed` (BOQ) each rebuild the
 * `WallTopProfile` from the CURRENT beams/slabs on every resync — so a host
 * *move / rotate / resize* already flows to the wall with zero extra wiring
 * (`use-bim3d-sync` re-runs on any entity change). That associative behaviour
 * needs no persisted cascade.
 *
 * The ONE gap is host *deletion*: when a host that a wall attaches to is
 * removed, `resolveWallTopProfile` reports it via `missingHostIds` and falls
 * back to the baseline top — correct, but SILENT. This module closes that gap:
 * it detects the affected walls and emits a single decoupled event so the UI
 * can warn the user (Revit "Wall's Top Constraint is no longer valid").
 *
 * Deliberately NO mutation of `attachTopToIds`: the dangling ref is harmless
 * (the resolver neutralises missing hosts every recompute) and keeping it lets
 * an *undo* of the delete re-attach the wall automatically — removing it would
 * break that round-trip for zero functional gain.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-401-bim-wall-top-base-constraints-attach-to-structural.md
 * @see bim/cascade/bim-cascade-resolver.ts — `findAttachedWalls` (reverse lookup)
 * @see bim/geometry/wall-top-profile.ts — `missingHostIds` (graceful fallback)
 */

import type { ISceneManager, SceneEntity } from '../../core/commands/interfaces';
import type { Entity } from '../../types/entities';
import { findAttachedWalls } from '../cascade/bim-cascade-resolver';
import { EventBus } from '../../systems/events/EventBus';

/**
 * Minimal scene-manager surface the coordinator needs. `getEntities` is
 * optional (real adapters implement it; lightweight test mocks may omit it →
 * the helper no-ops safely).
 */
type CoordinatorSceneManager = Pick<ISceneManager, 'getEntity'> & {
  getEntities?(): readonly SceneEntity[];
};

/**
 * After one or more structural hosts have been deleted, find every `attached`
 * wall that referenced any of them and emit a single
 * `bim:wall-attach-host-missing` event (no-op when none are affected). Pure
 * detection + signal — does not mutate the scene. Returns the affected wall
 * ids (for callers / tests).
 *
 * Call this AFTER the host removal has landed: the affected walls remain in the
 * scene (only their host is gone), so the reverse lookup still resolves them.
 */
export function notifyWallsOnHostDeletion(
  deletedHostIds: readonly string[],
  sceneManager: CoordinatorSceneManager,
): string[] {
  if (deletedHostIds.length === 0) return [];
  const all = sceneManager.getEntities?.();
  if (!all) return [];

  const wallIds = findAttachedWalls(
    new Set(deletedHostIds),
    all as unknown as readonly Entity[],
  );
  if (wallIds.length > 0) {
    EventBus.emit('bim:wall-attach-host-missing', {
      wallIds,
      deletedHostIds: [...deletedHostIds],
    });
  }
  return wallIds;
}
