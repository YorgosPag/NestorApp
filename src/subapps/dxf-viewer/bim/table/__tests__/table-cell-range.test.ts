/**
 * ADR-739 Φ.Δ βήμα 8 — **η επιλογή περιοχής κελιών** (`table-cell-range.ts`).
 *
 * Ο πυρήνας των ελέγχων είναι το **κούμπωμα στις συγχωνεύσεις**: μια περιοχή που κόβει
 * συγχώνευση στη μέση είναι ανερμήνευτη (το περιεχόμενο ζει στην άγκυρα), και ο **αληθινός**
 * πίνακας της σκηνής έχει ακριβώς τέτοια γραμμή τίτλου
 * (`{ anchorRowId: 'r0', anchorColId: 'c0', rowSpan: 1, colSpan: 3 }`).
 */

import {
  extendTableCellRangeEnd,
  isSingleCellRange,
  resolveTableCellRange,
  tableRangeCellRefs,
  tableRangeMembership,
  tableRangeSize,
  tableWholeGridRange,
} from '../table-cell-range';
import { createTableModel } from '../table-model-helpers';
import { moveTableCursor } from '../table-cell-navigation';
import type { CellSpan, TableColumn, TableColumnId, TableModel, TableRow, TableRowId } from '../../../types/table';

const COLUMNS: TableColumn[] = ['c0', 'c1', 'c2', 'c3'].map((id) => ({
  id,
  sizing: { kind: 'fixed', widthMm: 20 },
  valueType: 'text',
  align: 'left',
}));

const ROWS: TableRow[] = ['r0', 'r1', 'r2', 'r3'].map((id, i) => ({
  id,
  rowClass: i === 0 ? 'title' : 'data',
  heightMm: 8,
}));

function modelWith(merges: CellSpan[] = []): TableModel {
  return createTableModel({ columns: COLUMNS, rows: ROWS, merges });
}

/** Η **αληθινή** γραμμή τίτλου των πινάκων της σκηνής: `r0` × τρεις στήλες. */
const TITLE_MERGE: CellSpan = { anchorRowId: 'r0', anchorColId: 'c0', rowSpan: 1, colSpan: 3 };

const ref = (rowId: string, colId: string) => ({
  rowId: rowId as TableRowId,
  colId: colId as TableColumnId,
});

// ── Κανονικοποίηση ──────────────────────────────────────────────────────────

describe('resolveTableCellRange — η σειρά των δύο άκρων δεν μετράει', () => {
  it('πάνω-αριστερά → κάτω-δεξιά', () => {
    expect(resolveTableCellRange(modelWith(), ref('r1', 'c1'), ref('r2', 'c2'))).toEqual({
      firstRow: 1,
      lastRow: 2,
      firstCol: 1,
      lastCol: 2,
    });
  });

  it('🔴 κάτω-ΔΕΞΙΑ → πάνω-ΑΡΙΣΤΕΡΑ δίνει το ΙΔΙΟ ορθογώνιο', () => {
    const model = modelWith();
    expect(resolveTableCellRange(model, ref('r2', 'c2'), ref('r1', 'c1'))).toEqual(
      resolveTableCellRange(model, ref('r1', 'c1'), ref('r2', 'c2')),
    );
  });

  it('ανάμεικτη διαγώνιος (κάτω-αριστερά ↔ πάνω-δεξιά) κανονικοποιείται κι αυτή', () => {
    expect(resolveTableCellRange(modelWith(), ref('r3', 'c1'), ref('r1', 'c3'))).toEqual({
      firstRow: 1,
      lastRow: 3,
      firstCol: 1,
      lastCol: 3,
    });
  });

  it('ίδιο κελί και στα δύο άκρα ⇒ μονό κελί', () => {
    const bounds = resolveTableCellRange(modelWith(), ref('r1', 'c1'), ref('r1', 'c1'))!;
    expect(isSingleCellRange(bounds)).toBe(true);
  });

  it('άγνωστη ταυτότητα (μπαγιάτικη επιλογή μετά από undo) ⇒ null, ποτέ μαντεψιά', () => {
    const model = modelWith();
    expect(resolveTableCellRange(model, ref('r1', 'c1'), ref('r9', 'c1'))).toBeNull();
    expect(resolveTableCellRange(model, ref('r9', 'c9'), ref('r1', 'c1'))).toBeNull();
  });
});

// ── Το κούμπωμα στις συγχωνεύσεις ───────────────────────────────────────────

describe('🔴 κούμπωμα — η περιοχή περικλείει ΟΛΟΚΛΗΡΕΣ τις συγχωνεύσεις που αγγίζει', () => {
  it('επιλογή ΕΝΟΣ κελιού μέσα σε συγχώνευση μεγαλώνει ώστε να την περιλάβει', () => {
    // `c0` της γραμμής τίτλου: η συγχώνευση φτάνει ως το `c2`.
    expect(resolveTableCellRange(modelWith([TITLE_MERGE]), ref('r0', 'c0'), ref('r0', 'c0'))).toEqual(
      { firstRow: 0, lastRow: 0, firstCol: 0, lastCol: 2 },
    );
  });

  it('επιλογή που ΚΟΒΕΙ τη συγχώνευση στη μέση μεγαλώνει ώσπου να τη χωρέσει', () => {
    // `c1..c1` πέφτει **μέσα** στο `c0..c2` — δεν υπάρχει «μισό συγχωνευμένο κελί».
    expect(resolveTableCellRange(modelWith([TITLE_MERGE]), ref('r0', 'c1'), ref('r0', 'c1'))).toEqual(
      { firstRow: 0, lastRow: 0, firstCol: 0, lastCol: 2 },
    );
  });

  it('επιλογή που ΔΕΝ αγγίζει τη συγχώνευση μένει ανέπαφη', () => {
    expect(resolveTableCellRange(modelWith([TITLE_MERGE]), ref('r1', 'c1'), ref('r2', 'c2'))).toEqual(
      { firstRow: 1, lastRow: 2, firstCol: 1, lastCol: 2 },
    );
  });

  /**
   * 🔴 Ο **βρόχος** του κουμπώματος, όχι ένα πέρασμα: η πρώτη επέκταση φέρνει την περιοχή σε
   * επαφή με **δεύτερη** συγχώνευση, που την επεκτείνει ξανά. Μια υλοποίηση με ένα μόνο
   * πέρασμα θα σταματούσε στη μέση — και θα ήταν πράσινη σε κάθε test με μία συγχώνευση.
   */
  it('🔴 ΑΛΥΣΙΔΩΤΗ επέκταση: η μία συγχώνευση φέρνει την περιοχή πάνω στην επόμενη', () => {
    // ⚠️ Η **σειρά** στον πίνακα είναι μέρος του ελέγχου: η κατακόρυφη δηλώνεται **πρώτη**,
    // οπότε στο πρώτο πέρασμα δεν τέμνεται ακόμα με τίποτα. Μόνο αφού η οριζόντια τραβήξει
    // την περιοχή ως το `c2` γίνεται σχετική — δηλαδή χρειάζεται **δεύτερο** πέρασμα. Μια
    // υλοποίηση με ένα μόνο πέρασμα περνά όλα τα υπόλοιπα tests και σπάει εδώ.
    const chained: CellSpan[] = [
      { anchorRowId: 'r0', anchorColId: 'c2', rowSpan: 3, colSpan: 1 }, // κατακόρυφη: c2 × r0-r2
      { anchorRowId: 'r0', anchorColId: 'c1', rowSpan: 1, colSpan: 2 }, // οριζόντια:  r0 × c1-c2
    ];
    // Αφετηρία: το μονό κελί `r0/c1`.
    //   πέρασμα 1 → η οριζόντια το ανοίγει σε `c1..c2`
    //   πέρασμα 2 → η κατακόρυφη (τώρα εφαπτόμενη στο `c2`) το τραβά ως τη γραμμή `r2`
    expect(resolveTableCellRange(modelWith(chained), ref('r0', 'c1'), ref('r0', 'c1'))).toEqual({
      firstRow: 0,
      lastRow: 2,
      firstCol: 1,
      lastCol: 2,
    });
  });

  it('συγχώνευση με άγνωστη άγκυρα αγνοείται — ίδια ανοχή με το buildMergeIndex', () => {
    const orphan: CellSpan = { anchorRowId: 'r9', anchorColId: 'c9', rowSpan: 2, colSpan: 2 };
    expect(resolveTableCellRange(modelWith([orphan]), ref('r1', 'c1'), ref('r1', 'c1'))).toEqual({
      firstRow: 1,
      lastRow: 1,
      firstCol: 1,
      lastCol: 1,
    });
  });
});

// ── Ctrl+A ──────────────────────────────────────────────────────────────────

describe('tableWholeGridRange — Ctrl+A', () => {
  it('όλο το πλέγμα', () => {
    expect(tableWholeGridRange(modelWith())).toEqual({
      firstRow: 0,
      lastRow: 3,
      firstCol: 0,
      lastCol: 3,
    });
  });

  it('πίνακας χωρίς γραμμές ή χωρίς στήλες ⇒ null', () => {
    expect(tableWholeGridRange(createTableModel({ columns: COLUMNS, rows: [] }))).toBeNull();
    expect(tableWholeGridRange(createTableModel({ columns: [], rows: ROWS }))).toBeNull();
  });
});

// ── Μέγεθος & μέλη ──────────────────────────────────────────────────────────

describe('tableRangeSize — αυτό που δείχνει η γραμμή κατάστασης', () => {
  it('κλειστό διάστημα: 1..2 είναι ΔΥΟ γραμμές, όχι μία', () => {
    expect(tableRangeSize({ firstRow: 1, lastRow: 2, firstCol: 0, lastCol: 3 })).toEqual({
      rows: 2,
      columns: 4,
    });
  });
});

describe('tableRangeMembership — δύο σύνολα, όχι σύνολο κελιών (ADR-735)', () => {
  it('περιέχει ακριβώς τις γραμμές και τις στήλες της περιοχής', () => {
    const m = tableRangeMembership(modelWith(), { firstRow: 1, lastRow: 2, firstCol: 0, lastCol: 1 });
    expect([...m.rowIds].sort()).toEqual(['r1', 'r2']);
    expect([...m.colIds].sort()).toEqual(['c0', 'c1']);
  });

  it('🔴 το γινόμενο των δύο συνόλων ΕΙΝΑΙ το ορθογώνιο — καμία γωνία δεν λείπει, καμία δεν περισσεύει', () => {
    const bounds = { firstRow: 1, lastRow: 2, firstCol: 1, lastCol: 2 };
    const m = tableRangeMembership(modelWith(), bounds);
    const inside = (r: string, c: string) =>
      m.rowIds.has(r as TableRowId) && m.colIds.has(c as TableColumnId);

    expect(inside('r1', 'c1')).toBe(true);
    expect(inside('r2', 'c2')).toBe(true);
    expect(inside('r0', 'c1')).toBe(false);
    expect(inside('r1', 'c3')).toBe(false);
  });
});

describe('tableRangeCellRefs — σειρά γραμμή × στήλη, ΚΑΙ τα καλυμμένα', () => {
  it('ντετερμινιστική σειρά: πρώτα όλη η γραμμή, μετά η επόμενη', () => {
    expect(tableRangeCellRefs(modelWith(), { firstRow: 0, lastRow: 1, firstCol: 0, lastCol: 1 })).toEqual([
      ref('r0', 'c0'),
      ref('r0', 'c1'),
      ref('r1', 'c0'),
      ref('r1', 'c1'),
    ]);
  });

  it('🔴 επιστρέφει ΚΑΙ τα καλυμμένα κελιά μιας συγχώνευσης — το TSV είναι ορθογώνιο', () => {
    // Αν παρέλειπε τα καλυμμένα, οι επόμενες στήλες θα ολίσθαιναν αριστερά στο Excel.
    const refs = tableRangeCellRefs(modelWith([TITLE_MERGE]), {
      firstRow: 0,
      lastRow: 0,
      firstCol: 0,
      lastCol: 2,
    });
    expect(refs).toHaveLength(3);
  });

  it('όρια πέρα από το πλέγμα περικόπτονται αντί να παράγουν undefined', () => {
    const refs = tableRangeCellRefs(modelWith(), { firstRow: -5, lastRow: 99, firstCol: -1, lastCol: 99 });
    expect(refs).toHaveLength(ROWS.length * COLUMNS.length);
  });
});

// ── Shift + βέλος ───────────────────────────────────────────────────────────

describe('extendTableCellRangeEnd — Shift+βέλος κουνά ΤΟ ΤΕΛΟΣ, όχι τον δρομέα', () => {
  it('ένα βήμα δεξιά', () => {
    expect(extendTableCellRangeEnd(modelWith(), ref('r1', 'c1'), 'right')).toEqual(ref('r1', 'c2'));
  });

  it('ένα βήμα κάτω', () => {
    expect(extendTableCellRangeEnd(modelWith(), ref('r1', 'c1'), 'down')).toEqual(ref('r2', 'c1'));
  });

  it('η άκρη του πλέγματος ⇒ null (το τέλος μένει όπου είναι, ποτέ αναδίπλωση)', () => {
    expect(extendTableCellRangeEnd(modelWith(), ref('r3', 'c3'), 'down')).toBeNull();
    expect(extendTableCellRangeEnd(modelWith(), ref('r0', 'c0'), 'up')).toBeNull();
  });

  it('🔴 προσπερνά ΟΛΟΚΛΗΡΗ τη συγχώνευση — ο κανόνας «άλλαξε ο ιδιοκτήτης», δανεισμένος', () => {
    // Από το `r0/c0` (συγχωνευμένο c0-c2) ένα βήμα δεξιά προσγειώνεται στο `c3`, όχι στο `c1`.
    expect(extendTableCellRangeEnd(modelWith([TITLE_MERGE]), ref('r0', 'c0'), 'right')).toEqual(
      ref('r0', 'c3'),
    );
  });

  it('μπαγιάτικο τέλος ⇒ null', () => {
    expect(extendTableCellRangeEnd(modelWith(), ref('r9', 'c9'), 'right')).toBeNull();
  });

  /**
   * ⚠️ Ο έλεγχος μεταλλάξεων έδειξε ότι η **στήλη αγκύρωσης** της συνθετικής θέσης είναι
   * αδιάφορη: αλλοιώνοντάς την, κανένα test δεν κοκκίνιζε. Δεν είναι κενό δικτύου — είναι
   * **ιδιότητα**: μόνο τα `commitDown`/`commitUp` τη διαβάζουν, και αυτά αντιστοιχούν στο
   * `Enter`, που χαρτογραφείται ρητά σε **κίνηση** και ποτέ σε επέκταση.
   *
   * Αυτό το test **κλειδώνει την ιδιότητα** αντί να την αφήσει σιωπηλή: αν κάποτε μια
   * κάθετη-με-αγκύρωση κίνηση γίνει επεκτάσιμη, το `extendTableCellRangeEnd` θα αρχίσει
   * να εξαρτάται από ένα πεδίο που κανείς δεν σκέφτηκε — και θα το πει εδώ.
   */
  it('🔴 οι ΕΠΕΚΤΑΣΙΜΕΣ κινήσεις δεν διαβάζουν στήλη αγκύρωσης — ίδιο αποτέλεσμα με κάθε τιμή', () => {
    const model = modelWith();
    const start = ref('r1', 'c1');
    for (const move of ['left', 'right', 'up', 'down', 'rowStart', 'rowEnd', 'gridStart', 'gridEnd'] as const) {
      const viaOwnColumn = moveTableCursor(model, { ...start, anchorColId: start.colId }, move);
      const viaOtherColumn = moveTableCursor(model, { ...start, anchorColId: 'c3' as TableColumnId }, move);
      expect({ move, at: viaOwnColumn }).toEqual({ move, at: viaOtherColumn });
    }
  });

  it('ΑΝΤΙΘΕΤΑ, οι κάθετες-με-αγκύρωση κινήσεις ΤΗ ΔΙΑΒΑΖΟΥΝ — γι΄ αυτό μένουν κινήσεις', () => {
    // Η απόδειξη ότι το προηγούμενο test λέει κάτι: με άλλη στήλη αγκύρωσης, το `commitDown`
    // προσγειώνεται αλλού. Γι΄ αυτό ακριβώς το `Shift+Enter` ΔΕΝ έγινε επέκταση.
    const model = modelWith();
    const start = { rowId: 'r1' as TableRowId, colId: 'c1' as TableColumnId };
    expect(moveTableCursor(model, { ...start, anchorColId: 'c1' as TableColumnId }, 'commitDown')?.colId).toBe('c1');
    expect(moveTableCursor(model, { ...start, anchorColId: 'c3' as TableColumnId }, 'commitDown')?.colId).toBe('c3');
  });
});
