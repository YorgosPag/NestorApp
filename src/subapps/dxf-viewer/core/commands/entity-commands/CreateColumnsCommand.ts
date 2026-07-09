/**
 * CREATE COLUMNS COMMAND — ADR-441 Slice GEN-COL («Κολώνες από κάναβο») / ADR-607.
 *
 * Batch-creates N pre-built `ColumnEntity` σε ΕΝΑ undoable βήμα. Thin config binding over
 * the `createBatchEntitiesCommand` SSoT factory (ADR-607) — deferred-Firestore batch
 * create/undo, unchanged public API (`new CreateColumnsCommand(columns, sceneManager)`).
 *
 * @see ./create-batch-entities-command.ts — the parametric single source
 */

import type { ColumnEntity } from '../../../bim/types/column-types';
import { createBatchEntitiesCommand } from './create-batch-entities-command';

export const CreateColumnsCommand = createBatchEntitiesCommand<ColumnEntity>({
  name: 'CreateColumns',
  type: 'create-columns',
  bimType: 'column',
  descriptionNoun: 'grid columns',
  serializeIdsKey: 'columnIds',
  validationNoun: 'column',
});
