/**
 * CREATE WALLS COMMAND — ADR-441 Slice GEN-WALL («Τοίχοι από κάναβο») / ADR-607.
 *
 * Batch-creates N pre-built `WallEntity` σε ΕΝΑ undoable βήμα. Thin config binding over
 * the `createBatchEntitiesCommand` SSoT factory (ADR-607) — deferred-Firestore batch
 * create/undo, unchanged public API (`new CreateWallsCommand(walls, sceneManager)`).
 *
 * @see ./create-batch-entities-command.ts — the parametric single source
 */

import type { WallEntity } from '../../../bim/types/wall-types';
import { createBatchEntitiesCommand } from './create-batch-entities-command';

export const CreateWallsCommand = createBatchEntitiesCommand<WallEntity>({
  name: 'CreateWalls',
  type: 'create-walls',
  bimType: 'wall',
  descriptionNoun: 'grid walls',
  serializeIdsKey: 'wallIds',
  validationNoun: 'wall',
});
