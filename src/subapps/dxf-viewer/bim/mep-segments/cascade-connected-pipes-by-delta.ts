/**
 * Connected-Pipe MOVE Cascade — the delta wrapper over the transform-agnostic engine
 * (ADR-049 / ADR-408 Φ-C, in-command, 2D + 3D).
 *
 * When an MEP connector host (manifold / fixture / boiler / radiator / water-heater)
 * or a pipe segment MOVES, every pipe end snapped to its connectors must FOLLOW
 * (Revit "connected ends move with the element"). This logic previously lived ONLY
 * in the 3D gizmo path (`withConnectedPipeFollow`, which wrapped the move in a
 * `CompoundCommand` of `UpdateMepSegmentParamsCommand`s) — so a 2D drag/nudge/move-
 * tool of an MEP host left its pipes behind.
 *
 * The follow now lives INSIDE the Move commands as a recompute step (mirror of
 * `cascadeHostedOpeningsForWalls` / `cascadeMovedSlabOpenings`): the moved pipes are
 * applied directly and returned for the single `bim:entities-moved` emit (persisted by
 * `useMepSegmentPersistence`'s `useBimEntityMovedPersistEffect`). So EVERY gesture
 * follows pipes for free.
 *
 * This module is the MOVE specialisation of the generic engine in
 * `cascade-connected-pipes.ts`: it derives each entity's next params from the 3D move
 * `delta` (`calculateBimMovedGeometry`) and returns only the moved pipes (move undo
 * re-runs with the reverse delta, so it needs no snapshots). Rotate/scale/mirror reuse
 * the SAME engine from the transform spine — zero divergence.
 *
 * ⚠️ Timing: the follow is OLD→NEW anchor based, so the caller MUST invoke this BEFORE
 * applying the host's own move to the scene. `delta` is the signed move (reverse on undo).
 *
 * @see bim/mep-segments/cascade-connected-pipes.ts — the transform-agnostic engine (SSoT)
 * @see bim/mep-segments/mep-move-propagation.ts — the pure anchor-retarget SSoT
 * @see bim/walls/wall-opening-coordinator.ts — the wall-opening twin
 * @see docs/centralized-systems/reference/adrs/ADR-049-unified-move-tool-dxf-overlays.md
 */

import type { SceneEntity } from '../../core/commands/interfaces';
// ADR-049 Phase 2 — the follow uses the FULL 3D move delta (optional `z` = elevation
// in mm) so a vertical host/pipe move drags its connected pipe ends up/down too.
import type { Point3D } from '../types/bim-base';
import type { Entity } from '../../types/entities';
import { calculateBimMovedGeometry } from '../utils/bim-move-geometry';
import {
  cascadeConnectedPipes,
  nextParamsFromTransformPatch,
  type ConnectedPipeCascadeSceneManager,
} from './cascade-connected-pipes';

/** Next params of the move geometry patch for `entity` under `delta`, or null. */
function movedParams(entity: Entity, delta: Point3D): unknown | null {
  return nextParamsFromTransformPatch(calculateBimMovedGeometry(entity, delta));
}

/**
 * Retarget every pipe connected to a moved MEP host / segment in `movedIds` by `delta`.
 * Thin wrapper over {@link cascadeConnectedPipes}: the move derives next params from the
 * delta and the moved pipes ride the `bim:entities-moved` emit. See the engine for the
 * full contract (dedup, move-set exclusion, OLD→NEW timing requirement).
 */
export function cascadeConnectedPipesByDelta(
  movedIds: readonly string[],
  delta: Point3D,
  sceneManager: ConnectedPipeCascadeSceneManager,
): SceneEntity[] {
  return cascadeConnectedPipes(movedIds, sceneManager, (entity) => movedParams(entity, delta)).moved;
}
