/**
 * ADR-408 Φ3 — thin electrical-panel wrapper over the `appendEntityToScene` SSoT,
 * so the panel DRAW tool (`useSpecialTools.onElectricalPanelCreated`) tags every
 * insertion with `tool: 'electrical-panel'` (N.0.2 — no copy-paste of the
 * append+broadcast persistence trigger). Mirror of `add-mep-fixture-to-scene.ts`.
 *
 * @see ../scene/append-entity-to-scene.ts — generic SSoT
 */
import { appendEntityToScene, type SceneAppendAccessor } from '../scene/append-entity-to-scene';
import type { ElectricalPanelEntity } from '../types/electrical-panel-types';

/**
 * Append `panelEntity` to the active level scene and broadcast
 * `drawing:entity-created` (tool: 'electrical-panel'). No-op when there is no
 * active level / scene.
 */
export function addElectricalPanelToScene(
  panelEntity: ElectricalPanelEntity,
  accessor: SceneAppendAccessor,
): void {
  appendEntityToScene(accessor, panelEntity, 'electrical-panel');
}
