/**
 * ADR-406 — thin MEP fixture wrapper over the `appendEntityToScene` SSoT, so the
 * fixture DRAW tool (`useSpecialTools.onMepFixtureCreated`) tags every insertion
 * with `tool: 'mep-fixture'` (N.0.2 — no copy-paste of the append+broadcast
 * persistence trigger). Mirror of `add-column-to-scene.ts`.
 *
 * @see ../scene/append-entity-to-scene.ts — generic SSoT
 */
import { appendEntityToScene, type SceneAppendAccessor } from '../scene/append-entity-to-scene';
import type { MepFixtureEntity } from '../types/mep-fixture-types';

/**
 * Append `fixtureEntity` to the active level scene and broadcast
 * `drawing:entity-created` (tool: 'mep-fixture'). No-op when there is no active
 * level / scene.
 */
export function addMepFixtureToScene(
  fixtureEntity: MepFixtureEntity,
  accessor: SceneAppendAccessor,
): void {
  appendEntityToScene(accessor, fixtureEntity, 'mep-fixture');
}
