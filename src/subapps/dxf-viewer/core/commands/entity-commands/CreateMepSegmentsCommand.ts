/**
 * CREATE MEP SEGMENTS COMMAND — ADR-426 Slice 2 (water-supply auto-design accept) / ADR-607.
 *
 * Batch-creates N pre-built `MepSegmentEntity` σε ΕΝΑ undoable βήμα. Thin config binding
 * over the `createBatchEntitiesCommand` SSoT factory (ADR-607) — deferred-Firestore batch
 * create/undo, unchanged public API (`new CreateMepSegmentsCommand(segments, sceneManager)`).
 *
 * @see ./create-batch-entities-command.ts — the parametric single source
 */

import type { MepSegmentEntity } from '../../../bim/types/mep-segment-types';
import { createBatchEntitiesCommand } from './create-batch-entities-command';

export const CreateMepSegmentsCommand = createBatchEntitiesCommand<MepSegmentEntity>({
  name: 'CreateMepSegments',
  type: 'create-mep-segments',
  bimType: 'mep-segment',
  descriptionNoun: 'MEP pipe segments',
  serializeIdsKey: 'segmentIds',
  validationNoun: 'segment',
});
