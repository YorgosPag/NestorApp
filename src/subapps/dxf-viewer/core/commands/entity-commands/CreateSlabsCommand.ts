/**
 * CREATE SLABS COMMAND — ADR-441 Slice GEN-SLAB («Πλάκες από κάναβο») / ADR-607.
 *
 * Batch-creates N pre-built `SlabEntity` σε ΕΝΑ undoable βήμα. Thin config binding over
 * the `createBatchEntitiesCommand` SSoT factory (ADR-607) — deferred-Firestore batch
 * create/undo, unchanged public API (`new CreateSlabsCommand(slabs, sceneManager)`).
 *
 * @see ./create-batch-entities-command.ts — the parametric single source
 */

import type { SlabEntity } from '../../../bim/types/slab-types';
import { createBatchEntitiesCommand } from './create-batch-entities-command';

export const CreateSlabsCommand = createBatchEntitiesCommand<SlabEntity>({
  name: 'CreateSlabs',
  type: 'create-slabs',
  bimType: 'slab',
  descriptionNoun: 'grid slabs',
  serializeIdsKey: 'slabIds',
  validationNoun: 'slab',
});
