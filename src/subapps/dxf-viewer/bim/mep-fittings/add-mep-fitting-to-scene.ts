/**
 * ADR-408 Φ11 — thin MEP-fitting wrapper over the `appendEntityToScene` SSoT,
 * so the auto-fitting resolver tags every insertion with `tool: 'mep-fitting'`
 * (N.0.2 — no copy-paste of the append+broadcast persistence trigger). Mirror
 * of `add-mep-segment-to-scene.ts`.
 *
 * @see ../scene/append-entity-to-scene.ts — generic SSoT
 */
import { appendEntityToScene, type SceneAppendAccessor } from '../scene/append-entity-to-scene';
import type { MepFittingEntity } from '../types/mep-fitting-types';

/**
 * Append `fittingEntity` to the active level scene and broadcast
 * `drawing:entity-created` (tool: 'mep-fitting'). No-op when there is no
 * active level / scene.
 */
export function addMepFittingToScene(
  fittingEntity: MepFittingEntity,
  accessor: SceneAppendAccessor,
): void {
  appendEntityToScene(accessor, fittingEntity, 'mep-fitting');
}
