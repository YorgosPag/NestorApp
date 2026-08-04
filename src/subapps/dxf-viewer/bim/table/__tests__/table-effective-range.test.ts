/**
 * 🔑 **Η ΜΙΑ ΑΠΑΝΤΗΣΗ «ποια περιοχή εννοεί ο χρήστης τώρα;»** — η επιλογή· χωρίς επιλογή, το
 * ενεργό κελί.
 *
 * Η σουίτα μετακόμισε από το `table-fill-handle.test.ts` μαζί με τη συνάρτηση (ADR-739 §36.9),
 * όταν εκείνη απέκτησε **τέταρτο** καταναλωτή που δεν αφορά λαβή: τη **μετακίνηση
 * περιγράμματος**. Μετακόμιση, όχι αντιγραφή — δύο σουίτες για την ίδια συνάρτηση θα ήταν δύο
 * προδιαγραφές που αποκλίνουν.
 *
 * ⚠️ **Πλέγμα 5×5**, όπως κάθε test αυτού του ADR (§1.2).
 */

import { createTableModel } from '../table-model-helpers';
import type { TableColumn, TableRow } from '../../../types/table';
import { tableEffectiveRangeBounds } from '../table-effective-range';
import { tableRangeRectMm, type TableCellRangeBounds } from '../table-cell-range';
import type { TableLayout } from '../table-layout-types';

const COLUMNS: TableColumn[] = ['c1', 'c2', 'c3', 'c4', 'c5'].map((id) => ({
  id,
  sizing: { kind: 'fixed', widthMm: 20 },
  valueType: 'number',
  align: 'right',
}));

const ROWS: TableRow[] = ['r1', 'r2', 'r3', 'r4', 'r5'].map((id) => ({
  id,
  rowClass: 'data',
  heightMm: 8,
}));

const LAYOUT: TableLayout = {
  widthMm: 100,
  heightMm: 40,
  columns: COLUMNS.map((column, i) => ({ id: column.id, xMm: i * 20, widthMm: 20 })),
  rows: ROWS.map((row, i) => ({ id: row.id, yMm: i * 8, heightMm: 8 })),
  cells: [],
  borders: [],
};

const MODEL = createTableModel({ columns: COLUMNS, rows: ROWS, cells: [] });

/**
 * Ο πίνακας **της σκηνής**: η γραμμή τίτλου είναι συγχωνευμένη σε όλες τις στήλες. Δεν είναι
 * ακραίο fixture — είναι το σχήμα που το ADR-739 §27.15 κατέγραψε ως τον πραγματικό πίνακα.
 */
const MERGED = createTableModel({
  columns: COLUMNS,
  rows: ROWS,
  cells: [],
  merges: [{ anchorRowId: 'r1', anchorColId: 'c1', rowSpan: 1, colSpan: 5 }],
});

const cellRef = (row: number, col: number) => ({ rowId: ROWS[row].id, colId: COLUMNS[col].id });
const rect = (firstRow: number, lastRow: number, firstCol: number, lastCol: number) =>
  ({ firstRow, lastRow, firstCol, lastCol }) as TableCellRangeBounds;

describe('🔑 tableEffectiveRangeBounds — μία απάντηση για ζωγράφο, πάτημα, δείκτη ΚΑΙ μετακίνηση', () => {
  it('με επιλογή ⇒ τα όρια της επιλογής, αυτούσια', () => {
    const selection = rect(1, 2, 1, 3);
    expect(tableEffectiveRangeBounds(MODEL, cellRef(0, 0), selection)).toBe(selection);
  });

  it('χωρίς επιλογή ⇒ το ενεργό κελί, ως περιοχή 1×1', () => {
    expect(tableEffectiveRangeBounds(MODEL, cellRef(2, 3), null)).toEqual(rect(2, 2, 3, 3));
  });

  /**
   * 🔴 **Η ΑΠΟΚΛΙΣΗ ΠΟΥ ΕΚΛΕΙΣΕ.** Πριν την κεντρικοποίηση, ο ζωγράφος έπεφτε στο ενεργό κελί
   * όταν η επιλογή δεν λυνόταν (undo / διαγραμμένη γραμμή), ενώ ο φρουρός του πατήματος
   * επέστρεφε `null` — δηλαδή **λαβή που φαίνεται και δεν πιάνεται**, η ακριβής αστοχία που το
   * ADR-754 §13.5 απαγορεύει ονομαστικά. Νικά ο ζωγράφος: επιλογή που δεν λύνεται **είναι**
   * καμία επιλογή, ενώ το ενεργό κελί υπάρχει πάντα.
   */
  it('🔴 ΜΠΑΓΙΑΤΙΚΗ επιλογή (άλυτη ⇒ `null`) ⇒ πέφτει στο ενεργό κελί, ΔΕΝ σιωπά', () => {
    expect(tableEffectiveRangeBounds(MODEL, cellRef(4, 4), null)).toEqual(rect(4, 4, 4, 4));
  });

  it('ενεργό κελί που δεν υπάρχει πια στο μοντέλο ⇒ null (κανείς δεν μαντεύει)', () => {
    expect(tableEffectiveRangeBounds(MODEL, { rowId: 'φάντασμα', colId: 'c1' }, null)).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 🔴 ADR-739 §36.9 — ΤΟ ΚΟΥΜΠΩΜΑ ΤΟΥ ΕΝΕΡΓΟΥ ΚΕΛΙΟΥ ΣΕ ΣΥΓΧΩΝΕΥΣΗ
// ──────────────────────────────────────────────────────────────────────────────

describe('🔴 §36.9 ΣΥΓΧΩΝΕΥΣΗ — το ορθογώνιο είναι ΑΥΤΟ ΠΟΥ ΒΛΕΠΕΙ Ο ΧΡΗΣΤΗΣ', () => {
  /**
   * 🔴🔴 **ΤΟ ΕΛΑΤΤΩΜΑ ΠΟΥ ΒΡΗΚΕ Η ΜΕΤΡΗΣΗ.** Εδώ επέστρεφε `rect(0,0,0,0)` — δηλαδή **1×5
   * μικρότερο** από το κελί που ζωγραφίζεται. Το `TableCellLayout.rect` (και άρα το
   * `activeCellRectOf` του §41) «*καλύπτει ολόκληρο το εύρος της συγχώνευσης όταν το κελί είναι
   * άγκυρα*»: 100×8 mm. Αυτή εδώ έλεγε 20×8 mm.
   *
   * Ορατή συνέπεια **πριν** τη διόρθωση: η λαβή συμπλήρωσης ζωγραφιζόταν στο **1/5** του
   * πλάτους, μέσα στο κελί — και το περίγραμμα που πιάνεται θα έπεφτε πάνω σε γραμμή που δεν
   * ζωγραφίζεται πουθενά.
   */
  it('🔴 ενεργό κελί = άγκυρα συγχώνευσης ⇒ ΟΛΟΚΛΗΡΗ η συγχώνευση, όχι 1×1', () => {
    expect(tableEffectiveRangeBounds(MERGED, cellRef(0, 0), null)).toEqual(rect(0, 0, 0, 4));
  });

  it('🔑 και σε mm: το ορθογώνιο ταυτίζεται με το ΖΩΓΡΑΦΙΣΜΕΝΟ κελί (100×8), όχι 20×8', () => {
    const bounds = tableEffectiveRangeBounds(MERGED, cellRef(0, 0), null)!;
    expect(tableRangeRectMm(LAYOUT, bounds)).toEqual({ x: 0, y: 0, w: 100, h: 8 });
  });

  /**
   * 🔑 **Ο ΙΔΙΟΣ ΚΑΝΟΝΑΣ ΚΑΙ ΣΤΟΥΣ ΔΥΟ ΚΛΑΔΟΥΣ.** Το `resolveTableSelectionBounds` κουμπώνει
   * ήδη την **επιλογή** σε ολόκληρες συγχωνεύσεις (§27.15). Χωρίς αυτό το test, ο ένας κλάδος
   * αυτής της συνάρτησης θα μπορούσε να ξαναγίνει σιωπηλά ακατέργαστος — δηλαδή δύο κανόνες
   * για την ίδια ερώτηση, που είναι ακριβώς ο λόγος ύπαρξης του module.
   */
  it('🔑 κελί ΕΚΤΟΣ συγχώνευσης μένει 1×1 — το κούμπωμα δεν είναι καθολικό', () => {
    expect(tableEffectiveRangeBounds(MERGED, cellRef(2, 2), null)).toEqual(rect(2, 2, 2, 2));
  });

  it('χωρίς καμία συγχώνευση το κούμπωμα είναι ταυτοτικό', () => {
    expect(tableEffectiveRangeBounds(MODEL, cellRef(0, 0), null)).toEqual(rect(0, 0, 0, 0));
  });
});
