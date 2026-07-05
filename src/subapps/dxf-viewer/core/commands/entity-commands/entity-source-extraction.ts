/**
 * SSoT — Entity source extraction / restoration for CONTAINER commands.
 *
 * The "hidden-source" lifecycle shared by every command that swaps N scene
 * entities for ONE composite container and back:
 *   - extract: deep-clone the sources (→ snapshot stored on the container) and
 *     remove the originals from the live scene.
 *   - restore: re-insert the snapshots (undo).
 *
 * ISceneManager keeps this decoupled from store internals. Promoted here (neutral
 * `core/commands/entity-commands`) from `systems/array/array-source-extraction.ts`
 * (ADR-353) so ARRAY (ADR-353) AND GROUP (ADR-575) — and any future container
 * command — share ONE implementation instead of each re-inlining it (N.12 SSoT).
 * The old array path now re-exports these.
 */

import type { Entity } from '../../../types/entities';
import type { ISceneManager } from '../interfaces';
import { deepClone } from '../../../utils/clone-utils';

/**
 * Deep-clone the given entities and remove the originals from the scene.
 * @returns Deep-cloned snapshots (to be stored on the container for undo).
 */
export function extractSourcesFromScene(
  entities: Entity[],
  sceneManager: ISceneManager,
): Entity[] {
  const clones = entities.map((e) => deepClone(e));
  for (const entity of entities) {
    sceneManager.removeEntity(entity.id);
  }
  return clones;
}

/**
 * Re-insert previously extracted sources back into the scene (undo path).
 */
export function restoreSourcesToScene(
  sources: Entity[],
  sceneManager: ISceneManager,
): void {
  for (const entity of sources) {
    sceneManager.addEntity(entity as unknown as Parameters<ISceneManager['addEntity']>[0]);
  }
}
