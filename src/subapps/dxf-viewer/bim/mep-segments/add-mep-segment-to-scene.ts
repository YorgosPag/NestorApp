/**
 * ADR-408 Φ8 — thin MEP-segment wrapper over the `appendEntityToScene` SSoT,
 * so the segment DRAW tool (`useSpecialTools.onMepSegmentCreated`) tags every
 * insertion with `tool: 'mep-segment'` (N.0.2 — no copy-paste of the
 * append+broadcast persistence trigger). Mirror of `add-electrical-panel-to-scene.ts`.
 *
 * @see ../scene/append-entity-to-scene.ts — generic SSoT
 */
import { appendEntityToScene, type SceneAppendAccessor } from '../scene/append-entity-to-scene';
import type { MepSegmentEntity } from '../types/mep-segment-types';

/**
 * Append `segmentEntity` to the active level scene and broadcast
 * `drawing:entity-created` (tool: 'mep-segment'). No-op when there is no
 * active level / scene.
 */
export function addMepSegmentToScene(
  segmentEntity: MepSegmentEntity,
  accessor: SceneAppendAccessor,
): void {
  appendEntityToScene(accessor, segmentEntity, 'mep-segment');
}
