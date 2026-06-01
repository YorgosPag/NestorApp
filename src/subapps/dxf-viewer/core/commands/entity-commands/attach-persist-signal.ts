/**
 * ATTACH PERSIST SIGNAL — ADR-401 SSoT.
 *
 * After an Attach/Detach command mutates the structural-attach binding of N
 * entities, it MUST broadcast the post-change entities so the shared
 * persistence layer writes them to Firestore + marks them dirty:
 *   - wall / column → `useBimEntityMovedPersistEffect` (listens `bim:entities-attached`)
 *   - stair         → dedicated listener in `use-stair-persistence`
 *
 * WHY this exists: the persistence hooks only auto-save the *primary-selected*
 * entity (debounce) or freshly *drawn* / *moved* ones. Auto-attach targets
 * NON-selected entities (the walls/columns/stairs sitting under a just-created
 * beam/slab), so without an explicit signal their binding change lives only in
 * the in-memory scene — never persisted, and reverted by the next Firestore
 * snapshot's diff-merge (existing ≠ doc, not dirty → overwrite). Marking them
 * dirty in the listener also protects the in-memory change until the round-trip
 * completes.
 *
 * MUST be called on execute, undo AND redo — every binding transition has to
 * persist, including the detach that an undo restores (otherwise undo reverts
 * in-memory only and the snapshot re-applies the stale attached doc).
 *
 * Entities are read back from the scene manager AFTER the patch is applied, so
 * they carry the post-change params (mirror of the `bim:entities-moved`
 * payload-based contract — listeners never call `getLevelScene()`).
 *
 * @see hooks/data/useBimEntityMovedPersistEffect.ts — wall/column consumer
 * @see bim/hooks/use-stair-persistence.ts — stair consumer
 * @see docs/centralized-systems/reference/adrs/ADR-401-bim-wall-top-base-constraints-attach-to-structural.md §6 (persistence)
 */

import { EventBus } from '../../../systems/events/EventBus';
import type { ISceneManager } from '../interfaces';
import type { AnySceneEntity } from '../../../types/scene';

/**
 * Emit `bim:entities-attached` with the post-change entities for the given ids.
 * No-op when `ids` is empty or none resolve (e.g. a no-op command). Reads each
 * entity from `sceneManager` so the payload reflects the freshly-applied params.
 */
export function signalEntitiesAttached(
  sceneManager: ISceneManager,
  ids: readonly string[],
): void {
  if (ids.length === 0) return;
  const entities: AnySceneEntity[] = [];
  for (const id of ids) {
    const entity = sceneManager.getEntity(id) as unknown as AnySceneEntity | undefined;
    if (entity) entities.push(entity);
  }
  if (entities.length > 0) EventBus.emit('bim:entities-attached', { entities });
}
