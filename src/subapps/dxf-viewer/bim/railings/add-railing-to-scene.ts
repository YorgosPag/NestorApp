/**
 * ADR-407 — thin railing wrapper over the `appendEntityToScene` SSoT, so the
 * railing DRAW tool (`useSpecialTools.onRailingCreated`) tags every insertion
 * with `tool: 'railing'` (N.0.2 — no copy-paste of the append+broadcast
 * persistence trigger). Mirror of `add-mep-fixture-to-scene.ts`.
 *
 * @see ../scene/append-entity-to-scene.ts — generic SSoT
 */
import { appendEntityToScene, type SceneAppendAccessor } from '../scene/append-entity-to-scene';
import type { RailingEntity } from '../types/railing-types';

/**
 * Append `railingEntity` to the active level scene and broadcast
 * `drawing:entity-created` (tool: 'railing'). No-op when there is no active
 * level / scene.
 */
export function addRailingToScene(
  railingEntity: RailingEntity,
  accessor: SceneAppendAccessor,
): void {
  appendEntityToScene(accessor, railingEntity, 'railing');
}
