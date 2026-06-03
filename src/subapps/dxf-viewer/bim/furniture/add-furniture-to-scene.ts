/**
 * ADR-410 — thin furniture wrapper over the `appendEntityToScene` SSoT, so the
 * furniture DRAW tool (`useSpecialTools.onFurnitureCreated`) tags every insertion
 * with `tool: 'furniture'` (N.0.2 — no copy-paste of the append+broadcast
 * persistence trigger). Mirror of `add-mep-fixture-to-scene.ts`.
 *
 * @see ../scene/append-entity-to-scene.ts — generic SSoT
 */
import { appendEntityToScene, type SceneAppendAccessor } from '../scene/append-entity-to-scene';
import type { FurnitureEntity } from '../types/furniture-types';

/**
 * Append `furnitureEntity` to the active level scene and broadcast
 * `drawing:entity-created` (tool: 'furniture'). No-op when there is no active
 * level / scene.
 */
export function addFurnitureToScene(
  furnitureEntity: FurnitureEntity,
  accessor: SceneAppendAccessor,
): void {
  appendEntityToScene(accessor, furnitureEntity, 'furniture');
}
