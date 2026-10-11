/**
 * CREATE OPENINGS COMMAND — ADR-911 Φ4-2 / ADR-607.
 *
 * Batch-creates N pre-built `OpeningEntity` σε ΕΝΑ undoable βήμα. Thin config binding over the
 * `createBatchEntitiesCommand` SSoT factory (ADR-607): εκπομπή δημιουργίας σε execute/redo,
 * αίτημα διαγραφής σε undo — ώστε Ctrl+Z να ΜΗΝ αφήνει ορφανό άνοιγμα στο Firestore (το γνωστό
 * χρέος του `onOpeningCreated`, ADR-568 §5).
 *
 * Τα ανοίγματα φτάνουν έτοιμα (params + γεωμετρία + validation από το `buildOpeningEntity`)·
 * ο καθρέφτης του ξενιστή γράφεται από το `SetHostedOpeningIdsCommand` στην ίδια ατομική ομάδα.
 *
 * @see ./create-batch-entities-command.ts — the parametric single source
 * @see ../../../bim/model-from-drawing/add-openings-to-scene.ts — ο μοναδικός καλών
 */

import type { OpeningEntity } from '../../../bim/types/opening-types';
import { createBatchEntitiesCommand } from './create-batch-entities-command';

export const CreateOpeningsCommand = createBatchEntitiesCommand<OpeningEntity>({
  name: 'CreateOpenings',
  type: 'create-openings',
  bimType: 'opening',
  descriptionNoun: 'openings',
  serializeIdsKey: 'openingIds',
  validationNoun: 'opening',
});
