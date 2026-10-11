/**
 * MERGE COLUMNS COMMAND — ADR-363 Post-Creation Adjacency Merge.
 *
 * Συγχωνεύει N γειτονικές κολόνες που μαζί σχηματίζουν τοιχίο (Γ/Τ/Π) σε ΕΝΑ composite
 * `ColumnEntity` (Eurocode 8 §5.4.2.4 — ενιαίο φέρον στοιχείο). Single undoable ενέργεια (ΕΝΑ
 * Ctrl+Z): διαγραφή των N πηγών + δημιουργία του composite, συμμετρικά σε σκηνή και Firestore.
 *
 * Thin binding πάνω στο `createReplaceEntitiesCommand` (ADR-911 Φ4-2): το σώμα αυτής της εντολής
 * ήταν η πρώτη γραφή του μοτίβου «Ν πηγές → αντικαταστάτες» και απέκτησε δεύτερο καταναλωτή
 * (`ReplaceWallsCommand`). Η δημόσια υπογραφή `new MergeColumnsCommand(sources, composite, sm)`
 * και το σχήμα του `serialize()` δεν άλλαξαν.
 *
 * Firestore mapping (precedent: `DeleteEntityCommand`):
 *   - apply (execute/redo): `bim:column-delete-requested` ανά πηγή (delete) +
 *     `drawing:entity-created` για το composite (first-save via useColumnPersistence).
 *   - revert (undo): `bim:column-delete-requested` για το composite (delete) +
 *     `bim:entity-restore-requested` ανά πηγή (re-create, action='restored').
 *
 * @see ./replace-entities-command.ts — the parametric single source
 * @see core/commands/entity-commands/DeleteEntityCommand.ts — restore-on-undo precedent
 * @see bim/columns/column-adjacency-detector.ts — group detection + composite build
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md
 */

import type { ISceneManager } from '../interfaces';
import type { ColumnEntity } from '../../../bim/types/column-types';
import { createReplaceEntitiesCommand } from './replace-entities-command';

const ReplaceColumnsCommand = createReplaceEntitiesCommand<ColumnEntity>({
  name: 'MergeColumns',
  type: 'merge-columns',
  bimType: 'column',
  describe: (sources) => `Merge ${sources} columns into composite`,
  validate: (sources, [compositeId]) => {
    if (sources < 2) return 'At least two source columns are required';
    return compositeId ? null : 'Composite column is required';
  },
  serializeData: (sourceIds, [compositeId]) => ({ sourceIds, compositeId }),
});

export class MergeColumnsCommand extends ReplaceColumnsCommand {
  constructor(sources: readonly ColumnEntity[], composite: ColumnEntity, sceneManager: ISceneManager) {
    super(sources, [composite], sceneManager);
  }
}
