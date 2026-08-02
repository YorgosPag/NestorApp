'use client';

/**
 * ADR-739 Φ.Δ βήμα 9 — **η μία διαδρομή commit ενός πίνακα**, ως hook.
 *
 * ## Γιατί βγήκε από το `use-table-range-actions`
 * Ζούσε εκεί ως ιδιωτικό `useCallback` όσο ο μόνος καταναλωτής ήταν το πρόχειρο. Με το μενού
 * των ζωνών έγιναν **δύο**, και η αντιγραφή θα ήταν λάθος σε δύο επίπεδα ταυτόχρονα:
 *
 *  - **Μηχανικά**: εννιά γραμμές με `createLevelSceneManagerAdapter` + `buildTableModelCommand`
 *    + `execute` είναι ακριβώς το σχήμα που πιάνει το CHECK 3.28 (jscpd, N.18) ως sibling clone.
 *  - **Ουσιαστικά**: ο §6.6 του ADR-739 απαιτεί **μία** διαδρομή δέσμευσης για κάθε αλλαγή
 *    πίνακα, ώστε «20 κελιά = ένα undo» να μην είναι υπόσχεση αλλά δομή. Δεύτερο αντίγραφο
 *    σημαίνει δεύτερο σημείο που μπορεί κάποτε να μάθει κάτι (π.χ. έλεγχο κλειδώματος) και το
 *    πρώτο όχι.
 *
 * Η συμπεριφορά είναι **αυτούσια**: `false` όταν λείπει οντότητα/όροφος ή όταν το μοντέλο
 * γύρισε ίδιο by-reference — δηλαδή καμία εντολή, κανένα βήμα undo για το τίποτα.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/use-table-model-commit
 * @see bim/table/table-cell-edit-session.ts — `buildTableModelCommand` (ο φύλακας του no-op)
 */

import { useCallback } from 'react';
import { createLevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import { buildTableModelCommand } from '../../bim/table/table-cell-edit-session';
import type { TableEntity } from '../../types/table-entity';
import type { ICommand } from '../../core/commands';
import type { LevelManagerLike } from '../../hooks/canvas/canvas-click-types';

export interface UseTableModelCommitParams {
  readonly levelManager: LevelManagerLike;
  readonly execute: (command: ICommand) => void;
}

/**
 * Οντότητα + νέο μοντέλο → **μία** εντολή. `true` όταν όντως εκτελέστηκε κάτι.
 *
 * Η οντότητα είναι **όρισμα κλήσης** και όχι εξάρτηση του hook, επειδή αυτό ακριβώς είναι
 * που πρέπει να διαβαστεί **τη στιγμή της ενέργειας**: το `getLevelScene` ανανεώνεται
 * ασύγχρονα, οπότε μια αναφορά κλεισμένη στο render μπορεί να είναι μπαγιάτικη (το σφάλμα
 * που τεκμηριώνει το `liveEntity` στο `useTableCellDoubleClickEditor`). Έτσι ο ίδιος
 * δεσμευτής εξυπηρετεί και τον καταναλωτή που κρατά την οντότητα σε render (πρόχειρο) και
 * εκείνον που τη διαβάζει με getter (μενού ζωνών).
 */
export type TableModelCommit = (entity: TableEntity, nextModel: TableEntity['model']) => boolean;

export function useTableModelCommit(params: UseTableModelCommitParams): TableModelCommit {
  const { levelManager, execute } = params;

  return useCallback(
    (entity: TableEntity, nextModel: TableEntity['model']): boolean => {
      const { currentLevelId, getLevelScene, setLevelScene } = levelManager;
      if (!currentLevelId || !setLevelScene) return false;
      const sceneManager = createLevelSceneManagerAdapter(getLevelScene, setLevelScene, currentLevelId);
      const command = buildTableModelCommand(entity, nextModel, sceneManager);
      if (!command) return false;
      execute(command);
      return true;
    },
    [levelManager, execute],
  );
}
