/**
 * ADR-436 Slice 1 — thin foundation wrapper over the `appendEntityToScene` SSoT,
 * so the foundation DRAW tool (`useFoundationTool.onFoundationCreated`) and any
 * future COPY path share ONE insertion routine με το `tool: 'foundation'` tag
 * baked in (N.0.2 — no copy-paste του append+broadcast persistence trigger).
 *
 * @see bim/scene/append-entity-to-scene.ts — generic SSoT
 */
import { appendEntityToScene, type SceneAppendAccessor } from '../scene/append-entity-to-scene';
import type { FoundationEntity } from '../types/foundation-types';

/**
 * Append `foundationEntity` to the active level scene and broadcast
 * `drawing:entity-created` (tool: 'foundation'). No-op when there is no active
 * level / scene.
 */
export function addFoundationToScene(
  foundationEntity: FoundationEntity,
  accessor: SceneAppendAccessor,
): void {
  appendEntityToScene(accessor, foundationEntity, 'foundation');
}
