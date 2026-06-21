/**
 * Connected-Pipe Move Cascade — ADR-049 / ADR-408 Φ-C (in-command, 2D + 3D).
 *
 * When an MEP connector host (manifold / fixture / boiler / radiator / water-heater)
 * or a pipe segment MOVES, every pipe end snapped to its connectors must FOLLOW
 * (Revit "connected ends move with the element"). This logic previously lived ONLY
 * in the 3D gizmo path (`withConnectedPipeFollow`, which wrapped the move in a
 * `CompoundCommand` of `UpdateMepSegmentParamsCommand`s) — so a 2D drag/nudge/move-
 * tool of an MEP host left its pipes behind.
 *
 * This module moves the follow INSIDE the Move commands as a recompute step
 * (mirror of `cascadeHostedOpeningsForWalls` / `cascadeMovedSlabOpenings`): no
 * sub-commands, the retargeted pipes are applied directly and returned for the
 * single `bim:entities-moved` emit (persisted by `useMepSegmentPersistence`'s
 * `useBimEntityMovedPersistEffect`). So EVERY gesture follows pipes for free.
 *
 * ⚠️ Timing: the follow is OLD→NEW anchor based, so the caller MUST invoke this
 * BEFORE applying the host's own move to the scene (the pipes + host must still be
 * at their pre-move poses when read). `delta` is the signed move (reverse on undo).
 *
 * @see bim/mep-segments/mep-move-propagation.ts — the pure anchor-retarget SSoT
 * @see bim/walls/wall-opening-coordinator.ts — the wall-opening twin
 * @see docs/centralized-systems/reference/adrs/ADR-049-unified-move-tool-dxf-overlays.md
 */

import type { ISceneManager, SceneEntity } from '../../core/commands/interfaces';
// ADR-049 Phase 2 — the follow uses the FULL 3D move delta (optional `z` = elevation
// in mm) so a vertical host/pipe move drags its connected pipe ends up/down too.
import type { Point3D } from '../types/bim-base';
import type { Entity } from '../../types/entities';
import { isMepSegmentEntity } from '../../types/entities';
import type { MepSegmentEntity, MepSegmentParams } from '../types/mep-segment-types';
import { isMepConnectorHost } from '../mep-systems/connector-access';
import { calculateBimMovedGeometry } from '../utils/bim-move-geometry';
import { computeMepSegmentGeometry } from '../geometry/mep-segment-geometry';
import {
  resolveHostMoveConnectedPipePatches,
  resolveSegmentMoveConnectedPipePatches,
  type SegmentEndpointMovePatch,
} from './mep-move-propagation';

/**
 * Minimal scene-manager surface. `getEntities` is optional (real adapters provide
 * it; lightweight test mocks without it → no-op).
 */
type CascadeSceneManager = Pick<ISceneManager, 'updateEntities'> & {
  getEntities?(): readonly SceneEntity[];
};

/** Params of the move geometry patch (the moved entity's `nextParams`), or null. */
function movedParams(entity: Entity, delta: Point3D): unknown | null {
  const patch = calculateBimMovedGeometry(entity, delta);
  if (patch && typeof patch === 'object' && 'params' in patch) {
    return (patch as { params?: unknown }).params ?? null;
  }
  return null;
}

/** Pipe-follow patches for one moved MEP entity (host drags connector pipes; a pipe drags coincident neighbours). */
function followPatchesFor(
  entity: Entity,
  entities: readonly Entity[],
  delta: Point3D,
): readonly SegmentEndpointMovePatch[] {
  const next = movedParams(entity, delta);
  if (!next) return [];
  if (isMepSegmentEntity(entity)) {
    return resolveSegmentMoveConnectedPipePatches(entities, entity, next as MepSegmentParams);
  }
  return resolveHostMoveConnectedPipePatches(entities, entity, { ...entity, params: next } as Entity);
}

/**
 * Retarget every pipe connected to a moved MEP host / segment in `movedIds`, in a
 * single batch `updateEntities` commit. Returns the moved pipe entities so the
 * caller includes them in the `bim:entities-moved` emit. No-op (`[]`) when none of
 * `movedIds` is an MEP host/segment, no pipes connect, or the scene manager does
 * not expose `getEntities`.
 *
 * Pipes already in `movedIds` (the user moved them too) are skipped — they ride
 * the main batch; never double-moved.
 *
 * MUST be called BEFORE the host's own move lands in the scene (OLD→NEW anchors).
 */
export function cascadeConnectedPipesByDelta(
  movedIds: readonly string[],
  delta: Point3D,
  sceneManager: CascadeSceneManager,
): SceneEntity[] {
  if (movedIds.length === 0) return [];
  const all = sceneManager.getEntities?.();
  if (!all) return [];
  const entities = all as unknown as readonly Entity[];

  const movedSet = new Set(movedIds);
  const seen = new Set<string>();
  const patchMap = new Map<string, Partial<SceneEntity>>();
  const moved: SceneEntity[] = [];

  for (const id of movedIds) {
    const entity = entities.find((e) => e.id === id);
    if (!entity) continue;
    if (!isMepSegmentEntity(entity) && !isMepConnectorHost(entity)) continue;
    for (const p of followPatchesFor(entity, entities, delta)) {
      if (movedSet.has(p.segment.id) || seen.has(p.segment.id)) continue;
      seen.add(p.segment.id);
      const geometry = computeMepSegmentGeometry(p.nextParams);
      patchMap.set(p.segment.id, { params: p.nextParams, geometry } as unknown as Partial<SceneEntity>);
      moved.push({ ...(p.segment as MepSegmentEntity), params: p.nextParams, geometry } as unknown as SceneEntity);
    }
  }

  if (patchMap.size > 0) sceneManager.updateEntities(patchMap);
  return moved;
}
