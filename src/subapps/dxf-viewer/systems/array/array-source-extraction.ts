/**
 * ADR-353 SSOT — Source entity extraction and restoration.
 *
 * On array creation: entities are deep-cloned into ArrayEntity.hiddenSources
 * and removed from the scene (Q13 — hidden-source pattern).
 *
 * On undo: entities are restored to the scene, removing the ArrayEntity.
 *
 * ISceneManager is used to keep this module decoupled from store internals.
 */

import type { Entity } from '../../types/entities';
import type { ISceneManager } from '../../core/commands/interfaces';
import { deepClone } from '../../../../lib/clone-utils';

/**
 * Deep-clone the given entities and remove the originals from the scene.
 *
 * @returns Deep-cloned entity snapshots (to be stored in ArrayEntity.hiddenSources)
 */
export function extractSourcesFromScene(
  entities: Entity[],
  sceneManager: ISceneManager,
): Entity[] {
  const clones = entities.map(e => deepClone(e));
  for (const entity of entities) {
    sceneManager.removeEntity(entity.id);
  }
  return clones;
}

/**
 * Re-insert previously extracted entities back into the scene.
 * Used by undo operations (CreateArrayCommand.undo).
 */
export function restoreSourcesToScene(
  hiddenSources: Entity[],
  sceneManager: ISceneManager,
): void {
  for (const entity of hiddenSources) {
    sceneManager.addEntity(entity as Parameters<ISceneManager['addEntity']>[0]);
  }
}
