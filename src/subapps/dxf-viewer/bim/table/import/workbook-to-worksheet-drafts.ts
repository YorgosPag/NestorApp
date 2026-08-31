/**
 * ADR-833 Φάση 4 — **ΒΙΒΛΙΟ → ΠΡΟΣΧΕΔΙΑ ΦΥΛΛΩΝ**: ο τρίτος κρίκος της εισαγωγής, και ο πρώτος
 * που βλέπει **ολόκληρο** το βιβλίο μαζί.
 *
 * ```
 *   xlsx-to-worksheets  →  ImportedWorksheet[]  (πλέγματα κειμένου, ένα ανά φύλλο)
 *   worksheet-to-model  →  ένα φύλλο            →  PersistedTableModel + τι κόπηκε
 *   ΕΔΩ                 →  όλο το βιβλίο        →  TableWorksheetDraft[] + τι κόπηκε ΣΥΝΟΛΙΚΑ
 * ```
 *
 * ## Γιατί καθαρή συνάρτηση και όχι λογική μέσα στο hook
 * Είναι το μόνο σημείο που απαντά **δύο** ερωτήσεις που κοστίζουν αν χαθούν — «πώς λέγεται
 * κάθε φύλλο» και «τι δεν χώρεσε» — και καμία από τις δύο δεν χρειάζεται React, σκηνή, ή
 * εντολή. Μέσα σε `useCallback` θα ήταν δοκιμάσιμες μόνο μέσα από ολόκληρο render, δηλαδή
 * πρακτικά καθόλου: ίδιο κριτήριο με το `table-double-click-gesture` («η **απόφαση** ζει
 * χωριστά, ο `useCallback` της δίνει μόνο container και μετασχηματισμό»).
 *
 * ## 🔴 ΤΟ ΚΟΨΙΜΟ ΑΘΡΟΙΖΕΤΑΙ, ΚΑΙ ΛΕΓΕΤΑΙ **ΜΙΑ** ΦΟΡΑ
 * Ο κανόνας της Φάσης 1 μένει ακέραιος («*καμία σιωπηλή απώλεια*»), αλλά η μονάδα του άλλαξε:
 * ένα φύλλο 2000 γραμμών ανάμεσα σε δώδεκα δεν επιτρέπεται να κοπεί χωρίς να το μάθει κανείς
 * επειδή τα υπόλοιπα έντεκα χώρεσαν. Και **δώδεκα** μηνύματα για δώδεκα φύλλα θα ήταν θόρυβος
 * που ο χρήστης κλείνει χωρίς να διαβάσει — δηλαδή η σιωπηλή απώλεια από την πίσω πόρτα.
 *
 * ## 🔴 ΤΟ ΟΝΟΜΑ ΤΟΥ EXCEL ΕΠΙΒΙΩΝΕΙ — ΚΑΙ ΤΟ ΚΕΝΟ ΜΕΝΕΙ ΑΠΟΝ
 * Δεδομένο χρήστη, ταξιδεύει αυτούσιο. Ένα **κενό** όνομα όμως δεν γίνεται `name: ''`: μένει
 * **απόν**, ώστε το φύλλο να πάρει το προεπιλεγμένο της θέσης του (§3 του
 * `types/table-worksheet.ts`). Η διαφορά δεν είναι αισθητική — ένα `name: ''` είναι κλειδί με
 * τιμή που ταξιδεύει στο Firestore και **δεν** ισοδυναμεί με «ανώνυμο» για κανέναν αναγνώστη.
 *
 * @module bim/table/import/workbook-to-worksheet-drafts
 * @see bim/table/import/xlsx-to-worksheets.ts — ο αναγνώστης (όλα τα φύλλα, από τη Φάση 1)
 * @see bim/table/import/worksheet-to-model.ts — ο προηγούμενος κρίκος, ανά φύλλο
 * @see bim/table/table-worksheet-ops.ts — πού προσγειώνονται (προσθήκη ή αντικατάσταση)
 */

import { worksheetGridToModel } from './worksheet-to-model';
import type { ImportedWorksheet } from './xlsx-to-worksheets';
import type { TableWorksheetDraft } from '../table-worksheet-ops';

/** Τα φύλλα του βιβλίου, έτοιμα να αποκτήσουν ταυτότητα — και τι δεν χώρεσε συνολικά. */
export interface WorkbookImportResult {
  readonly drafts: readonly TableWorksheetDraft[];
  /** Γραμμές που **δεν** χώρεσαν, αθροισμένες σε όλα τα φύλλα (`0` = μπήκαν όλες). */
  readonly droppedRows: number;
  /** Στήλες που **δεν** χώρεσαν, αθροισμένες σε όλα τα φύλλα. */
  readonly droppedColumns: number;
}

/**
 * Όλα τα φύλλα ενός βιβλίου → προσχέδια, **στη σειρά του βιβλίου**.
 *
 * Κενό βιβλίο ⇒ κενά προσχέδια και μηδενικό κόψιμο: ο καλών το διακρίνει με το μήκος, και το
 * λέει στον χρήστη με δικό του μήνυμα. Εδώ δεν υπάρχει τίποτα να αποφασιστεί.
 */
export function workbookToWorksheetDrafts(
  sheets: readonly ImportedWorksheet[],
): WorkbookImportResult {
  const results = sheets.map((sheet) => worksheetGridToModel(sheet.grid, sheet.format));
  return {
    drafts: sheets.map((sheet, index) =>
      // Δες την κεφαλίδα: κενό όνομα ⇒ **απόν** πεδίο, ποτέ `name: ''`.
      sheet.name ? { name: sheet.name, model: results[index].model } : { model: results[index].model },
    ),
    droppedRows: results.reduce((sum, result) => sum + result.droppedRows, 0),
    droppedColumns: results.reduce((sum, result) => sum + result.droppedColumns, 0),
  };
}
