/**
 * Connected-Pipe Transform Cascade — transform-AGNOSTIC SSoT
 * (ADR-049 / ADR-408 Φ-C / ADR-507 §8, in-command, 2D + 3D, every transform).
 *
 * When an MEP connector host (manifold / fixture / boiler / radiator / water-heater)
 * or a pipe segment is TRANSFORMED (move / rotate / scale / mirror), every pipe end
 * snapped to its connectors must FOLLOW (Revit "connected ends move with the element").
 *
 * This is the generic engine behind BOTH:
 *   - the MOVE self-cascade (`cascadeConnectedPipesByDelta`, a thin delta wrapper), and
 *   - the in-place TRANSFORM spine (`SnapshotTransformCommand`, rotate/scale/mirror),
 * so the pipe-follow is identical across EVERY transform and EVERY gesture (2D + 3D) —
 * no divergence between move and rotate/scale/mirror (the old asymmetry: rotate followed
 * pipes only via the 3D `withConnectedPipeFollow` wrapper, never in 2D).
 *
 * The follow re-uses the pure, pose-based anchor-retarget resolver
 * (`resolveHostMoveConnectedPipePatches` / `resolveSegmentMoveConnectedPipePatches`):
 * it matches each pipe end on the host's OLD connector pose and retargets it to the NEW
 * one, so rotation / scale / mirror are covered for free (no per-transform math here).
 *
 * The caller supplies `computeNextParams(entity)` = "apply my transform to this entity
 * and return its NEW params" (the delta-move geometry for move, `computeUpdates` for the
 * transform spine). The retargeted pipes are applied directly in one batch and returned
 * for the single `bim:entities-moved` emit. `snapshots` carries each followed pipe's
 * PRE-transform state for snapshot-symmetric undo (the spine restores from it; the move
 * wrapper ignores it — move re-runs the cascade with the inverse delta).
 *
 * ⚠️ Timing: OLD→NEW anchor based — call BEFORE the host's own transform lands in the
 * scene (host + pipes must still be at their pre-transform poses when read).
 *
 * @see bim/mep-segments/mep-move-propagation.ts — the pure anchor-retarget SSoT (reused)
 * @see bim/mep-segments/cascade-connected-pipes-by-delta.ts — the MOVE (delta) wrapper
 * @see core/commands/entity-commands/SnapshotTransformCommand.ts — the transform-spine consumer
 * @see docs/centralized-systems/reference/adrs/ADR-049-unified-move-tool-dxf-overlays.md
 */

import type { ISceneManager, SceneEntity } from '../../core/commands/interfaces';
import type { Entity } from '../../types/entities';
import { isMepSegmentEntity } from '../../types/entities';
import type { MepSegmentEntity, MepSegmentParams } from '../types/mep-segment-types';
import { isMepConnectorHost } from '../mep-systems/connector-access';
import { computeMepSegmentGeometry } from '../geometry/mep-segment-geometry';
import { deepClone } from '../../utils/clone-utils';
import {
  resolveHostMoveConnectedPipePatches,
  resolveSegmentMoveConnectedPipePatches,
  type SegmentEndpointMovePatch,
} from './mep-move-propagation';

/**
 * Minimal scene-manager surface. `getEntities` is optional (real adapters provide it;
 * lightweight test mocks without it → no-op).
 */
export type ConnectedPipeCascadeSceneManager = Pick<ISceneManager, 'updateEntities'> & {
  getEntities?(): readonly SceneEntity[];
};

/**
 * Outcome of a connected-pipe cascade: the retargeted (post-transform) pipe entities
 * for the `bim:entities-moved` emit, and their PRE-transform snapshots for
 * snapshot-symmetric undo.
 */
export interface ConnectedPipeCascadeResult {
  readonly moved: SceneEntity[];
  readonly snapshots: SceneEntity[];
}

/** Extract `params` from a transform geometry patch (`{params, geometry}`), or null. */
export function nextParamsFromTransformPatch(patch: Partial<SceneEntity> | null): unknown | null {
  if (patch && typeof patch === 'object' && 'params' in patch) {
    return (patch as { params?: unknown }).params ?? null;
  }
  return null;
}

/** Pipe-follow patches for one transformed MEP entity, given its NEW params. */
function followPatchesFor(
  entity: Entity,
  entities: readonly Entity[],
  next: unknown,
): readonly SegmentEndpointMovePatch[] {
  if (!next) return [];
  if (isMepSegmentEntity(entity)) {
    return resolveSegmentMoveConnectedPipePatches(entities, entity, next as MepSegmentParams);
  }
  return resolveHostMoveConnectedPipePatches(entities, entity, { ...entity, params: next } as Entity);
}

/**
 * Retarget every pipe connected to a transformed MEP host / segment in `movedIds`, in a
 * single batch `updateEntities` commit. `computeNextParams(entity)` returns the entity's
 * NEW params under the caller's transform (move delta, rotate, scale, mirror…).
 *
 * Returns the post-transform pipe entities (for the emit) AND their pre-transform
 * snapshots (for snapshot-symmetric undo). No-op (`{moved:[], snapshots:[]}`) when none
 * of `movedIds` is an MEP host/segment, no pipes connect, or the scene manager does not
 * expose `getEntities`.
 *
 * Pipes already in `movedIds` (the user transformed them too) are skipped — they ride the
 * main batch; never double-transformed.
 *
 * MUST be called BEFORE the host's own transform lands in the scene (OLD→NEW anchors).
 */
export function cascadeConnectedPipes(
  movedIds: readonly string[],
  sceneManager: ConnectedPipeCascadeSceneManager,
  computeNextParams: (entity: Entity) => unknown | null,
): ConnectedPipeCascadeResult {
  if (movedIds.length === 0) return { moved: [], snapshots: [] };
  const all = sceneManager.getEntities?.();
  if (!all) return { moved: [], snapshots: [] };
  const entities = all as unknown as readonly Entity[];

  const movedSet = new Set(movedIds);
  const seen = new Set<string>();
  const patchMap = new Map<string, Partial<SceneEntity>>();
  const moved: SceneEntity[] = [];
  const snapshots: SceneEntity[] = [];

  for (const id of movedIds) {
    const entity = entities.find((e) => e.id === id);
    if (!entity) continue;
    if (!isMepSegmentEntity(entity) && !isMepConnectorHost(entity)) continue;
    for (const p of followPatchesFor(entity, entities, computeNextParams(entity))) {
      if (movedSet.has(p.segment.id) || seen.has(p.segment.id)) continue;
      seen.add(p.segment.id);
      const geometry = computeMepSegmentGeometry(p.nextParams);
      patchMap.set(p.segment.id, { params: p.nextParams, geometry } as unknown as Partial<SceneEntity>);
      moved.push({ ...(p.segment as MepSegmentEntity), params: p.nextParams, geometry } as unknown as SceneEntity);
      // Pre-transform snapshot for snapshot-symmetric undo (deepClone: the resolver hands
      // back the live scene segment, which the host's batch may later replace).
      snapshots.push(deepClone(p.segment as unknown as SceneEntity));
    }
  }

  if (patchMap.size > 0) sceneManager.updateEntities(patchMap);
  return { moved, snapshots };
}
