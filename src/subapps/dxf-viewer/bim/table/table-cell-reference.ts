/**
 * ADR-739 Φ.Δ βήμα 7 — **η ονοματολογία αναφοράς κελιού (`A1`)**. Καθαρή, μηδέν React/DOM.
 *
 * ## Γιατί `A1` και όχι κάτι δικό μας — τρεις δεσμεύσεις, όχι προτίμηση
 * 1. **Ο μηχανισμός τύπων το απαιτεί.** Το ADR-739 §9.2 έχει ήδη επιλέξει το
 *    `fast-formula-parser` (MIT) και δηλώνει ρητά ότι «η βιβλιοθήκη μιλά `A1`/`B2`, το
 *    μοντέλο μας μιλά column-id/row-id· ο adapter είναι το **μόνο** σημείο μετάφρασης».
 *    Αυτό το αρχείο **είναι** αυτό το σημείο, γραμμένο μια φάση νωρίτερα.
 * 2. **Το DXF το γράφει ήδη.** Ένα κελί `ACAD_TABLE` κρατά τύπους της μορφής `=Sum(A1:A5)`
 *    (§2, γραμμή AutoCAD). Άλλη ονοματολογία ⇒ μεταφραστής στην εξαγωγή, δηλαδή δεύτερος.
 * 3. **Το CAD το δείχνει ήδη.** Ο in-place επεξεργαστής πίνακα του AutoCAD εμφανίζει
 *    **γράμματα στηλών και αριθμούς γραμμών** γύρω από τον πίνακα όσο επεξεργάζεσαι κελί
 *    (μεταβλητή `TABLEINDICATOR`). Άρα το `A1` δεν είναι «σύμβαση φύλλου υπολογισμού που
 *    δανειστήκαμε» — είναι το προηγούμενο **του ίδιου του domain**.
 *
 * ## 🔴 Γιατί ΔΕΝ είναι «όνομα στήλης + αριθμός γραμμής»
 * Ήταν η εναλλακτική που εξετάστηκε (πιο κοντά σε πίνακα ποσοτήτων: «Περιγραφή3»). Είναι
 * **δομικά αδύνατη ως ταυτότητα**: ο {@link TableColumn} **δεν έχει πεδίο ονόματος**. Η
 * κεφαλίδα είναι απλώς ένα κελί σε γραμμή με `rowClass: 'header'` — μπορεί να λείπει
 * ολόκληρη η γραμμή, να είναι κενή, ή δύο στήλες να έχουν το **ίδιο** κείμενο. Μια
 * ταυτότητα που μπορεί να μη λύνεται ή να λύνεται διπλά δεν είναι ταυτότητα· και επειδή
 * θα την κληρονομούσαν οι τύποι, η πρώτη διπλή κεφαλίδα θα έδινε **λάθος άθροισμα**.
 *
 * Η κεφαλίδα επιστρέφεται όμως **δίπλα** στην αναφορά ({@link TableCellReference.columnHeader}):
 * ταυτότητα το `B3`, **συμφραζόμενο** το «Περιγραφή». Ούτε το Excel, ούτε τα Google Sheets,
 * ούτε το AutoCAD δείχνουν και τα δύο — σε πίνακα ποσοτήτων το νόημα της στήλης είναι
 * ακριβώς αυτό που ψάχνει ο μηχανικός, και δεν κοστίζει τίποτα γιατί είναι **παράγωγο**.
 *
 * ## Η αρίθμηση μετρά ΟΛΕΣ τις γραμμές
 * Γραμμή 1 είναι ο τίτλος, αν υπάρχει τίτλος. Καμία παράλειψη των `title`/`header`: ο
 * μηχανισμός τύπων διευθυνσιοδοτεί το **ίδιο** πλέγμα, και μια αρίθμηση που «πηδά» τις
 * γραμμές κεφαλίδας θα σήμαινε ότι το `B3` της οθόνης δεν είναι το `B3` του τύπου.
 *
 * @module subapps/dxf-viewer/bim/table/table-cell-reference
 * @see lib/spreadsheet/column-letter.ts — η μετατροπή δείκτη ⇄ γράμματος (κοινό SSoT)
 * @see bim/table/table-cell-navigation.ts — η θέση του δρομέα που ονοματίζεται εδώ
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §25
 */

import { columnIndexFromLetter, columnLetter } from '@/lib/spreadsheet/column-letter';
import type { TableColumnId, TableModel, TableRowId } from '../../types/table';
import { buildMergeIndex, cellKey, cellText, getCell, indexById } from './table-model-helpers';
import { cellPairIndices } from './table-cell-order';
import { tableCursorAt, type TableCursorPosition } from './table-cell-navigation';
import type { TableColumnLayout, TableRowLayout } from './table-layout-types';

/**
 * Ο διαχωριστής εύρους — η σύμβαση κάθε φύλλου υπολογισμού και του `ACAD_TABLE`.
 *
 * Εξάγεται (ADR-754 Γ3) επειδή το `F4` ξαναγράφει τα δολάρια **και στα δύο άκρα** ενός εύρους
 * και οφείλει να το ξανασυναρμολογήσει με τον ίδιο ακριβώς χαρακτήρα που το έγραψε αυτό το
 * αρχείο. Ένα δεύτερο `':'` κάπου αλλού δεν πιάνεται από κανένα εργαλείο και αποκλίνει σιωπηλά.
 */
export const RANGE_SEPARATOR = ':';

/**
 * Πώς ονομάζεται ένα κελί, στα δύο επίπεδα που χρειάζονται δύο διαφορετικοί καταναλωτές.
 */
export interface TableCellReference {
  /**
   * Ό,τι **βλέπει** ο χρήστης: `'B3'`, ή `'B3:C4'` όταν το κελί είναι συγχωνευμένο.
   *
   * ⚠️ Το εύρος σε συγχώνευση είναι **συνειδητή απόκλιση από το Excel**, που δείχνει σκέτη
   * την άγκυρα (`C7`) ενώ ταυτόχρονα η γραμμή τύπων του γράφει `C7:D7` — τεκμηριωμένη πηγή
   * σύγχυσης. Τα Google Sheets δείχνουν το εύρος. Εδώ το εύρος είναι **γνωστό** από το
   * μοντέλο, άρα η απόκρυψή του θα ήταν επιλογή να πούμε λιγότερα απ' όσα ξέρουμε.
   */
  readonly a1: string;
  /**
   * **Μόνο** η άγκυρα (`'B3'`), πάντα χωρίς εύρος. Αυτό μιλά ο μηχανισμός τύπων: μια
   * συγχώνευση κρατά **ένα** περιεχόμενο, στην άγκυρα — δες `buildMergeIndex`.
   */
  readonly anchorA1: string;
  /**
   * Το κείμενο κεφαλίδας της στήλης· κενό όταν ο πίνακας δεν έχει γραμμή `header` ή όταν
   * το κελί κεφαλίδας είναι άδειο. **Ποτέ** μέρος της ταυτότητας — δες την κεφαλίδα.
   */
  readonly columnHeader: string;
}

/**
 * Το γράμμα μιας στήλης του μοντέλου· κενό όταν η ταυτότητα δεν υπάρχει (μπαγιάτικος
 * δρομέας μετά από undo / διαγραφή στήλης).
 */
export function tableColumnLetter(model: TableModel, colId: TableColumnId): string {
  const index = indexById(model.columns).get(colId);
  return index === undefined ? '' : columnLetter(index);
}

/**
 * Ο αριθμός μιας γραμμής (1-based, όπως στην οθόνη)· `0` όταν η ταυτότητα δεν υπάρχει.
 * Το `0` δεν είναι έγκυρος αριθμός γραμμής σε κανένα φύλλο υπολογισμού, άρα δεν μπορεί να
 * περάσει για δεδομένο.
 */
export function tableRowNumber(model: TableModel, rowId: TableRowId): number {
  const index = indexById(model.rows).get(rowId);
  return index === undefined ? 0 : index + 1;
}

/**
 * Το κείμενο κεφαλίδας μιας στήλης — **παράγωγο**, ποτέ αποθηκευμένο.
 *
 * Διαβάζει το κελί της **πρώτης** γραμμής με `rowClass: 'header'`. Πρώτης και όχι
 * τελευταίας: σε πίνακα με δίπατη κεφαλίδα (ομάδα + υποστήλη) η πρώτη είναι εκείνη που
 * κουβαλά το νόημα της στήλης· η δεύτερη είναι συνήθως μονάδα μέτρησης.
 *
 * Κενό αλφαριθμητικό όταν δεν υπάρχει γραμμή κεφαλίδας — που είναι **φυσιολογικό**, όχι
 * σφάλμα: ένας πίνακας υπομνήματος δεν έχει κεφαλίδες. Ο καταναλωτής απλώς δεν δείχνει
 * τίποτα δίπλα στην αναφορά.
 */
export function tableColumnHeaderText(model: TableModel, colId: TableColumnId): string {
  const headerRow = model.rows.find((row) => row.rowClass === 'header');
  if (!headerRow) return '';
  // Συγχωνευμένη κεφαλίδα: το περιεχόμενο ζει στην **άγκυρα**, όχι στο καλυμμένο κελί —
  // χωρίς αυτό, μια στήλη κάτω από ομαδική κεφαλίδα θα φαινόταν ανώνυμη.
  const owner = buildMergeIndex(model).ownerByCell.get(cellKey(headerRow.id, colId));
  const direct = cellText(getCell(model, headerRow.id, colId));
  if (direct || !owner) return direct;
  return cellText(model.cells.get(owner));
}

/**
 * Η πλήρης ονομασία ενός κελιού. `null` όταν η ταυτότητα δεν υπάρχει στο μοντέλο —
 * μπαγιάτικος δρομέας, και ο καλών οφείλει να μη δείξει τίποτα αντί να μαντέψει.
 */
export function tableCellReference(
  model: TableModel,
  rowId: TableRowId,
  colId: TableColumnId,
): TableCellReference | null {
  const letter = tableColumnLetter(model, colId);
  const number = tableRowNumber(model, rowId);
  if (!letter || number === 0) return null;

  const anchorA1 = `${letter}${number}`;
  return {
    a1: mergedRangeA1(model, rowId, colId) ?? anchorA1,
    anchorA1,
    columnHeader: tableColumnHeaderText(model, colId),
  };
}

/**
 * Το εύρος `'B3:C4'` όταν αυτό το κελί είναι **άγκυρα συγχώνευσης**· `null` αλλιώς.
 *
 * Δεν ρωτά «είμαι καλυμμένος;»: ο δρομέας κάθεται **πάντα** στην άγκυρα
 * (`anchorIndexAt` του `table-cell-navigation`), οπότε η άλλη περίπτωση δεν φτάνει εδώ.
 * Αν κάποτε φτάσει, η απάντηση `null` δίνει σκέτη αναφορά — υποβαθμισμένη, όχι λάθος.
 */
function mergedRangeA1(model: TableModel, rowId: TableRowId, colId: TableColumnId): string | null {
  const span = buildMergeIndex(model).anchors.get(cellKey(rowId, colId));
  if (!span) return null;
  const rowIndex = indexById(model.rows).get(rowId);
  const colIndex = indexById(model.columns).get(colId);
  if (rowIndex === undefined || colIndex === undefined) return null;
  // Περικοπή στα όρια του πλέγματος: μια συγχώνευση μπορεί να δηλώνει περισσότερες γραμμές
  // απ' όσες απέμειναν μετά από διαγραφή — ίδια συντηρητική στάση με το `buildMergeIndex`.
  const lastRow = Math.min(rowIndex + span.rowSpan, model.rows.length) - 1;
  const lastCol = Math.min(colIndex + span.colSpan, model.columns.length) - 1;
  const start = `${columnLetter(colIndex)}${rowIndex + 1}`;
  const end = `${columnLetter(lastCol)}${lastRow + 1}`;
  return start === end ? null : `${start}${RANGE_SEPARATOR}${end}`;
}

/**
 * Η θέση ενός κελιού ως **ζεύγος ταυτοτήτων** — ό,τι χρειάζεται μια ονομασία, τίποτα άλλο.
 *
 * ADR-754 Γ1 — **μετακόμισε** στο `table-cell-order.ts` και επανεξάγεται εδώ αμετάβλητη. Το
 * επιχείρημα που τη γέννησε («όποιος ονομάζει κελιά δεν έχει λόγο να ξέρει τι είναι δρομέας
 * ή τύπος») ισχύει **ακόμη πιο δυνατά** ένα επίπεδο πιο κάτω, εκεί όπου ζει και η μετάφραση
 * ταυτότητας σε δείκτη ({@link cellPairIndices}) που τη χρησιμοποιεί.
 */
export type { TableCellAddress } from './table-cell-order';

/**
 * Η ονομασία του **ορθογωνίου** ανάμεσα σε δύο γωνίες: `'A1:B5'`.
 *
 * Κανονικοποιεί: σύρσιμο από κάτω-δεξιά προς πάνω-αριστερά δίνει την **ίδια** ονομασία, όπως
 * σε κάθε φύλλο υπολογισμού. Η αναφορά ονομάζει μια **περιοχή**, όχι μια χειρονομία — δύο
 * κείμενα για το ίδιο ορθογώνιο θα σήμαιναν ότι ο τύπος θυμάται προς τα πού κινήθηκε το
 * ποντίκι.
 *
 * Όταν οι δύο γωνίες είναι το ίδιο κελί επιστρέφεται **σκέτη** η αναφορά (`'A1'`), όχι
 * `'A1:A1'`: το σύρσιμο που δεν κινήθηκε είναι κλικ, και ο χρήστης δεν ζήτησε εύρος.
 *
 * `null` μόνο όταν κάποια ταυτότητα δεν υπάρχει στο μοντέλο — ίδια συντηρητική στάση με το
 * {@link tableCellReference}: καλύτερα τίποτα παρά μαντεψιά.
 */
export function tableRangeReference(
  model: TableModel,
  from: TableCellAddress,
  to: TableCellAddress,
): string | null {
  const pair = cellPairIndices(model, from, to);
  if (pair === null) return null;

  const { fromRow, toRow, fromCol, toCol } = pair;
  const start = `${columnLetter(Math.min(fromCol, toCol))}${Math.min(fromRow, toRow) + 1}`;
  const end = `${columnLetter(Math.max(fromCol, toCol))}${Math.max(fromRow, toRow) + 1}`;
  return start === end ? start : `${start}${RANGE_SEPARATOR}${end}`;
}

/**
 * Η αντίστροφη διαδρομή: `'B3'` → θέση δρομέα. `null` όταν η αναφορά δεν είναι έγκυρη ή
 * δείχνει εκτός πλέγματος.
 *
 * Ένα εύρος (`'B3:C4'`) λύνεται στην **αρχή** του: εκεί κάθεται ο δρομέας και εκεί ζει το
 * περιεχόμενο. Έτσι η διαδρομή `κελί → κείμενο → κελί` είναι κλειστή και για συγχωνευμένα,
 * που είναι η προϋπόθεση για να μπορεί η γραμμή τύπων να δεχτεί πληκτρολογημένη αναφορά.
 *
 * ⚠️ Η **πλήρης** ανάλυση ευρών (`=SUM(B2:B7)` ως σύνολο κελιών) ανήκει στον adapter του
 * Φ.Δ.11, όχι εδώ: εκεί το εύρος είναι **δεδομένο**, ενώ εδώ είναι μόνο ονομασία.
 */
export function parseTableCellReference(model: TableModel, text: string): TableCursorPosition | null {
  const head = text.trim().split(RANGE_SEPARATOR)[0];
  const match = /^([A-Za-z]+)(\d+)$/u.exec(head);
  if (!match) return null;

  const colIndex = columnIndexFromLetter(match[1]);
  const rowIndex = Number.parseInt(match[2], 10) - 1;
  if (colIndex === null || rowIndex < 0) return null;
  if (colIndex >= model.columns.length || rowIndex >= model.rows.length) return null;

  return tableCursorAt(model.rows[rowIndex].id, model.columns[colIndex].id);
}

// ──────────────────────────────────────────────────────────────────────────────
// Οι ζώνες του δείκτη (AutoCAD `TABLEINDICATOR`) — ΟΝΟΜΑΣΙΑ, όχι ζωγραφική
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Μία υποδιαίρεση ζώνης δείκτη: η ετικέτα της και το κομμάτι που καταλαμβάνει κατά μήκος
 * του άξονά της, σε **sheet-mm του πλαισίου του πίνακα**.
 *
 * Ζει εδώ και όχι στον ζωγράφο επίτηδες: ο `stamp-table-indicator.ts` έχει δηλωμένο
 * συμβόλαιο «καμία γνώση, μόνο στοίβαγμα» — αν έφτιαχνε μόνος του τα γράμματα, θα υπήρχαν
 * **δύο** απαντήσεις στο «πώς λέγεται η τρίτη στήλη»: η δική του και η δική μου. Και η
 * δεύτερη θα ήταν αυτή που καταλήγει στους τύπους.
 */
export interface TableIndicatorTick {
  readonly label: string;
  /** Αρχή κατά μήκος του άξονα της ζώνης (x για στήλες, y για γραμμές). */
  readonly startMm: number;
  readonly sizeMm: number;
  /**
   * `true` για κάθε στήλη/γραμμή που **δέχεται το πληκτρολόγιο**: του δρομέα, ή —
   * ADR-739 Φ.Δ βήμα 8 — **ολόκληρης της επιλεγμένης περιοχής**.
   *
   * ## Γιατί η περιοχή φωτίζει όλες, ενώ ο σκέτος δρομέας σε συγχώνευση φωτίζει μία
   * Σε **συγχωνευμένο** κελί χωρίς επιλογή φωτίζεται μόνο η στήλη/γραμμή της **άγκυρας**:
   * ο δρομέας κάθεται πάντα εκεί, και το εύρος το λέει **ήδη ρητά** η αναφορά της γραμμής
   * τύπων (`B3:C4`) — φωτίζοντας και τις καλυμμένες θα λέγαμε δύο φορές το ίδιο, με το
   * ρίσκο να διαφωνήσουν.
   *
   * Με **επιλογή περιοχής** το επιχείρημα αντιστρέφεται: η γραμμή τύπων μένει στο ενεργό
   * κελί (τεκμηριωμένη απόφαση §4.2 — είναι πεδίο **γραφής**, και η απάντηση στο «ποιο
   * αλλάζει;» πρέπει να είναι πάντα σαφής). Άρα οι ζώνες είναι το **μόνο** μέρος που
   * μπορεί να πει «ως εδώ», και οφείλουν να το πουν ολόκληρο.
   */
  readonly active: boolean;

  /**
   * 🔴 ADR-739 §30 — `true` για τη **μία** υποδιαίρεση που βρίσκεται κάτω από το ποντίκι.
   *
   * ## Γιατί είναι ΞΕΧΩΡΙΣΤΟ πεδίο και δεν γίνεται `active`
   * Οι δύο σημασίες δεν είναι εναλλακτικές του ίδιου πράγματος: το `active` απαντά «**πού
   * πάει το πλήκτρο**», το `hovered` απαντά «**τι θα πάθει αν πατήσω**». Συνυπάρχουν
   * κανονικά (hover πάνω στην ήδη ενεργή στήλη) και ο ζωγράφος τις δείχνει **σωρευτικά** —
   * γέμισμα από το `active`, πλύσιμο από το `hovered`. Μια ενιαία «κατάσταση» με
   * προτεραιότητα θα υποχρέωνε τη μία να κρύψει την άλλη, και θα έκανε το feedback του
   * ποντικιού να **εξαφανίζεται** ακριβώς εκεί που ο χρήστης δουλεύει.
   *
   * ## Γιατί το γεννά ο ίδιος ΕΝΑΣ παραγωγός με το `active`
   * Η εναλλακτική ήταν να διαβάζει ο ζωγράφος το store του hover μόνος του. Τότε θα υπήρχαν
   * **δύο** αναγνώσεις κατάστασης μέσα στο ίδιο καρέ (μία εδώ, μία εκεί) και δύο ευκαιρίες
   * να διαφωνήσουν για το ποια είναι η τρίτη στήλη. Ίδια αρχή με την ονομασία: μία ερώτηση,
   * μία απάντηση, ο ζωγράφος **δεν κρίνει**.
   */
  readonly hovered: boolean;
}

/**
 * Οι υποδιαιρέσεις της **πάνω** ζώνης: `A`, `B`, `C`… Όλες οι στήλες, πάντα — ένας πίνακας
 * έχει δεκάδες στήλες στη χειρότερη περίπτωση, ποτέ χιλιάδες (σε αντίθεση με τις γραμμές).
 *
 * ADR-739 Φ.Δ βήμα 8 — το `activeColIds` είναι **σύνολο** και όχι μία ταυτότητα, ώστε μια
 * επιλεγμένη περιοχή να ανάβει ολόκληρη. Χωρίς επιλογή ο καλών περνά μονοσύνολο: η ίδια
 * συνάρτηση, καμία ειδική περίπτωση, καμία δεύτερη διαδρομή ζωγραφικής.
 *
 * ADR-739 §30 — το `hoveredColId` είναι αντίθετα **μία ταυτότητα ή καμία**, και αυτό είναι
 * σημασιολογία, όχι ασυνέπεια: το ποντίκι είναι ένα, άρα η υποδιαίρεση κάτω από αυτό είναι
 * το πολύ μία. Ένα σύνολο εδώ θα επέτρεπε να εκφραστεί κατάσταση που δεν μπορεί να συμβεί.
 * Παραλείπεται νόμιμα (`null`): «καμία λωρίδα κάτω από το ποντίκι» είναι η **κανονική**
 * κατάσταση κάθε καρέ, όχι σιωπηλή προεπιλογή που μπορεί να είναι λάθος.
 */
export function tableColumnTicks(
  columns: readonly TableColumnLayout[],
  activeColIds: ReadonlySet<TableColumnId>,
  hoveredColId: TableColumnId | null = null,
): readonly TableIndicatorTick[] {
  return columns.map((column, index) => ({
    label: columnLetter(index),
    startMm: column.xMm,
    sizeMm: column.widthMm,
    active: activeColIds.has(column.id),
    hovered: column.id === hoveredColId,
  }));
}

/**
 * Οι υποδιαιρέσεις της **αριστερής** ζώνης: `1`, `2`, `3`…
 *
 * Δέχεται το **ορατό** παράθυρο (`from`/`to`, δείκτες στο πλήρες `rows`) γιατί οι γραμμές
 * μπορεί να είναι 500 και ο ζωγράφος ζωγραφίζει ήδη μόνο όσες φαίνονται — το μάθημα του
 * ADR-735. Ο **αριθμός** όμως παραμένει ο απόλυτος: η γραμμή 300 λέγεται `300` και όταν
 * είναι η πρώτη ορατή.
 */
export function tableRowTicks(
  rows: readonly TableRowLayout[],
  activeRowIds: ReadonlySet<TableRowId>,
  from: number,
  to: number,
  hoveredRowId: TableRowId | null = null,
): readonly TableIndicatorTick[] {
  const ticks: TableIndicatorTick[] = [];
  for (let i = Math.max(from, 0); i < Math.min(to, rows.length); i++) {
    const row = rows[i];
    ticks.push({
      label: String(i + 1),
      startMm: row.yMm,
      sizeMm: row.heightMm,
      active: activeRowIds.has(row.id),
      // §30 — η γραμμή κάτω από το ποντίκι. Συμμετρικά με τις στήλες· δες εκείνη.
      hovered: row.id === hoveredRowId,
    });
  }
  return ticks;
}
