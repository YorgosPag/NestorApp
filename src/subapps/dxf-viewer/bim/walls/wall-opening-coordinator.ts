/**
 * Wall-Opening Coordinator — ADR-363 §5.4 (hosted-opening cascade SSoT).
 *
 * Openings are stored parametrically: `OpeningParams.wallId` + `offsetFromStart`
 * (mm along the host axis). Their WORLD geometry (outline / position / hingeArc /
 * bbox) is a pure derivation `computeOpeningGeometry(params, hostWall)`. That
 * cache is only refreshed when the opening itself is edited — so ANY change to
 * the host wall's geometry (move / rotate / mirror / grip / endpoint / thickness
 * / length-edit / ribbon) left the opening rendering at its OLD position.
 *
 * This module is the single place that fixes it: whenever a wall's geometry
 * changes, every opening hosted on that wall is recomputed ATOMICALLY against
 * the new wall, keeping the SAME `offsetFromStart` (Giorgio 2026-05-29: a length
 * change keeps the opening at its absolute distance from the wall start, Revit
 * "location line" semantics — NOT proportional).
 *
 * Two integration families, ONE recompute mechanism:
 *   A) Param paths (grip / length-edit / ribbon / bulk) — `UpdateWallParamsCommand`
 *      calls `cascadeHostedOpeningsForWalls([wallId])` after patching the wall.
 *   B) Transform paths — `Move/Rotate/Mirror/Scale` commands call
 *      `cascadeHostedOpeningsForWalls(entityIds)` after applying their batch.
 *
 * Geometry is derived, so undo/redo needs NO opening snapshots: re-running the
 * cascade against the restored wall recomputes the previous geometry.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.4
 * @see bim/cascade/bim-cascade-resolver.ts — `findHostedOpenings` (wallId scan)
 * @see bim/geometry/opening-geometry.ts — `computeOpeningGeometry` (the SSoT)
 */

import type { ISceneManager, SceneEntity } from '../../core/commands/interfaces';
import type { Entity } from '../../types/entities';
import type { WallEntity } from '../types/wall-types';
import type { OpeningEntity, OpeningGeometry } from '../types/opening-types';
import { computeOpeningGeometry } from '../geometry/opening-geometry';
import { findHostedOpenings } from '../cascade/bim-cascade-resolver';

/**
 * Minimal scene-manager surface the cascade needs. `getEntities` is optional
 * (real adapters implement it; lightweight test mocks fall back to the wall's
 * `hostedOpeningIds` mirror).
 */
type CascadeSceneManager = Pick<ISceneManager, 'getEntity' | 'updateEntities'> & {
  getEntities?(): readonly SceneEntity[];
};

/** A single derived geometry patch for one hosted opening. */
export interface HostedOpeningGeometryPatch {
  readonly openingId: string;
  readonly geometry: OpeningGeometry;
}

/**
 * Resolve the ids of openings hosted on `wall`.
 *
 * Authoritative path: scan all entities by `opening.params.wallId === wall.id`
 * (the child→parent foreign key, always present) via the cascade-resolver SSoT.
 * Fallback (mocks without `getEntities`): the `wall.hostedOpeningIds` mirror.
 */
function resolveHostedOpeningIds(
  wall: WallEntity,
  sceneManager: CascadeSceneManager,
): string[] {
  const all = sceneManager.getEntities?.();
  if (all) {
    return findHostedOpenings(new Set([wall.id]), all as unknown as readonly Entity[]);
  }
  return [...(wall.hostedOpeningIds ?? [])];
}

/**
 * Recompute the world geometry of every opening hosted on `newWall`, keeping
 * each opening's params (offsetFromStart / kind / handing …) unchanged. Pure:
 * reads the scene, returns patches — does not mutate.
 *
 * `sceneUnits` is read from the host (`newWall.params.sceneUnits ?? 'mm'`) so
 * meter scenes stay aligned (ADR-397 #2 / ADR-398 unit-mismatch lesson) — the
 * same source `UpdateOpeningParamsCommand` already trusts.
 */
export function recomputeHostedOpeningGeometry(
  newWall: WallEntity,
  sceneManager: CascadeSceneManager,
): HostedOpeningGeometryPatch[] {
  const openingIds = resolveHostedOpeningIds(newWall, sceneManager);
  if (openingIds.length === 0) return [];

  const sceneUnits = newWall.params.sceneUnits ?? 'mm';
  const patches: HostedOpeningGeometryPatch[] = [];
  for (const openingId of openingIds) {
    const raw = sceneManager.getEntity(openingId);
    const candidate = raw as unknown as Partial<OpeningEntity> | undefined;
    if (!candidate || candidate.type !== 'opening' || !candidate.params) continue;
    // ADR-615 cascade guard — self-hosted openings (no wallId) have no host wall
    // to recompute against; this cascade only concerns wall-hosted geometry.
    if (!candidate.params.wallId) continue;
    const geometry = computeOpeningGeometry(candidate.params, newWall, sceneUnits);
    patches.push({ openingId, geometry });
  }
  return patches;
}

/**
 * For every wall id in `candidateIds`, recompute its hosted openings against the
 * wall's CURRENT (already-updated) state and apply the `{ geometry }` patches in
 * a single batch `updateEntities` commit. No-op for non-wall ids, walls without
 * hosted openings, or empty input.
 *
 * Callers invoke this AFTER the wall mutation has landed in the scene (so
 * `getEntity(wallId)` returns the new params/geometry).
 */
export function cascadeHostedOpeningsForWalls(
  candidateIds: readonly string[],
  sceneManager: CascadeSceneManager,
): void {
  if (candidateIds.length === 0) return;

  const patches = new Map<string, Partial<SceneEntity>>();
  for (const id of candidateIds) {
    const raw = sceneManager.getEntity(id);
    const candidate = raw as unknown as Partial<WallEntity> | undefined;
    if (!candidate || candidate.type !== 'wall' || !candidate.params || !candidate.geometry) {
      continue;
    }
    for (const { openingId, geometry } of recomputeHostedOpeningGeometry(
      candidate as WallEntity,
      sceneManager,
    )) {
      patches.set(openingId, { geometry } as unknown as Partial<SceneEntity>);
    }
  }

  if (patches.size > 0) sceneManager.updateEntities(patches);
}
