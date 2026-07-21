/**
 * ADR-684 Φ3 — thin generic-solid wrapper over the `appendEntityToScene` SSoT, so
 * the generic-solid DRAW tool (`useSpecialTools.onGenericSolidCreated`) tags every
 * insertion with `tool: 'generic-solid'` (N.0.2 — no copy-paste of the
 * append+broadcast persistence trigger). Mirror of `add-furniture-to-scene.ts`.
 *
 * @see ../../scene/append-entity-to-scene.ts — generic SSoT
 */
import { appendEntityToScene, type SceneAppendAccessor } from '../../scene/append-entity-to-scene';
import type { GenericSolidEntity } from './generic-solid-types';

/**
 * Append `genericSolidEntity` to the active level scene and broadcast
 * `drawing:entity-created` (tool: 'generic-solid'). No-op when there is no active
 * level / scene.
 */
export function addGenericSolidToScene(
  genericSolidEntity: GenericSolidEntity,
  accessor: SceneAppendAccessor,
): void {
  appendEntityToScene(accessor, genericSolidEntity, 'generic-solid');
}
