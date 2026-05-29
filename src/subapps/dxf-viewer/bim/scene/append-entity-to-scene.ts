/**
 * ADR-397 — SSoT for the "append a freshly-built BIM entity to the active level
 * scene + broadcast `drawing:entity-created`" pattern.
 *
 * Before this module the append-then-emit body was copy-pasted in
 * `useSpecialTools.appendAndBroadcast` (slab / beam / column-draw) and in
 * `add-column-to-scene` / `add-wall-to-scene`. This is the single
 * implementation; the per-entity helpers now delegate here (N.0.2 — no
 * duplicate of the persistence trigger).
 *
 * The `drawing:entity-created` broadcast is REQUIRED, not optional: it is the
 * trigger the `use*Persistence` hooks wait on to schedule the first Firestore
 * save. A bare scene mutation (without the event) leaves the entity local-only.
 *
 * Walls do NOT use this directly because they recompute neighbour trims over the
 * whole entity list before persisting (`add-wall-to-scene`), which replaces the
 * single-append semantics — that is a deliberate, documented exception.
 *
 * @see bim/columns/add-column-to-scene.ts — column wrapper (draw + Ctrl-copy)
 * @see hooks/tools/useSpecialTools.ts — slab / beam draw callers
 */
import { EventBus } from '../../systems/events/EventBus';
import type { SceneModel } from '../../types/scene';
import type { Entity } from '../../types/entities';

/**
 * Minimal level-scene accessor — structurally satisfied by both
 * `LevelsHookReturn` (draw tools) and `DxfCommitDeps` (grip commits).
 */
export interface SceneAppendAccessor {
  readonly currentLevelId: string | null;
  getLevelScene: (levelId: string) => SceneModel | null;
  setLevelScene: (levelId: string, scene: SceneModel) => void;
}

/**
 * Append `entity` to the active level scene and broadcast
 * `drawing:entity-created` with the given `tool`. No-op when there is no active
 * level / scene.
 */
export function appendEntityToScene<E extends { id: string }>(
  accessor: SceneAppendAccessor,
  entity: E,
  tool: string,
): void {
  const levelId = accessor.currentLevelId;
  if (!levelId) return;
  const scene = accessor.getLevelScene(levelId);
  if (!scene) return;
  accessor.setLevelScene(levelId, {
    ...scene,
    entities: [...(scene.entities || []), entity as unknown as Entity],
  });
  EventBus.emit('drawing:entity-created', { entity: entity as unknown as Entity, tool });
}
