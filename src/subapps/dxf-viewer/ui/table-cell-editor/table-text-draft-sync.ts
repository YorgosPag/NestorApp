'use client';

/**
 * 🔴 ADR-753 Φ4 — **ΤΟ ΠΡΟΧΕΙΡΟ ΠΡΩΤΑ**: γιατί μια εντολή μορφοποίησης χαρακτήρων οφείλει να
 * γράψει και το κείμενο πάνω στο οποίο μετρήθηκαν οι δείκτες της.
 *
 * ## Το ελάττωμα που κλείνει — και ήταν **σιωπηλό**
 * Σε λειτουργία γραφής, το κείμενο που βλέπει ο χρήστης ζει στο **πρόχειρο** του δρομέα
 * (`TableCellCursorState.draft`) και φτάνει στο μοντέλο μόνο στη **δέσμευση** (`Enter`,
 * απώλεια εστίασης). Τα `runs` όμως δείχνουν σε θέσεις του `TableCell.value` — του
 * **δεσμευμένου** κειμένου. Άρα:
 *
 * ```
 *   κενό κελί → πληκτρολογείς «ΝΕΣΤΩΡ» → μαρκάρεις «ΣΤ» → «Β»
 *      value = ''        ⇒ textLength = 0
 *      εύρος [3,5)       ⇒ clampRange → [0,0) ⇒ ΚΑΝΕΝΑ RUN
 *      το κουμπί δεν κάνει ΤΙΠΟΤΑ, χωρίς κανένα σφάλμα πουθενά
 * ```
 *
 * Και η χειρότερη εκδοχή δεν είναι το «τίποτα»: με μη κενό κελί οι δείκτες **χωράνε** και
 * βάφουν **άλλα** γράμματα, ενώ η επόμενη δέσμευση τους μετατοπίζει ξανά
 * (`remapCellTextRuns`) — δηλαδή το λάθος εμφανίζεται δύο κινήσεις μακριά από την αιτία του.
 *
 * ## 🔴 Η ΛΥΣΗ ΔΕΝ ΕΙΝΑΙ ΝΕΑ ΔΙΑΔΡΟΜΗ ΓΡΑΦΗΣ
 * Είναι η **υπάρχουσα**, καλεσμένη νωρίτερα: `writeCellInput` (η ΜΙΑ διακλάδωση «`=` ή
 * κείμενο;») + `commitCellWrites` (ο ΕΝΑΣ επαναϋπολογισμός) — ακριβώς η αλυσίδα που τρέχει το
 * `buildTableCellEditCommand` στη δέσμευση, μαζί με τον **ίδιο** φρουρό διαδρομής. Ό,τι
 * αλλάζει είναι **πότε**, όχι **τι**.
 *
 * ## Γιατί ΜΙΑ εντολή και όχι δύο
 * Το κείμενο και η μορφοποίηση μπαίνουν στον **ίδιο** μετασχηματισμό, άρα σε ένα βήμα
 * αναίρεσης. Δύο εντολές θα σήμαιναν ότι ένα `Ctrl+Z` αφήνει runs που δείχνουν σε κείμενο που
 * μόλις αναιρέθηκε — δηλαδή ακριβώς την ασυμφωνία που αυτό το αρχείο υπάρχει για να κλείσει.
 * Ίδια αιτιολόγηση με την ατομικότητα γραφής+επαναϋπολογισμού της Φ.Ζ.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/table-text-draft-sync
 * @see bim/table/formula/table-formula-engine.ts — `writeCellInput` / `commitCellWrites`
 * @see bim/table/table-cell-edit-session.ts — η ίδια αλυσίδα, τη στιγμή της δέσμευσης
 */

import {
  commitCellWrites,
  writeCellInput,
} from '../../bim/table/formula/table-formula-engine';
import { getPersistedCellText } from '../../bim/table/table-cell-content';
import { resolveTableCellWriteRoute } from '../../bim/table/write-back/table-cell-write-route';
import type { TableCellRef } from '../../bim/table/table-cell-range';
import type { PersistedTableModel, TableBinding } from '../../types/table';
import { activeTableModel } from '../../bim/table/table-worksheet-resolve';

/** Ό,τι χρειάζεται για να αποφασιστεί αν το πρόχειρο **επιτρέπεται** να γραφτεί. */
export interface PendingDraftSync {
  readonly cell: TableCellRef;
  /** Το κείμενο που βλέπει ο χρήστης αυτή τη στιγμή στο πεδίο. */
  readonly draft: string;
  /** Ο δεσμός του πίνακα — ο φρουρός των κελιών που **δεν** γράφονται στο μοντέλο. */
  readonly binding: TableBinding | undefined;
}

/**
 * Το μοντέλο με το πρόχειρο **ήδη μέσα**· το **ίδιο** αντικείμενο by-reference όταν δεν
 * χρειάστηκε τίποτα.
 *
 * ## Οι τρεις καταστάσεις, ρητά
 * ```
 *   ίδιο κείμενο            →  τίποτα   (το κρατά ήδη η τέταρτη εγγύηση του γραφέα)
 *   κελί που ΔΕΝ γράφεται   →  τίποτα   (ίδιος φρουρός με το buildTableCellEditCommand)
 *   αλλιώς                  →  γράψε, με τον ΕΝΑ δρόμο
 * ```
 *
 * ⚠️ Ο φρουρός διαδρομής ρωτά το **μοντέλο που περνά ως όρισμα** και όχι το `activeTableModel(entity)`: σε
 * μια αλυσίδα καθαρών μετασχηματισμών τα δύο μπορεί να έχουν ήδη αποκλίνει, και η ερώτηση
 * «γράφεται αυτό το κελί;» πρέπει να απαντηθεί πάνω στην κατάσταση που **όντως** θα γραφτεί.
 *
 * ⚠️ Ο έλεγχος ισότητας είναι **σύντμηση, όχι φρουρός**, και ισχύει μόνο για κελιά κειμένου:
 * το `getPersistedCellText` ενός κελιού **τύπου** επιστρέφει το **αποτέλεσμα** (`'5'`) ενώ το
 * πρόχειρο κρατά το **πηγαίο** (`'=(2*5)/2'`), οπότε εκεί δεν πιάνει ποτέ και η δουλειά πέφτει
 * στον γραφέα — που έχει τη δική του, **δομική** ταυτότητα (δες `setPersistedCellFormula`).
 * Δηλαδή η ορθότητα δεν εξαρτάται από αυτή τη γραμμή· εξαρτάται από την τέταρτη εγγύηση, που
 * ισχύει και στις δύο διαδρομές. Ό,τι κερδίζεται εδώ είναι ένας αναλυτής τύπων ανά πάτημα.
 */
export function tableModelWithPendingDraft(
  model: PersistedTableModel,
  sync: PendingDraftSync,
): PersistedTableModel {
  const { cell, draft, binding } = sync;
  if (getPersistedCellText(model, cell.rowId, cell.colId) === draft) return model;
  if (resolveTableCellWriteRoute(model, binding, cell.rowId, cell.colId).kind !== 'model') {
    return model;
  }
  return commitCellWrites(writeCellInput(model, cell.rowId, cell.colId, draft));
}
