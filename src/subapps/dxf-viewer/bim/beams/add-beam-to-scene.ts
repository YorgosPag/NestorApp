/**
 * ADR-363 Phase 5.5d — thin beam wrapper over the `appendEntityToScene` SSoT, so
 * the beam DRAW tool (`useSpecialTools.onBeamCreated`) and the Ctrl-COPY hot-grip
 * path (`grip-parametric-copy.commitBeamCopy`) share ONE insertion routine
 * (N.0.2 — no copy-paste of the append+broadcast persistence trigger). A beam has
 * no neighbour trims (unlike a wall), so this is the simple append+broadcast form
 * — mirror of `add-mep-fixture-to-scene.ts` / `add-column-to-scene.ts`.
 *
 * @see ../scene/append-entity-to-scene.ts — generic SSoT
 */
import { appendEntityToScene, type SceneAppendAccessor } from '../scene/append-entity-to-scene';
import type { BeamEntity } from '../types/beam-types';

/**
 * Append `beamEntity` to the active level scene and broadcast
 * `drawing:entity-created` (tool: 'beam'). No-op when there is no active
 * level / scene.
 */
export function addBeamToScene(
  beamEntity: BeamEntity,
  accessor: SceneAppendAccessor,
): void {
  appendEntityToScene(accessor, beamEntity, 'beam');
}
