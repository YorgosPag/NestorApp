/**
 * REPLACE WALLS COMMAND — ADR-911 Φ4-2.
 *
 * Ν τοίχοι φεύγουν, Μ τοίχοι μπαίνουν στη θέση τους, σε ΕΝΑ αναιρέσιμο βήμα — συμμετρικά σε σκηνή
 * και Firestore. Thin config binding πάνω στο `createReplaceEntitiesCommand`.
 *
 * Καταναλωτής: ο γραφέας ανοιγμάτων του βοηθού «Μοντέλο από το σχέδιο». Οι ομοαξονικοί τοίχοι
 * που το σχέδιο ζωγραφίζει κομμένους στην πόρτα γίνονται ΕΝΑΣ συνεχής τοίχος (Revit/ArchiCAD: ο
 * τοίχος είναι συνεχής, το κούφωμα φιλοξενείται μέσα του)· τα νέα κομμάτια λαμπά–λαμπά μπαίνουν
 * στην ίδια εντολή.
 *
 * ⚠️ ΔΕΝ υπολογίζει ενώσεις και ΔΕΝ μεταφέρει ανοίγματα: οι αντικαταστάτες φτάνουν με ψημένες
 * ενώσεις, και τα φιλοξενούμενα ανοίγματα των πηγών τα μεταφέρει το `RehostOpeningsCommand` της
 * ίδιας ατομικής ομάδας.
 *
 * @see ./replace-entities-command.ts — the parametric single source
 * @see ./WallMergeCommand.ts — το διαδραστικό εργαλείο ένωσης ζεύγους (ADR-566), άλλη διαδρομή
 */

import type { WallEntity } from '../../../bim/types/wall-types';
import { createReplaceEntitiesCommand } from './replace-entities-command';

export const ReplaceWallsCommand = createReplaceEntitiesCommand<WallEntity>({
  name: 'ReplaceWalls',
  type: 'replace-walls',
  bimType: 'wall',
  describe: (sources, replacements) => `Replace ${sources} walls with ${replacements}`,
  validate: (sources, replacementIds) => {
    if (sources === 0) return 'At least one source wall is required';
    if (replacementIds.length === 0) return 'At least one replacement wall is required';
    return replacementIds.some((id) => !id) ? 'Every replacement wall must have an id' : null;
  },
  serializeData: (sourceIds, replacementIds) => ({ sourceIds, replacementIds }),
});
