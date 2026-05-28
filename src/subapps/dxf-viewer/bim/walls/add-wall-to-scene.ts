/**
 * ADR-363 Phase 1G.4 — SSoT for inserting a freshly-built `WallEntity` into the
 * active level scene with neighbour trim recompute + creation broadcast.
 *
 * Extracted verbatim from `useSpecialTools.onWallCreated` so the wall DRAW tool
 * and the Ctrl-COPY hot-grip path (`grip-parametric-commits.commitWallCopy`)
 * share ONE insertion routine (N.0.2 — no copy-paste).
 *
 * The `drawing:entity-created` broadcast is REQUIRED, not optional: it is the
 * trigger `useWallPersistence` waits on to schedule the first Firestore save.
 * A bare scene mutation (without the event) leaves the wall local-only and a
 * Firestore snapshot in between drops it from the scene.
 *
 * @see hooks/tools/useSpecialTools.ts — DRAW caller
 * @see hooks/grips/grip-parametric-commits.ts — COPY caller (commitWallCopy)
 */
import { EventBus } from '../../systems/events/EventBus';
import type { SceneModel } from '../../types/scene';
import { isWallEntity } from '../../types/entities';
import type { WallEntity } from '../types/wall-types';
import { computeWallTrims, applyTrimPatches } from './wall-trims';

/**
 * Minimal level-scene accessor — structurally satisfied by both
 * `LevelsHookReturn` (draw tool) and `DxfCommitDeps` (grip commit), so neither
 * caller needs an adapter.
 */
export interface WallSceneAccessor {
  readonly currentLevelId: string | null;
  getLevelScene: (levelId: string) => SceneModel | null;
  setLevelScene: (levelId: string, scene: SceneModel) => void;
}

/**
 * Append `wallEntity` to the active level scene, recompute neighbour trims, and
 * broadcast `drawing:entity-created` (tool: 'wall') for the persistence layer.
 * No-op when there is no active level / scene.
 */
export function addWallToScene(wallEntity: WallEntity, accessor: WallSceneAccessor): void {
  const levelId = accessor.currentLevelId;
  if (!levelId) return;
  const scene = accessor.getLevelScene(levelId);
  if (!scene) return;
  // Include the new wall BEFORE computing trims so neighbours are also patched.
  const entitiesWithNew = [...(scene.entities || []), wallEntity];
  const allWalls = entitiesWithNew.filter(isWallEntity);
  const trims = computeWallTrims(allWalls);
  const patchedEntities = applyTrimPatches(entitiesWithNew, trims);
  accessor.setLevelScene(levelId, { ...scene, entities: patchedEntities });
  // Broadcast with the trim-patched entity so persistence saves correct params.
  const patchedNewWall =
    (patchedEntities.find((e) => e.id === wallEntity.id) as WallEntity | undefined) ?? wallEntity;
  EventBus.emit('drawing:entity-created', { entity: patchedNewWall, tool: 'wall' });
}
