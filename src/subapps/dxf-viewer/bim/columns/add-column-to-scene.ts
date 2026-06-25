/**
 * ADR-397 — thin column wrapper over the `appendEntityToScene` SSoT, so the
 * column DRAW tool (`useSpecialTools.onColumnCreated`) and the Ctrl-COPY hot-grip
 * path (`grip-parametric-commits.commitColumnCopy`) share ONE insertion routine
 * with the `tool: 'column'` tag baked in (N.0.2 — no copy-paste of the
 * append+broadcast persistence trigger).
 *
 * @see bim/scene/append-entity-to-scene.ts — generic SSoT
 * @see hooks/grips/grip-parametric-commits.ts — COPY caller (commitColumnCopy)
 */
import {
  appendEntityToScene,
  appendEntitiesToScene,
  type SceneAppendAccessor,
} from '../scene/append-entity-to-scene';
import type { ColumnEntity } from '../types/column-types';

/** @deprecated use `SceneAppendAccessor` — kept as an alias for existing imports. */
export type ColumnSceneAccessor = SceneAppendAccessor;

/**
 * Append `columnEntity` to the active level scene and broadcast
 * `drawing:entity-created` (tool: 'column'). No-op when there is no active
 * level / scene.
 */
export function addColumnToScene(columnEntity: ColumnEntity, accessor: SceneAppendAccessor): void {
  appendEntityToScene(accessor, columnEntity, 'column');
}

/**
 * ADR-511 / ADR-524 / ADR-527 — append MANY κολόνες ΣΕ ΕΝΑ batch (ΕΝΑΣ adapter →
 * CompoundCommand → ΕΝΑ undo step, Revit «room-fill = one undo»). Με το ADR-527 ο adapter
 * είναι ούτως ή άλλως singleton/level (stateless pass-through στο root live SSoT), οπότε το
 * batch helper παραμένει η σωστή σημασιολογία (ΕΝΑ atomic undo για όλες τις κολόνες, αντί
 * N ξεχωριστά). No-op σε κενό.
 */
export function addColumnsToScene(columns: readonly ColumnEntity[], accessor: SceneAppendAccessor): void {
  appendEntitiesToScene(accessor, columns, 'column', 'Δημιουργία κολόνων');
}
