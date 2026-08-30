/**
 * ADR-833 §1.1 — **αρχείο `.xlsx` → ουδέτερα πλέγματα κειμένου**, ένα ανά φύλλο εργασίας.
 *
 * Ο αναγνώστης έχει **μία** δουλειά: να παραδώσει ό,τι ακριβώς ζητά η ήδη υπάρχουσα πόρτα
 * εισαγωγής, το `pasteTsvIntoTable` (`bim/table/table-range-clipboard.ts`), που στην κεφαλίδα
 * της δηλώνει ρητά: *«🚪 Η ΠΟΡΤΑ ΓΙΑ ΤΗΝ ΕΙΣΑΓΩΓΗ ΑΠΟ ΑΡΧΕΙΟ EXCEL — ένας μελλοντικός
 * εισαγωγέας έχει ακριβώς μία δουλειά: να παράγει ένα `TsvGrid`»*. Αυτό είναι το αρχείο εκείνο.
 * Ό,τι ακολουθεί (κόψιμο στα όρια, επίγνωση συγχωνεύσεων, αναγνώριση τύπων, επανυπολογισμός,
 * **ένα** βήμα undo) το κληρονομεί δωρεάν. **Δεύτερος γραφέας δεν επιτρέπεται.**
 *
 * ## 🔴 Τρεις αποφάσεις που ΔΕΝ είναι λεπτομέρειες
 *
 * **1. Κρατά τις κενές γραμμές.** Το αδελφό `systems/topography/topo-excel-reader.ts:44`
 * πετά τις κενές (`if (cells.some(…))`) — **σωστό** για νέφος σημείων, **καταστροφικό** για
 * πίνακα: μια κενή γραμμή στη μέση ενός φύλλου είναι **διαχωριστικό που ο χρήστης έβαλε**, και
 * η αφαίρεσή της μετακινεί προς τα πάνω κάθε επόμενη γραμμή. Γι' αυτό εδώ η σάρωση γίνεται με
 * `rowCount`/`columnCount` (γεωμετρία του φύλλου) και όχι με `eachRow` (μόνο τα γεμάτα).
 *
 * **2. Τιμές, ΟΧΙ τύποι — και είναι συνειδητό.** Ένα κελί `=SUM(A1:A3)` γίνεται ο **αριθμός**
 * που είχε το Excel, όχι ζωντανός τύπος. Ο πειρασμός είναι μεγάλος (το `writeCellInput`
 * αναγνωρίζει το `=` και θα τον έφτιαχνε μόνο του) και θα ήταν **λάθος**: ο τύπος του Excel
 * δείχνει σε **διευθύνσεις του Excel**, και μέχρι να αποδειχθεί ότι η αντιστοίχιση θέσεων
 * κρατά ακέραιη σε κάθε διαδρομή, ένας τύπος που δείχνει σε **λάθος κελί** είναι σφάλμα
 * **τιμής** — η χειρότερη κατηγορία, γιατί δείχνει έναν αριθμό που κανείς δεν υπολόγισε
 * (ADR-720). Η τιμή είναι σωστή· απλώς δεν ξαναϋπολογίζεται. Δες ADR-833 Φάση 6.
 *
 * **3. Χωρίς `columnLetter` εδώ.** Ο SSoT `lib/spreadsheet/column-letter.ts` υπάρχει και είναι
 * ο σωστός για διευθύνσεις A1 — αλλά αυτός ο αναγνώστης δεν παράγει **καμία** διεύθυνση:
 * παραδίδει πλέγμα κατά θέση. Το να τον καλούσε θα ήταν εξάρτηση χωρίς καταναλωτή.
 *
 * ⚠️ Το `exceljs` (MIT) είναι **ήδη** εξάρτηση — κανένα νέο πακέτο (η πύλη αδειών N.5 δεν
 * ενεργοποιείται). Φορτώνεται με **δυναμική εισαγωγή** όπως κάθε άλλος καταναλωτής του repo:
 * τα ~600 KB μένουν έξω από το κύριο bundle του DXF viewer (ADR-040) και τα πληρώνει μόνο
 * όποιος πράγματι διαλέξει αρχείο.
 *
 * @module bim/table/import/xlsx-to-worksheets
 * @see bim/table/table-range-clipboard.ts — η πόρτα που καταναλώνει το `TsvGrid`
 * @see bim/table/import/worksheet-to-model.ts — ο επόμενος κρίκος (πλέγμα → μοντέλο πίνακα)
 */

import type ExcelJS from 'exceljs';
import type { TsvGrid } from '@/lib/spreadsheet/tsv';

/** Ένα φύλλο εργασίας του βιβλίου, σε ουδέτερη μορφή. */
export interface ImportedWorksheet {
  /** Το όνομα της καρτέλας στο Excel — δεδομένο χρήστη, ταξιδεύει αυτούσιο. */
  readonly name: string;
  /** Το περιεχόμενο **κατά θέση**: `grid[r][c]`, με τις κενές γραμμές/στήλες παρούσες. */
  readonly grid: TsvGrid;
}

/**
 * Ένα κελί του Excel σε σκέτο κείμενο.
 *
 * Οι τέσσερις μορφές που επιστρέφει το `exceljs` και **δεν** είναι πρωτόγονες:
 * τύπος (`{ formula, result }`), πλούσιο κείμενο (`{ richText }`), υπερσύνδεσμος
 * (`{ text, hyperlink }`) και σφάλμα (`{ error }`). Χωρίς αυτόν τον έλεγχο, το `String(value)`
 * θα έγραφε `[object Object]` — δηλαδή **ορατή** ζημιά, αλλά σε κάθε κελί με τύπο.
 */
function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== 'object') return String(value);
  // Τύπος: κρατάμε το **αποτέλεσμα** — δες την απόφαση 2 στην κεφαλίδα.
  if ('result' in value) return cellToString(value.result as ExcelJS.CellValue);
  if ('error' in value) return String(value.error);
  if ('richText' in value) {
    return value.richText.map((run) => run.text).join('');
  }
  if ('text' in value) return String(value.text ?? '');
  return '';
}

/**
 * Ένα φύλλο → ορθογώνιο πλέγμα κειμένου, **διατηρώντας τη θέση κάθε κελιού**.
 *
 * `rowCount`/`columnCount` είναι η **γεωμετρία** που δηλώνει το φύλλο (περιλαμβάνει τις κενές
 * ενδιάμεσες), σε αντίθεση με τα `actualRowCount`/`eachRow` που βλέπουν μόνο τα γεμάτα.
 * Τα ευρετήρια του `exceljs` είναι **1-based** — και οι δύο βρόχοι ξεκινούν από το 1.
 */
function worksheetToGrid(sheet: ExcelJS.Worksheet): TsvGrid {
  const rows: string[][] = [];
  for (let r = 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const cells: string[] = [];
    for (let c = 1; c <= sheet.columnCount; c++) {
      cells.push(cellToString(row.getCell(c).value));
    }
    rows.push(cells);
  }
  return rows;
}

/**
 * Διαβάζει **ΟΛΑ** τα φύλλα εργασίας ενός `.xlsx` — όχι μόνο το πρώτο.
 *
 * 🔴 Το «όχι μόνο το πρώτο» είναι η ουσία: το `topo-excel-reader.ts:41` παίρνει
 * `workbook.worksheets[0]` και τα υπόλοιπα εξαφανίζονται **σιωπηλά**. Για τοπογραφικά σημεία
 * είναι αποδεκτό (ένα φύλλο, μία μέτρηση)· για βιβλίο εργασίας είναι απώλεια δεδομένων χωρίς
 * μήνυμα. Ο καλών μαθαίνει πόσα βρήκε και αποφασίζει τι κάνει με αυτά.
 *
 * @returns Ένα `ImportedWorksheet` ανά φύλλο, **στη σειρά του βιβλίου**. Κενός πίνακας για
 *   βιβλίο χωρίς φύλλα — ο καλών το διακρίνει από το «φύλλο χωρίς γραμμές» (κενό `grid`).
 */
export async function readXlsxWorksheets(buffer: ArrayBuffer): Promise<readonly ImportedWorksheet[]> {
  const ExcelJSLib = (await import('exceljs')).default;
  const workbook = new ExcelJSLib.Workbook();
  await workbook.xlsx.load(buffer);

  return workbook.worksheets.map((sheet) => ({
    name: sheet.name,
    grid: worksheetToGrid(sheet),
  }));
}
