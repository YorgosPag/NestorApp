/**
 * CREATE FOUNDATIONS COMMAND — ADR-441 Slice 2 (εσχάρα πεδιλοδοκών από κάναβο) / ADR-607.
 *
 * Batch-creates N pre-built `FoundationEntity` σε ΕΝΑ undoable βήμα. Thin config binding
 * over the `createBatchEntitiesCommand` SSoT factory (ADR-607) — deferred-Firestore batch
 * create/undo, unchanged public API (`new CreateFoundationsCommand(foundations, sceneManager)`).
 *
 * @see ./create-batch-entities-command.ts — the parametric single source
 */

import type { FoundationEntity } from '../../../bim/types/foundation-types';
import { createBatchEntitiesCommand } from './create-batch-entities-command';

export const CreateFoundationsCommand = createBatchEntitiesCommand<FoundationEntity>({
  name: 'CreateFoundations',
  type: 'create-foundations',
  bimType: 'foundation',
  descriptionNoun: 'foundation strips',
  serializeIdsKey: 'foundationIds',
  validationNoun: 'foundation',
});
