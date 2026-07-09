/**
 * CREATE BEAMS COMMAND — ADR-441 Slice GEN-BEAM («Δοκάρια από κάναβο») / ADR-607.
 *
 * Batch-creates N pre-built `BeamEntity` σε ΕΝΑ undoable βήμα. Thin config binding over
 * the `createBatchEntitiesCommand` SSoT factory (ADR-607) — deferred-Firestore batch
 * create/undo, unchanged public API (`new CreateBeamsCommand(beams, sceneManager)`).
 *
 * @see ./create-batch-entities-command.ts — the parametric single source
 */

import type { BeamEntity } from '../../../bim/types/beam-types';
import { createBatchEntitiesCommand } from './create-batch-entities-command';

export const CreateBeamsCommand = createBatchEntitiesCommand<BeamEntity>({
  name: 'CreateBeams',
  type: 'create-beams',
  bimType: 'beam',
  descriptionNoun: 'grid beams',
  serializeIdsKey: 'beamIds',
  validationNoun: 'beam',
});
