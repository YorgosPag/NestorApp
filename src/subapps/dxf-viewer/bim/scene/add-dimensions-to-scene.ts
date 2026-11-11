/**
 * ADR-563 (Auto-Dimension) · ADR-929 Δ20 Σ1.3 — thin wrapper over the `appendEntitiesToScene` SSoT
 * so every producer of generated dimensions inserts its N `DimensionEntity`s as a SINGLE undoable
 * batch (`CompoundCommand`) (N.0.2 — no copy-paste of the append+broadcast persistence trigger).
 *
 * The caller names itself: `tool` tags the `drawing:entity-created` broadcast (auto-dimension =
 * `'dim-auto'`, plan recognition = its own), and `undoName` is the i18n-resolved label of the undo
 * entry — never a hard-coded string here (N.11).
 *
 * Mirrors `bim/columns/add-column-to-scene.ts`. Reusing `appendEntitiesToScene`
 * gives, for free: 1 Ctrl+Z removes the whole set, each dim broadcasts
 * `drawing:entity-created` (persistence), and the already-mounted
 * `useDimAssociationObserver` picks up the batch to track host→dim associations.
 * Inside an outer `runAsSingleUndo` the batch joins that one entry (ADR-729).
 *
 * @see bim/scene/append-entity-to-scene.ts — generic batch SSoT (ADR-397/511)
 */

import {
  appendEntitiesToScene,
  type SceneAppendAccessor,
} from './append-entity-to-scene';
import type { DimensionEntity } from '../../types/dimension';

/** Who writes, and how the undo entry reads. */
export interface AddDimensionsOptions {
  /** Producer tag of the `drawing:entity-created` broadcast. */
  readonly tool: string;
  /** Undo-history label — already translated by the caller. */
  readonly undoName: string;
}

/**
 * Append MANY generated dimensions to the active level scene as one
 * undoable batch. No-op when there is no active level / scene / dimensions.
 */
export function addDimensionsToScene(
  dimensions: readonly DimensionEntity[],
  accessor: SceneAppendAccessor,
  options: AddDimensionsOptions,
): void {
  appendEntitiesToScene(accessor, dimensions, options.tool, options.undoName);
}
