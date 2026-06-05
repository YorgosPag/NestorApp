/**
 * ADR-408 Εύρος Β #1 — thin mep-radiator wrapper over the `appendEntityToScene`
 * SSoT, so the radiator DRAW tool tags every insertion with `tool: 'mep-radiator'`
 * (N.0.2 — no copy-paste of the append+broadcast persistence trigger). Mirror of
 * `add-mep-manifold-to-scene.ts`.
 *
 * @see ../scene/append-entity-to-scene.ts — generic SSoT
 */
import { appendEntityToScene, type SceneAppendAccessor } from '../scene/append-entity-to-scene';
import type { MepRadiatorEntity } from '../types/mep-radiator-types';

/**
 * Append `radiatorEntity` to the active level scene and broadcast
 * `drawing:entity-created` (tool: 'mep-radiator'). No-op when there is no active
 * level / scene.
 */
export function addMepRadiatorToScene(
  radiatorEntity: MepRadiatorEntity,
  accessor: SceneAppendAccessor,
): void {
  appendEntityToScene(accessor, radiatorEntity, 'mep-radiator');
}
