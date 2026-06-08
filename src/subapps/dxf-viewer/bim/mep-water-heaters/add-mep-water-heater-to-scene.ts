/**
 * ADR-408 DHW — thin mep-water-heater wrapper over the `appendEntityToScene`
 * SSoT, so the water heater DRAW tool tags every insertion with
 * `tool: 'mep-water-heater'` (N.0.2 — no copy-paste of the append+broadcast
 * persistence trigger). Mirror of `add-mep-boiler-to-scene.ts`.
 *
 * @see ../scene/append-entity-to-scene.ts — generic SSoT
 */
import { appendEntityToScene, type SceneAppendAccessor } from '../scene/append-entity-to-scene';
import type { MepWaterHeaterEntity } from '../types/mep-water-heater-types';

/**
 * Append `waterHeaterEntity` to the active level scene and broadcast
 * `drawing:entity-created` (tool: 'mep-water-heater'). No-op when there is no
 * active level / scene.
 */
export function addMepWaterHeaterToScene(
  waterHeaterEntity: MepWaterHeaterEntity,
  accessor: SceneAppendAccessor,
): void {
  appendEntityToScene(accessor, waterHeaterEntity, 'mep-water-heater');
}
