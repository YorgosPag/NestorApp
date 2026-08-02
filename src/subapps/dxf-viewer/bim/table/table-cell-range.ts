/**
 * ADR-739 Φ.Δ βήμα 8 — **η επιλογή περιοχής κελιών**. Καθαρή συνάρτηση, μηδέν React/DOM.
 *
 * Αδελφό του `table-cell-navigation.ts`, και για τον ίδιο λόγο: την **ίδια** ερώτηση («ποια
 * κελιά είναι μαρκαρισμένα;») θα την κάνουν ο ζωγράφος του καμβά, οι ζώνες `A B C`, η
 * αντιγραφή σε TSV, η επικόλληση, η γραμμή κατάστασης και — αργότερα — η λαβή συμπλήρωσης
 * (Φ.Δ.9) και οι τύποι (Φ.Δ.11). Μία απάντηση, δοκιμασμένη χωρίς DOM.
 *
 * ## 🔴 Η ΕΠΙΛΟΓΗ ΔΕΝ ΕΙΝΑΙ ΤΕΤΑΡΤΗ ΚΑΤΑΣΤΑΣΗ ΔΡΟΜΕΑ — ΕΙΝΑΙ ΕΚΤΑΣΗ
 * Ο πειρασμός είναι ένα `mode: 'select'` δίπλα στα `nav`/`enter`/`edit`. Το βήμα 4 απέρριψε
 * ήδη τέταρτη κατάσταση με το ίδιο επιχείρημα, και ισχύει αυτούσιο: ο δρομέας εξακολουθεί
 * να κάθεται σε **ένα** κελί (το **ενεργό**) και να δέχεται πληκτρολόγηση. Η περιοχή είναι
 * ένα **προαιρετικό δεύτερο άκρο** πάνω στην υπάρχουσα θέση.
 *
 * ## Γιατί ξεχωριστό πεδίο στο store και ΟΧΙ μέσα στο `TableCursorPosition`
 * Το {@link TableCursorPosition} είναι **καθαρή θέση**: το παράγουν το `tableCursorAt`, το
 * `tableFirstCursorPosition`, το `moveTableCursor` και το `parseTableCellReference` (μια
 * πληκτρολογημένη αναφορά `B3` στη γραμμή τύπων). Το τελευταίο δεν έχει **καμία** σχέση με
 * επιλογή· αν η έκταση ζούσε εκεί, κάθε παραγωγός θέσης θα υποχρεωνόταν να αποφασίσει γι'
 * αυτήν, και τρεις από τους τέσσερις θα έγραφαν `undefined` για λόγους τυπικούς. Το
 * `anchorColId` που **ήδη** ταξιδεύει εκεί είναι άλλο πράγμα: είναι ιδιότητα **της κίνησης**
 * (πού επιστρέφει το `Enter`), όχι δεύτερο σημείο του πλέγματος.
 *
 * ⚠️ **ΟΡΟΛΟΓΙΑ — ομώνυμα, όχι συνώνυμα.** Σε αυτό το αρχείο η λέξη «άγκυρα» σημαίνει
 * **πάντα** άγκυρα **συγχώνευσης** (`CellSpan.anchorRowId`), ποτέ «η μία άκρη της
 * επιλογής». Η άκρη λέγεται **ενεργό κελί** (Excel: *active cell*) και **τέλος περιοχής**.
 * Το `anchorIndexAt` του `table-cell-navigation` είναι το πρώτο, όχι το δεύτερο — και
 * ακριβώς γι' αυτό δεν επαναχρησιμοποιείται εδώ ως «anchor» της επιλογής.
 *
 * ## Τι κάνουν οι μεγάλοι (ερευνήθηκε 2026-08-01, ADR-739 §26)
 * - **AutoCAD `ACAD_TABLE`**: ασυνεχής επιλογή κελιών **δεν υπάρχει** (νήμα CADTutor: η
 *   απάντηση ήταν «μόνο με προγραμματισμό»). Ένα ορθογώνιο, τίποτα άλλο.
 * - **Excel**: η ασυνεχής επιλογή υπάρχει αλλά **δεν αντιγράφεται** — `Ctrl+C` απαντά
 *   «*That command cannot be used on multiple selections*» εκτός αν οι περιοχές
 *   ευθυγραμμίζονται σε κοινές γραμμές/στήλες.
 * ⇒ Το σχήμα των δεδομένων είναι **δύο κελιά**, όχι λίστα περιοχών. Απλούστερο **και** πιο
 *   σωστό — μια δομή που δεν μπορεί καν να εκφράσει την ασυνεχή επιλογή δεν μπορεί ούτε να
 *   την αφήσει να διαρρεύσει σε αντιγραφή που δεν την υποστηρίζει.
 *
 * @module subapps/dxf-viewer/bim/table/table-cell-range
 * @see bim/table/table-cell-navigation.ts — η κίνηση ενός κελιού (επαναχρησιμοποιείται εδώ)
 * @see bim/table/table-model-helpers.ts — `buildMergeIndex`, η ΜΙΑ γνώση συγχωνεύσεων
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §26
 */

import type { TableColumnId, TableModel, TableRowId } from '../../types/table';
import { buildMergeIndex, indexById } from './table-model-helpers';
import { moveTableCursor, type TableCursorMove } from './table-cell-navigation';
import type { TableLayout, TableRectMm } from './table-layout-types';

/** Ένα κελί, μόνο ως ταυτότητα — χωρίς κατάσταση δρομέα, χωρίς στήλη αγκύρωσης κίνησης. */
export interface TableCellRef {
  readonly rowId: TableRowId;
  readonly colId: TableColumnId;
}

/**
 * Η επιλεγμένη περιοχή σε **δείκτες** του μοντέλου, **κλειστό** διάστημα και στα δύο άκρα
 * (`firstRow ≤ lastRow`, `firstCol ≤ lastCol`).
 *
 * Δείκτες και όχι ταυτότητες γιατί η έννοια «ορθογώνιο» **είναι** γεωμετρία θέσης: με
 * ταυτότητες, κάθε ερώτηση «είναι αυτό μέσα;» θα ήταν μια αναζήτηση. Οι ταυτότητες
 * επιστρέφονται από το {@link tableRangeMembership} για όποιον τις χρειάζεται.
 */
export interface TableCellRangeBounds {
  readonly firstRow: number;
  readonly lastRow: number;
  readonly firstCol: number;
  readonly lastCol: number;
}

/** Πόσο μεγάλη είναι — αυτό που δείχνει η **γραμμή κατάστασης** (§4.2). */
export interface TableRangeSize {
  readonly rows: number;
  readonly columns: number;
}

/**
 * Ιδιότητα μέλους ανά **άξονα**, όχι ανά κελί.
 *
 * ## Γιατί δύο σύνολα και όχι ένα σύνολο κλειδιών κελιού — ADR-735
 * Ένα `Set<CellKey>` για επιλογή 500 × 20 είναι **10.000 κλειδιά, χτισμένα ανά καρέ**. Είναι
 * κυριολεκτικά το σχήμα O(εμβαδόν) που ο ADR-735 πλήρωσε σε παραγωγή. Ένα ορθογώνιο όμως
 * είναι **γινόμενο** δύο διαστημάτων: «το κελί είναι μέσα» ⇔ «η γραμμή του είναι μέσα **και**
 * η στήλη του είναι μέσα». Άρα δύο σύνολα μεγέθους `γραμμές + στήλες` απαντούν **ακριβώς**
 * την ίδια ερώτηση σε O(1), με O(περίμετρος) κόστος κατασκευής.
 *
 * Δώρο: αυτά ακριβώς τα δύο σύνολα χρειάζονται και οι ζώνες `A B C` / `1 2 3` για να ανάψουν
 * ολόκληρη την περιοχή — μία δομή, δύο καταναλωτές, καμία δεύτερη απάντηση.
 */
export interface TableRangeMembership {
  readonly rowIds: ReadonlySet<TableRowId>;
  readonly colIds: ReadonlySet<TableColumnId>;
}

/** Το ορθογώνιο που καταλαμβάνει μια συγχώνευση, σε δείκτες — ή `null` αν είναι άκυρη. */
function mergeBoundsOf(
  model: TableModel,
  rowIndex: ReadonlyMap<string, number>,
  colIndex: ReadonlyMap<string, number>,
  span: { anchorRowId: string; anchorColId: string; rowSpan: number; colSpan: number },
): TableCellRangeBounds | null {
  const r0 = rowIndex.get(span.anchorRowId);
  const c0 = colIndex.get(span.anchorColId);
  if (r0 === undefined || c0 === undefined) return null;
  if (span.rowSpan < 1 || span.colSpan < 1) return null;
  return {
    firstRow: r0,
    lastRow: Math.min(r0 + span.rowSpan, model.rows.length) - 1,
    firstCol: c0,
    lastCol: Math.min(c0 + span.colSpan, model.columns.length) - 1,
  };
}

/** Τέμνονται δύο ορθογώνια (κλειστά διαστήματα); */
function intersects(a: TableCellRangeBounds, b: TableCellRangeBounds): boolean {
  return (
    a.firstRow <= b.lastRow &&
    b.firstRow <= a.lastRow &&
    a.firstCol <= b.lastCol &&
    b.firstCol <= a.lastCol
  );
}

/** Το μικρότερο ορθογώνιο που περιέχει και τα δύο. */
function union(a: TableCellRangeBounds, b: TableCellRangeBounds): TableCellRangeBounds {
  return {
    firstRow: Math.min(a.firstRow, b.firstRow),
    lastRow: Math.max(a.lastRow, b.lastRow),
    firstCol: Math.min(a.firstCol, b.firstCol),
    lastCol: Math.max(a.lastCol, b.lastCol),
  };
}

function sameBounds(a: TableCellRangeBounds, b: TableCellRangeBounds): boolean {
  return (
    a.firstRow === b.firstRow &&
    a.lastRow === b.lastRow &&
    a.firstCol === b.firstCol &&
    a.lastCol === b.lastCol
  );
}

/**
 * 🔴 **Το «κούμπωμα» στις συγχωνεύσεις** — ο κανόνας που κάνει την επιλογή να έχει νόημα.
 *
 * Μια ορθογώνια περιοχή που **κόβει** μια συγχώνευση στη μέση είναι ανερμήνευτη: το
 * περιεχόμενο ζει στην άγκυρα, οπότε «τα μισά ενός κελιού» δεν αντιγράφονται, δεν
 * σβήνονται και δεν γεμίζουν. Το Excel μεγαλώνει την επιλογή ώστε να **περικλείει
 * ολόκληρες** τις συγχωνεύσεις που αγγίζει (επιβεβαιώθηκε: επιλογή της γραμμής 5 σε φύλλο
 * με συγχώνευση `A1:A10` γίνεται `1:10`).
 *
 * Ο βρόχος **τερματίζει πάντα**: κάθε επανάληψη ή μεγαλώνει γνήσια το ορθογώνιο (και το
 * ορθογώνιο είναι φραγμένο από το πλέγμα) ή σταματά. Χειρότερη περίπτωση: όσες οι
 * συγχωνεύσεις.
 *
 * ⚠️ Καμία **δεύτερη** λογική συγχωνεύσεων δεν γεννιέται εδώ: το ορθογώνιο κάθε span το
 * δίνει το ίδιο `model.merges` που διαβάζει το {@link buildMergeIndex}, με την ίδια
 * περικοπή στα όρια του πλέγματος και την ίδια ανοχή σε άκυρα spans.
 */
function snapToWholeMerges(model: TableModel, start: TableCellRangeBounds): TableCellRangeBounds {
  if (model.merges.length === 0) return start;
  const rowIndex = indexById(model.rows);
  const colIndex = indexById(model.columns);

  let bounds = start;
  for (;;) {
    let grown = bounds;
    for (const span of model.merges) {
      const spanBounds = mergeBoundsOf(model, rowIndex, colIndex, span);
      if (spanBounds && intersects(grown, spanBounds)) grown = union(grown, spanBounds);
    }
    if (sameBounds(grown, bounds)) return bounds;
    bounds = grown;
  }
}

/**
 * Η περιοχή ανάμεσα σε δύο κελιά — **κανονικοποιημένη** (η σειρά των δύο άκρων δεν
 * μετράει) και **κουμπωμένη** σε ολόκληρες συγχωνεύσεις.
 *
 * `null` όταν κάποιο από τα δύο άκρα δεν υπάρχει στο μοντέλο: μπαγιάτικη επιλογή μετά από
 * undo ή διαγραφή γραμμής. Ο καλών οφείλει να τη σβήσει, όχι να μαντέψει — ίδια σύμβαση
 * με το `moveTableCursor`.
 */
export function resolveTableCellRange(
  model: TableModel,
  activeCell: TableCellRef,
  rangeEnd: TableCellRef,
): TableCellRangeBounds | null {
  const rowIndex = indexById(model.rows);
  const colIndex = indexById(model.columns);
  const r0 = rowIndex.get(activeCell.rowId);
  const c0 = colIndex.get(activeCell.colId);
  const r1 = rowIndex.get(rangeEnd.rowId);
  const c1 = colIndex.get(rangeEnd.colId);
  if (r0 === undefined || c0 === undefined || r1 === undefined || c1 === undefined) return null;

  return snapToWholeMerges(model, {
    firstRow: Math.min(r0, r1),
    lastRow: Math.max(r0, r1),
    firstCol: Math.min(c0, c1),
    lastCol: Math.max(c0, c1),
  });
}

/**
 * `Ctrl+A` — ολόκληρο το πλέγμα. `null` για πίνακα χωρίς γραμμές ή χωρίς στήλες.
 *
 * Δεν περνά από το {@link snapToWholeMerges}: όλες οι συγχωνεύσεις είναι ήδη μέσα, εξ
 * ορισμού. Η κλήση θα ήταν ταυτοτική και θα κόστιζε μια σάρωση.
 */
export function tableWholeGridRange(model: TableModel): TableCellRangeBounds | null {
  if (model.rows.length === 0 || model.columns.length === 0) return null;
  return {
    firstRow: 0,
    lastRow: model.rows.length - 1,
    firstCol: 0,
    lastCol: model.columns.length - 1,
  };
}

/** Πόσες γραμμές × πόσες στήλες — για τη γραμμή κατάστασης (§4.2). */
export function tableRangeSize(bounds: TableCellRangeBounds): TableRangeSize {
  return {
    rows: bounds.lastRow - bounds.firstRow + 1,
    columns: bounds.lastCol - bounds.firstCol + 1,
  };
}

/** Είναι η περιοχή ένα και μόνο κελί; Τότε **δεν** είναι πραγματική επιλογή (§4.2). */
export function isSingleCellRange(bounds: TableCellRangeBounds): boolean {
  return bounds.firstRow === bounds.lastRow && bounds.firstCol === bounds.lastCol;
}

/** Οι ταυτότητες των γραμμών και των στηλών της περιοχής — δες {@link TableRangeMembership}. */
export function tableRangeMembership(
  model: TableModel,
  bounds: TableCellRangeBounds,
): TableRangeMembership {
  const rowIds = new Set<TableRowId>();
  const colIds = new Set<TableColumnId>();
  for (let r = Math.max(bounds.firstRow, 0); r <= Math.min(bounds.lastRow, model.rows.length - 1); r++) {
    rowIds.add(model.rows[r].id);
  }
  for (let c = Math.max(bounds.firstCol, 0); c <= Math.min(bounds.lastCol, model.columns.length - 1); c++) {
    colIds.add(model.columns[c].id);
  }
  return { rowIds, colIds };
}

/**
 * Οι ταυτότητες κάθε κελιού της περιοχής, σε σειρά **γραμμή × στήλη** — η ίδια σειρά που
 * εγγυάται το `toPersistedTableModel`, ώστε η αντιγραφή σε TSV να είναι ντετερμινιστική.
 *
 * ⚠️ Επιστρέφει **και τα καλυμμένα** κελιά μιας συγχώνευσης, όχι μόνο τις άγκυρες. Δεν είναι
 * παράλειψη: το TSV είναι **ορθογώνιο πλέγμα**, και μια συγχώνευση 1×3 πρέπει να δώσει το
 * κείμενό της στην πρώτη στήλη και **κενά** στις άλλες δύο — αλλιώς οι επόμενες στήλες
 * ολισθαίνουν αριστερά και ο πίνακας που επικολλάται στο Excel βγαίνει στραβός. Το κενό
 * έρχεται δωρεάν: το `cells` είναι **αραιό** και μόνο η άγκυρα κρατά εγγραφή, οπότε το
 * `getPersistedCellText` ενός καλυμμένου κελιού επιστρέφει ήδη κενό αλφαριθμητικό.
 */
export function tableRangeCellRefs(
  model: TableModel,
  bounds: TableCellRangeBounds,
): readonly TableCellRef[] {
  const refs: TableCellRef[] = [];
  const lastRow = Math.min(bounds.lastRow, model.rows.length - 1);
  const lastCol = Math.min(bounds.lastCol, model.columns.length - 1);
  for (let r = Math.max(bounds.firstRow, 0); r <= lastRow; r++) {
    for (let c = Math.max(bounds.firstCol, 0); c <= lastCol; c++) {
      refs.push({ rowId: model.rows[r].id, colId: model.columns[c].id });
    }
  }
  return refs;
}

/**
 * Το ορθογώνιο της περιοχής σε **sheet-mm του πλαισίου** — ό,τι χρειάζεται ο ζωγράφος.
 *
 * ## Γιατί ΕΝΑ ορθογώνιο και όχι λίστα κελιών
 * Η περιοχή είναι ορθογώνια εξ ορισμού (και κουμπωμένη σε ολόκληρες συγχωνεύσεις), οπότε
 * τα άκρα της αρκούν: αριστερή ακμή της πρώτης στήλης → δεξιά ακμή της τελευταίας, πάνω
 * ακμή της πρώτης γραμμής → κάτω ακμή της τελευταίας. Μια λίστα κελιών θα έδινε στον
 * ζωγράφο O(εμβαδόν) δουλειά ανά καρέ για την **ίδια** εικόνα (ADR-735).
 *
 * ⚠️ Δέχεται τη **διάταξη** και όχι το μοντέλο: μόνο εκείνη ξέρει πλάτη και ύψη. Οι δείκτες
 * είναι κοινοί — η διάταξη κρατά μία εγγραφή ανά γραμμή/στήλη του μοντέλου, στην ίδια σειρά
 * (το ίδιο βασίζει ήδη το `tableColumnTicks` για να παράγει `A`, `B`, `C`…).
 *
 * `null` όταν τα όρια δεν τέμνουν τη διάταξη — άδειος πίνακας ή μπαγιάτικη επιλογή.
 */
export function tableRangeRectMm(
  layout: TableLayout,
  bounds: TableCellRangeBounds,
): TableRectMm | null {
  const firstCol = layout.columns[Math.max(bounds.firstCol, 0)];
  const lastCol = layout.columns[Math.min(bounds.lastCol, layout.columns.length - 1)];
  const firstRow = layout.rows[Math.max(bounds.firstRow, 0)];
  const lastRow = layout.rows[Math.min(bounds.lastRow, layout.rows.length - 1)];
  if (!firstCol || !lastCol || !firstRow || !lastRow) return null;
  return {
    x: firstCol.xMm,
    y: firstRow.yMm,
    w: lastCol.xMm + lastCol.widthMm - firstCol.xMm,
    h: lastRow.yMm + lastRow.heightMm - firstRow.yMm,
  };
}

/**
 * `Shift + βέλος` — μετακινεί **το τέλος** της περιοχής κατά ένα βήμα· το **ενεργό κελί**
 * μένει ακίνητο (Excel).
 *
 * 🔴 **Μηδέν νέα λογική πλοήγησης**: δανείζεται αυτούσιο το {@link moveTableCursor}. Έτσι ο
 * κανόνας «άλλαξε ο ιδιοκτήτης» — που λύνει τις συγχωνεύσεις — ισχύει αυτούσιος και για την
 * επέκταση, χωρίς να ξαναγραφτεί ούτε μία γραμμή. Ένα δεύτερο `stepOut` εδώ θα ήταν ακριβώς
 * ο structural clone που πιάνει το CHECK 3.28.
 *
 * ## ⚠️ Η στήλη αγκύρωσης της συνθετικής θέσης είναι ΑΔΙΑΦΟΡΗ — και είναι μετρημένο
 * Το `TableCursorPosition` απαιτεί `anchorColId`, αλλά **καμία** από τις κινήσεις που
 * φτάνουν εδώ δεν τη διαβάζει: την καταναλώνει μόνο το `commitVertically`, δηλαδή τα
 * `commitDown`/`commitUp` — και αυτά αντιστοιχούν στο `Enter`/`Shift+Enter`, που το
 * {@link resolveTableCellKeyIntent} χαρτογραφεί ρητά σε **κίνηση**, ποτέ σε επέκταση
 * (`Shift+Enter` = `commitUp`, όχι `extend`). Οι επεκτάσιμες κινήσεις είναι τα βέλη και τα
 * `Home`/`End`, που περνούν από `stepOut`/`rowEdge` χωρίς να την αγγίξουν.
 *
 * Ο έλεγχος μεταλλάξεων το επιβεβαίωσε: αλλοιώνοντας αυτό το πεδίο, **κανένα** test δεν
 * κοκκινίζει — ισοδύναμη μετάλλαξη. Γράφεται `rangeEnd.colId` επειδή είναι η μόνη τιμή που
 * **σημαίνει** κάτι («η στήλη όπου βρίσκομαι»), όχι επειδή την χρειάζεται κάποιος. Αν
 * κάποτε μια κάθετη-με-αγκύρωση κίνηση γίνει επεκτάσιμη, αυτή η γραμμή παύει να είναι
 * αδιάφορη — και το test «οι επεκτάσιμες κινήσεις δεν διαβάζουν αγκύρωση» θα το πει.
 *
 * `null` στην άκρη του πλέγματος ⇒ το τέλος μένει όπου είναι (ποτέ αναδίπλωση).
 */
export function extendTableCellRangeEnd(
  model: TableModel,
  rangeEnd: TableCellRef,
  move: TableCursorMove,
): TableCellRef | null {
  const next = moveTableCursor(
    model,
    { rowId: rangeEnd.rowId, colId: rangeEnd.colId, anchorColId: rangeEnd.colId },
    move,
  );
  return next ? { rowId: next.rowId, colId: next.colId } : null;
}
