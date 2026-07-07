/**
 * ADR-363 Phase 7.1 Step 6.6 — Bulk update command builder για multi-selection.
 *
 * Παίρνει `ids[]` + `patch` (partial subset των editable numeric props) και
 * δημιουργεί CompoundCommand που πατάει το patch σε κάθε entity με τον σωστό
 * per-kind Update*ParamsCommand. Single undo step.
 *
 * ADR-581 (boy-scout, N.0.2): ο per-kind switch εξάχθηκε στο κοινό SSoT
 * `systems/match-properties/match-params-command-builder.ts` ώστε να τον μοιράζεται
 * και ο Match/Transfer applier — μηδέν διπλότυπο kind→command. Εδώ μένει ΜΟΝΟ το
 * numeric-only filtering (invariant του bulk-edit) + το CompoundCommand wrapping.
 *
 * Skip rules:
 *  - Entity missing από scene → skip silently (defensive, scene races)
 *  - Patch key δεν αντιστοιχεί σε editable property του kind → skip το key
 *  - Όλες οι patch keys skipped για το entity → entity δεν παράγει command
 *  - Patch empty → returns CompoundCommand άδειο (no-op execute)
 *
 * @see bim-common-properties.ts SSoT για το «τι είναι editable per kind»
 * @see match-params-command-builder.ts κοινός per-kind builder
 * @see CompoundCommand atomic execution + rollback
 */

import type { ISceneManager, ICommand } from '../../core/commands/interfaces';
import { CompoundCommand } from '../../core/commands/CompoundCommand';
import { buildParamsUpdateCommand } from '../../systems/match-properties/match-params-command-builder';
import {
  COMMON_PROPERTIES_BY_KIND,
  type BimEditablePropertyKey,
} from '../types/bim-common-properties';
import type { EntityType } from '../../types/entities';

export type BimBulkEditPatch = Readonly<Partial<Record<BimEditablePropertyKey, number>>>;

/**
 * Φτιάχνει `CompoundCommand` που πατάει το `patch` σε κάθε entity από τα `ids`.
 * Δεν εκτελεί το command — caller καλεί `commandHistory.executeCommand(cmd)`.
 */
export function buildBulkUpdateCommand(
  ids: readonly string[],
  patch: BimBulkEditPatch,
  sceneManager: ISceneManager,
): CompoundCommand {
  const commands: ICommand[] = [];
  for (const id of ids) {
    const entity = sceneManager.getEntity(id);
    if (!entity) continue;
    const filteredPatch = filterPatchForKind(entity.type as EntityType, patch);
    if (filteredPatch === null) continue;
    const cmd = buildParamsUpdateCommand(entity, filteredPatch, sceneManager);
    if (cmd) commands.push(cmd);
  }
  return new CompoundCommand(`Bulk Update (${commands.length} entities)`, commands);
}

/** Επιστρέφει patch περιορισμένο σε editable keys του kind, ή null αν τίποτα δεν εφαρμόζεται. */
function filterPatchForKind(
  kind: EntityType,
  patch: BimBulkEditPatch,
): BimBulkEditPatch | null {
  const editable = COMMON_PROPERTIES_BY_KIND[kind];
  if (!editable || editable.length === 0) return null;
  const allowedKeys = new Set(editable.map((p) => p.key));
  const filtered: Partial<Record<BimEditablePropertyKey, number>> = {};
  let hasAny = false;
  for (const [key, value] of Object.entries(patch) as [BimEditablePropertyKey, number][]) {
    if (allowedKeys.has(key)) {
      filtered[key] = value;
      hasAny = true;
    }
  }
  return hasAny ? filtered : null;
}
