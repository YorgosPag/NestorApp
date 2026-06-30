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
import type { WallEntity, WallParams } from '../types/wall-types';
import { computeWallTrims, applyTrimPatches } from './wall-trims';
import { computeWallGeometry } from '../geometry/wall-geometry';

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

  // Persist miter/bevel patches for EXISTING neighbour walls updated by
  // computeWallTrims. Only the new wall gets `drawing:entity-created` above;
  // existing walls' `useWallPersistence` auto-save only fires for the selected
  // wall, so their updated miter params would be lost on the next Firestore
  // snapshot. Re-emit for each patched neighbour — `persist` inside the hook
  // routes to `updateWall` (not `saveWall`) because their IDs are already in
  // `lastSavedParamsRef`.
  for (const entity of patchedEntities) {
    if (entity.id === wallEntity.id) continue;          // new wall already handled
    if (!isWallEntity(entity)) continue;
    if (!trims.has(entity.id)) continue;               // no patch → nothing changed
    EventBus.emit('drawing:entity-created', { entity, tool: 'wall' });
  }
}

/**
 * SSoT idempotent wall-junction recompute (ADR-363 Phase 1E / 1L-J). Strips ALL
 * existing trim data (`startMiter`/`endMiter`/`startBevel`/`endBevel`) from every
 * wall, recomputes from current geometry + explicit join overrides, applies the
 * fresh patches, and emits `drawing:entity-created` for each wall whose params
 * changed so `useWallPersistence` saves the corrected state to Firestore.
 *
 * The strip-first design makes the result a pure function of current geometry +
 * overrides — so a wall that NO LONGER mitres (deleted neighbour, or a join
 * override switched to `butt`/`disallow`) has its stale miter cleared instead of
 * frozen (the `applyTrimPatches`-only overlay never clears, it only adds).
 *
 * Shared by:
 *   - `recomputeWallTrimsAfterDelete` (after a wall is removed)
 *   - `useWallRetrimEffect` (after a grip commit or a join-override change)
 */
export function recomputeWallTrims(accessor: WallSceneAccessor): void {
  const levelId = accessor.currentLevelId;
  if (!levelId) return;
  const scene = accessor.getLevelScene(levelId);
  if (!scene) return;

  // Snapshot of trim-field values BEFORE recompute so we can detect changes.
  const prevTrimById = new Map<string, Pick<WallParams, 'startMiter' | 'endMiter' | 'startBevel' | 'endBevel'>>();
  for (const e of scene.entities) {
    if (!isWallEntity(e)) continue;
    prevTrimById.set(e.id, {
      startMiter: e.params.startMiter,
      endMiter:   e.params.endMiter,
      startBevel: e.params.startBevel,
      endBevel:   e.params.endBevel,
    });
  }

  // Strip all existing trim data from every remaining wall before fresh recompute.
  // This clears miter patches that referred to the now-deleted wall's endpoints.
  const strippedEntities = scene.entities.map((e) => {
    if (!isWallEntity(e)) return e;
    const prev = prevTrimById.get(e.id);
    if (!prev?.startMiter && !prev?.endMiter && !prev?.startBevel && !prev?.endBevel) return e;
    // Destructure out the four trim fields; rest is a valid subset of WallParams.
    const { startMiter: _sm, endMiter: _em, startBevel: _sb, endBevel: _eb, ...rest } = e.params;
    const cleanParams = rest as WallParams;
    return {
      ...e,
      params: cleanParams,
      geometry: computeWallGeometry(cleanParams, e.kind),
    } as WallEntity;
  });

  const remainingWalls = strippedEntities.filter(isWallEntity);
  const newTrims = computeWallTrims(remainingWalls);
  const patchedEntities = applyTrimPatches(strippedEntities, newTrims);
  accessor.setLevelScene(levelId, { ...scene, entities: patchedEntities });

  // Emit for every wall whose trim params changed (gained, lost, or different).
  for (const entity of patchedEntities) {
    if (!isWallEntity(entity)) continue;
    const prev = prevTrimById.get(entity.id);
    if (!prev) continue;
    const n = entity.params;
    const changed =
      JSON.stringify(prev.startMiter) !== JSON.stringify(n.startMiter) ||
      JSON.stringify(prev.endMiter)   !== JSON.stringify(n.endMiter)   ||
      prev.startBevel !== n.startBevel ||
      prev.endBevel   !== n.endBevel;
    if (changed) {
      EventBus.emit('drawing:entity-created', { entity, tool: 'wall' });
    }
  }
}

/**
 * Recompute wall trims after one wall is deleted. Thin alias over the SSoT
 * {@link recomputeWallTrims} — kept as a named entry point for the delete caller.
 * Must be called AFTER the deleted wall has been removed from the scene.
 *
 * @see hooks/data/useWallPersistence.ts — deleteWall caller
 */
export function recomputeWallTrimsAfterDelete(accessor: WallSceneAccessor): void {
  recomputeWallTrims(accessor);
}
