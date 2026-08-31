/**
 * table-worksheet-menu-state — **ΤΙ ΕΠΙΤΡΕΠΕΤΑΙ, ΤΗ ΣΤΙΓΜΗ ΠΟΥ ΑΝΟΙΓΕΙ ΤΟ ΜΕΝΟΥ**
 *
 * ADR-833 Φάση 4, εξαγμένο στη **Φάση 5Β**. Χωριστό αρχείο από τους σχεδιαστές
 * (`table-worksheet-ops.ts`) για δύο ανεξάρτητους λόγους — και ο δεύτερος είναι ο
 * σημασιολογικός:
 *
 *  1. **Μέγεθος (N.7.1).** Με τον φύλακα χωρητικότητας της Φ5Β μέσα, οι σχεδιαστές έφτασαν
 *     **505/500** γραμμές. Ο κανόνας λέει **εξαγωγή**, ποτέ σύμπτυξη τεκμηρίωσης.
 *  2. **Άλλο ερώτημα.** Οι σχεδιαστές απαντούν *«τι πρέπει να γίνει»* και παράγουν σχέδια·
 *     αυτό εδώ απαντά *«τι επιτρέπεται να **προσφερθεί**»* και παράγει σημαίες οθόνης. Η
 *     ίδια διάκριση με το `worksheetMenuState` ⇄ `planWorksheet*` που ήδη υπήρχε μέσα στο
 *     ένα αρχείο — τώρα είναι και δομική.
 *
 * 🔑 **Δεν επαναδιατυπώνει κανέναν κανόνα**: ρωτά τους ίδιους σχεδιαστές που θα εκτελέσουν
 * τις πράξεις. Γι' αυτό η εξαγωγή είναι ασφαλής — δεν μετακόμισε γνώση, μετακόμισε ένας
 * **καταναλωτής** γνώσης.
 *
 * @module subapps/dxf-viewer/bim/table/table-worksheet-menu-state
 * @see bim/table/table-worksheet-ops — οι σχεδιαστές που ρωτιούνται
 * @see docs/centralized-systems/reference/adrs/ADR-833-table-xlsx-import-and-worksheets.md §5.4, §5.8
 */

import {
  newWorksheetModel,
  planWorksheetAdd,
  planWorksheetDelete,
  planWorksheetMove,
} from './table-worksheet-ops';
import { resolveWorksheets } from './table-worksheet-resolve';
import type { TableEntity } from '../../types/table-entity';
import type { TableWorksheetId } from '../../types/table-worksheet';

/**
 * Ό,τι πρέπει να ξέρει το μενού καρτέλας **τη στιγμή που ανοίγει**, όχι στο τελευταίο render.
 *
 * Ίδιο σχήμα —και ίδιος λόγος— με το `resolveHeaderState` του μενού ζωνών: οι σημαίες «μπορώ;»
 * απαντιούνται τη στιγμή του ανοίγματος, αλλιώς ένα `Ctrl+Z` ενδιάμεσα θα άφηνε item ενεργό
 * ενώ η πράξη δεν επιτρέπεται πια.
 */
export interface TableWorksheetMenuState {
  readonly index: number;
  /**
   * 🔴 ADR-833 Φ5Β — «χωρά **άλλο** φύλλο ο πίνακας;». Το μενού το ρωτά ώστε το παράνομο να
   * **μην προσφέρεται** (η σχολή του Excel), αντί να προσφέρεται και να μην κάνει τίποτα.
   */
  readonly canAdd: boolean;
  readonly canDelete: boolean;
  readonly canMoveLeft: boolean;
  readonly canMoveRight: boolean;
}

/**
 * Οι τρεις σημαίες του μενού, από την **ίδια** πηγή που θα εκτελέσει τις πράξεις.
 *
 * 🔑 Δεν επαναδιατυπώνει κανέναν κανόνα: ρωτά τους **ίδιους** σχεδιαστές. Μια δεύτερη
 * διατύπωση του «μπορώ να διαγράψω;» εδώ θα ήταν η πρώτη ευκαιρία το μενού να δείχνει ενεργό
 * ό,τι ο σχεδιαστής αρνείται — ή, χειρότερα, γκρίζο ό,τι επιτρέπεται.
 */
export function worksheetMenuState(
  entity: TableEntity,
  targetId: TableWorksheetId,
): TableWorksheetMenuState | null {
  const worksheets = resolveWorksheets(entity);
  const index = worksheets.findIndex((sheet) => sheet.id === targetId);
  if (index < 0) return null;
  return {
    index,
    // Ρωτά τον **ίδιο** σχεδιαστή που θα εκτελέσει την πράξη — όπως και οι άλλες τρεις
    // σημαίες. Μια δεύτερη διατύπωση του «χωρά;» εδώ θα ήταν η πρώτη ευκαιρία το μενού να
    // δείχνει ενεργό ό,τι ο σχεδιαστής αρνείται.
    canAdd: planWorksheetAdd(entity, newWorksheetModel(entity)) !== null,
    canDelete: planWorksheetDelete(entity, targetId, null) !== null,
    canMoveLeft: planWorksheetMove(entity, targetId, index - 1) !== null,
    canMoveRight: planWorksheetMove(entity, targetId, index + 1) !== null,
  };
}
