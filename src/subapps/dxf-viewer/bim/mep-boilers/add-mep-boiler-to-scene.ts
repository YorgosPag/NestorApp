/**
 * ADR-408 Εύρος Β #2 — thin mep-boiler wrapper over the `appendEntityToScene`
 * SSoT, so the boiler DRAW tool tags every insertion with `tool: 'mep-boiler'`
 * (N.0.2 — no copy-paste of the append+broadcast persistence trigger). Mirror of
 * `add-mep-radiator-to-scene.ts`.
 *
 * @see ../scene/append-entity-to-scene.ts — generic SSoT
 */
import { appendEntityToScene, type SceneAppendAccessor } from '../scene/append-entity-to-scene';
import type { MepBoilerEntity } from '../types/mep-boiler-types';

/**
 * Append `boilerEntity` to the active level scene and broadcast
 * `drawing:entity-created` (tool: 'mep-boiler'). No-op when there is no active
 * level / scene.
 */
export function addMepBoilerToScene(
  boilerEntity: MepBoilerEntity,
  accessor: SceneAppendAccessor,
): void {
  appendEntityToScene(accessor, boilerEntity, 'mep-boiler');
}
