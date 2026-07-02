/**
 * ADR-563 (Auto-Dimension) — thin wrapper over the `appendEntitiesToScene` SSoT
 * so the auto-dimension command inserts its N generated `DimensionEntity`s as a
 * SINGLE undoable batch (`CompoundCommand`), tagged `tool: 'dim-auto'` (N.0.2 —
 * no copy-paste of the append+broadcast persistence trigger).
 *
 * Mirrors `bim/columns/add-column-to-scene.ts`. Reusing `appendEntitiesToScene`
 * gives, for free: 1 Ctrl+Z removes the whole set, each dim broadcasts
 * `drawing:entity-created` (persistence), and the already-mounted
 * `useDimAssociationObserver` picks up the batch to track host→dim associations.
 *
 * @see bim/scene/append-entity-to-scene.ts — generic batch SSoT (ADR-397/511)
 */

import {
  appendEntitiesToScene,
  type SceneAppendAccessor,
} from './append-entity-to-scene';
import type { DimensionEntity } from '../../types/dimension';

/**
 * Append MANY auto-generated dimensions to the active level scene as one
 * undoable batch. No-op when there is no active level / scene / dimensions.
 */
export function addDimensionsToScene(
  dimensions: readonly DimensionEntity[],
  accessor: SceneAppendAccessor,
): void {
  appendEntitiesToScene(accessor, dimensions, 'dim-auto', 'Αυτόματη διαστασιολόγηση');
}
