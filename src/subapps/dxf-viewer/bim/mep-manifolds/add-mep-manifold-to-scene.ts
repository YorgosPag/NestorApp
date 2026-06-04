/**
 * ADR-408 Φ12 — thin mep-manifold wrapper over the `appendEntityToScene` SSoT,
 * so the manifold DRAW tool tags every insertion with `tool: 'mep-manifold'`
 * (N.0.2 — no copy-paste of the append+broadcast persistence trigger). Mirror of
 * `add-electrical-panel-to-scene.ts`.
 *
 * @see ../scene/append-entity-to-scene.ts — generic SSoT
 */
import { appendEntityToScene, type SceneAppendAccessor } from '../scene/append-entity-to-scene';
import type { MepManifoldEntity } from '../types/mep-manifold-types';

/**
 * Append `manifoldEntity` to the active level scene and broadcast
 * `drawing:entity-created` (tool: 'mep-manifold'). No-op when there is no
 * active level / scene.
 */
export function addMepManifoldToScene(
  manifoldEntity: MepManifoldEntity,
  accessor: SceneAppendAccessor,
): void {
  appendEntityToScene(accessor, manifoldEntity, 'mep-manifold');
}
