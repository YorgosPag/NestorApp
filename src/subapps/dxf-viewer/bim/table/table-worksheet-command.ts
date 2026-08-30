/**
 * ADR-833 Φάση 4 — **Η ΜΙΑ ΔΙΑΔΡΟΜΗ COMMIT ΤΩΝ ΠΡΑΞΕΩΝ ΦΥΛΛΟΥ**: σχέδιο → μία undoable
 * εντολή, ή `null` όταν δεν άλλαξε τίποτα.
 *
 * ## Γιατί δικό του αρχείο και όχι πέμπτος κατασκευαστής στο `table-cell-edit-session.ts`
 * Δύο ανεξάρτητοι λόγοι, και ο δεύτερος είναι ο σημασιολογικός:
 *  1. **Μέγεθος (N.7.1).** Το `table-cell-edit-session.ts` ήταν στις **393/500** γραμμές πριν
 *     από τη Φάση 4· τέσσερις κατασκευαστές εντολών ζουν ήδη εκεί.
 *  2. **Άλλο ερώτημα.** Οι τέσσερις εκεί απαντούν *«τι γράφεται **μέσα** στο ενεργό φύλλο»*
 *     (κελιά, δεσμός, στυλ). Αυτός εδώ απαντά *«τι γίνεται με τα **ίδια τα φύλλα**»* — και
 *     είναι ο μόνος που γράφει `activeWorksheetId` μέσα σε εντολή.
 *
 * ## 🔴 ΕΝΑΣ ΚΑΤΑΣΚΕΥΑΣΤΗΣ ΓΙΑ ΚΑΙ ΤΙΣ ΕΞΙ ΠΡΑΞΕΙΣ, ΟΧΙ ΕΞΙ
 * Προσθήκη, διαγραφή, μετονομασία, αναδιάταξη, προσθήκη βιβλίου, αντικατάσταση βιβλίου: όλες
 * παράγουν **το ίδιο σχήμα** (`TableWorksheetPlan`) και όλες γίνονται **το ίδιο** μπάλωμα. Έξι
 * `new UpdateEntityCommand(...)` θα ήταν έξι σημεία όπου μπορεί να ξεχαστεί ο έλεγχος
 * ταυτότητας ή να αλλάξει το σχήμα του patch — ακριβώς ο structural clone που πιάνει το
 * CHECK 3.28 (N.18), ανεξάρτητα ονόματος. Είναι το **ίδιο** επιχείρημα με το οποίο εξήχθη το
 * `buildTableModelCommand` (ADR-739 Φ.Δ βήμα 8) όταν απέκτησε τέσσερις γραφείς.
 *
 * ## 🔴 ΤΑ ΔΥΟ ΠΕΔΙΑ ΣΕ **ΜΙΑ** ΕΝΤΟΛΗ — η ίδια απαίτηση με το `{model, binding}`
 * Το ADR-833 §5.4 το γράφει ρητά: *«διαγραφή ενεργού φύλλου μετακινεί το `activeWorksheetId`
 * **στην ίδια εντολή**»*. Δύο εντολές θα σήμαιναν ότι ένα `Ctrl+Z` επαναφέρει το φύλλο αλλά
 * αφήνει το ενεργό σε **ανύπαρκτη** ταυτότητα — και το κακό δεν θα ήταν εξαίρεση: το
 * `activeWorksheet()` πέφτει **σιωπηλά** στο πρώτο φύλλο, δηλαδή ο χρήστης θα έβλεπε **λάθος
 * φύλλο** χωρίς κανένα σημάδι ότι κάτι πήγε στραβά.
 *
 * Εδώ η ατομικότητα είναι **δομική**: ένα `patch`, ένα `UpdateEntityCommand`, ένα undo.
 *
 * ## ⛔ ΠΟΤΕ `applyTableScenePatch` ΓΙΑ ΑΥΤΕΣ ΤΙΣ ΠΡΑΞΕΙΣ
 * Εκείνος ο γραφέας είναι **χωρίς ιστορικό**, επίτηδες, και εξυπηρετεί την **αλλαγή καρτέλας**
 * (Φάση 3), που δεν αλλάζει δεδομένα. Οι πράξεις εδώ καταστρέφουν και δημιουργούν — μια
 * διαγραφή φύλλου χωρίς `Ctrl+Z` θα ήταν απώλεια δεδομένων χωρίς επιστροφή.
 *
 * @module subapps/dxf-viewer/bim/table/table-worksheet-command
 * @see bim/table/table-worksheet-ops.ts — ΤΙ πρέπει να γίνει (οι καθαροί σχεδιαστές)
 * @see bim/table/table-cell-edit-session.ts — οι τέσσερις αδελφοί κατασκευαστές εντολών
 * @see docs/centralized-systems/reference/adrs/ADR-833-table-xlsx-import-and-worksheets.md §5.4
 */

import { UpdateEntityCommand } from '../../core/commands/entity-commands/UpdateEntityCommand';
import { activeWorksheet, resolveWorksheets } from './table-worksheet-resolve';
import { tableWorksheetsPatch } from './table-worksheet-write';
import type { TableWorksheetPlan } from './table-worksheet-ops';
import type { ICommand, ISceneManager } from '../../core/commands';
import type { TableEntity } from '../../types/table-entity';

/**
 * Σχέδιο πράξης φύλλων → **μία** εντολή, ή `null` όταν δεν άλλαξε τίποτα.
 *
 * ## Ο φύλακας no-op είναι **διπλός**, και οφείλει να είναι
 * Οι σχεδιαστές επιστρέφουν ήδη `null` για κάθε άκαρπη πράξη — αυτό είναι ο πρωτεύων δρόμος.
 * Ο έλεγχος εδώ είναι το **δίχτυ** (N.7.2 #4) και καλύπτει τη μία περίπτωση που ο σχεδιαστής
 * **δεν μπορεί** να δει: ένα σχέδιο που παράγει τον ίδιο πίνακα φύλλων **και** το ίδιο ενεργό.
 * Χωρίς αυτόν, μια τέτοια πράξη θα γεννούσε βήμα αναίρεσης για το τίποτα — και ο χρήστης θα
 * πατούσε `Ctrl+Z` σε καθαρό έργο βλέποντας τη στοίβα να «γεμίζει».
 *
 * ⚠️ Η σύγκριση των φύλλων είναι **ταυτότητας**, ποτέ βάθους: η εγγύηση «ίδια τιμή ⇒ ίδια
 * αναφορά» ισχύει σε ολόκληρη την αλυσίδα (ADR-739 Φ.Δ εγγύηση 4, ADR-833 §5.2), οπότε ένα
 * `===` απαντά ακριβώς το ίδιο με πολύ λιγότερα — και δεν είναι re-implementation της
 * λογικής ισότητας, που θα ήταν δεύτερη άποψη για το «άλλαξε».
 */
export function buildTableWorksheetCommand(
  entity: TableEntity,
  plan: TableWorksheetPlan | null,
  sceneManager: ISceneManager,
): ICommand | null {
  if (!plan) return null;

  const sameWorksheets = plan.worksheets === resolveWorksheets(entity);
  // Το «ίδιο ενεργό» ρωτιέται από τον **ΕΝΑ** επιλυτή και όχι από το ωμό πεδίο: μια οντότητα
  // της παλιάς μορφής δεν έχει καθόλου `activeWorksheetId`, οπότε μια ωμή σύγκριση θα έλεγε
  // «άλλαξε» για κάθε πίνακα γραμμένο πριν από τη Φάση 2 — δηλαδή ο φύλακας θα ήταν νεκρός
  // ακριβώς εκεί που χρειάζεται.
  const sameActive =
    plan.activeWorksheetId === undefined || plan.activeWorksheetId === activeWorksheet(entity).id;
  if (sameWorksheets && sameActive) return null;

  return new UpdateEntityCommand(
    entity.id,
    {
      ...tableWorksheetsPatch(entity, plan.worksheets),
      // Μπαίνει **μόνο όταν η πράξη το μετακινεί**: ένα άνευ όρων `activeWorksheetId` θα
      // «υλοποιούσε» το πεδίο σε κάθε παλιό πίνακα που απλώς μετονομάστηκε ένα φύλλο του,
      // δηλαδή θα έγραφε στο JSON τιμή που κανείς δεν ζήτησε.
      ...(plan.activeWorksheetId !== undefined && { activeWorksheetId: plan.activeWorksheetId }),
    },
    sceneManager,
  );
}
