/**
 * ADR-415 Φ1 — thin floorplan-symbol wrapper over the `appendEntityToScene` SSoT,
 * so the symbol DRAW tool tags every insertion with `tool: 'floorplan-symbol'`
 * (N.0.2 — no copy-paste of the append+broadcast persistence trigger). Mirror of
 * `add-furniture-to-scene.ts`.
 *
 * @see ../scene/append-entity-to-scene.ts — generic SSoT
 */
import { appendEntityToScene, type SceneAppendAccessor } from '../scene/append-entity-to-scene';
import type { FloorplanSymbolEntity } from '../types/floorplan-symbol-types';

/**
 * Append `symbolEntity` to the active level scene and broadcast
 * `drawing:entity-created` (tool: 'floorplan-symbol'). No-op when there is no
 * active level / scene.
 */
export function addFloorplanSymbolToScene(
  symbolEntity: FloorplanSymbolEntity,
  accessor: SceneAppendAccessor,
): void {
  appendEntityToScene(accessor, symbolEntity, 'floorplan-symbol');
}
