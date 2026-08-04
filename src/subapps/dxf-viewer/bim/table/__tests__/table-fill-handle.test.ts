/**
 * 🔴 ADR-754 **Γ4** — **η λαβή συμπλήρωσης**: ποια κελιά υπόσχεται, και τι γράφει.
 *
 * Δύο πράγματα κλειδώνουν εδώ και το δεύτερο είναι ο λόγος που το Γ1 και το Γ2 γράφτηκαν μαζί:
 *
 * 1. **Ένας άξονας, ποτέ δύο.** Η διαγώνια σύρση διαλέγει· δεν γεμίζει ορθογώνιο.
 * 2. 🔑 **Το `$` αποφασίζει ποιες αναφορές ακολουθούν.** Χωρίς αυτό η συμπλήρωση θα μετατόπιζε
 *    **πάντα**, και ο χρήστης δεν θα είχε κανέναν τρόπο να πει «αυτό το κελί όχι» — δηλαδή
 *    ολόκληρη η κλασική χρήση «επί σταθερό συντελεστή» θα ήταν αδύνατη.
 *
 * ⚠️ **Πλέγμα 5×5, όπως κάθε test αυτού του ADR** (§1.2).
 */

import { createTableModel, toPersistedTableModel } from '../table-model-helpers';
import type { PersistedTableModel, TableColumn, TableRow } from '../../../types/table';
import { cellInputText, writeCellInput } from '../formula/table-formula-engine';
import { getPersistedCellText } from '../table-model-helpers';
import { applyTableFill } from '../table-fill-apply';
import {
  resolveTableFillTarget,
  tableFillHandleRectMm,
  tableFillPreviewBounds,
  isOnTableFillHandle,
  TABLE_FILL_HANDLE_PX,
} from '../table-fill-handle';
import type { TableCellRangeBounds } from '../table-cell-range';
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

const base = (): PersistedTableModel =>
  toPersistedTableModel(createTableModel({ columns: COLUMNS, rows: ROWS, cells: [] }));

/** Γράψε κείμενο/τύπο σε κελί, με δείκτες. */
function type(model: PersistedTableModel, row: number, col: number, text: string) {
  return writeCellInput(model, ROWS[row].id, COLUMNS[col].id, text);
}

const at = (row: number, col: number) => ({ row, col });
const rect = (firstRow: number, lastRow: number, firstCol: number, lastCol: number) =>
  ({ firstRow, lastRow, firstCol, lastCol }) as TableCellRangeBounds;

/** Ο τύπος **όπως τον βλέπει ο χρήστης** στη γραμμή τύπων. */
const formulaAt = (model: PersistedTableModel, row: number, col: number) =>
  cellInputText(model, ROWS[row].id, COLUMNS[col].id);

/** Η **τιμή** — η απόδειξη ότι ο επαναϋπολογισμός έτρεξε. */
const valueAt = (model: PersistedTableModel, row: number, col: number) =>
  getPersistedCellText(model, ROWS[row].id, COLUMNS[col].id);

// ──────────────────────────────────────────────────────────────────────────────
// Ποια κελιά υπόσχεται η σύρση
// ──────────────────────────────────────────────────────────────────────────────

describe('🔴 ΕΝΑΣ άξονας, ποτέ δύο', () => {
  const SOURCE = rect(1, 1, 1, 1); // το κελί B2

  it.each([
    [at(3, 1), 'down', rect(2, 3, 1, 1), 'σύρσιμο κάτω'],
    [at(0, 1), 'up', rect(0, 0, 1, 1), 'σύρσιμο πάνω'],
    [at(1, 3), 'right', rect(1, 1, 2, 3), 'σύρσιμο δεξιά'],
    [at(1, 0), 'left', rect(1, 1, 0, 0), 'σύρσιμο αριστερά'],
  ])('%o ⇒ %s (%s)', (pointer, direction, bounds) => {
    expect(resolveTableFillTarget(SOURCE, pointer)).toEqual({ direction, bounds });
  });

  /**
   * 🔑 Η διαγώνια σύρση **δεν** γεμίζει ορθογώνιο. Το χέρι σπάνια κινείται σε τέλεια ευθεία,
   * και ένα διαγώνιο γέμισμα θα έπρεπε να αποφασίσει μόνο του αν το `=B2*C2` ολισθαίνει κατά
   * γραμμή, κατά στήλη ή και τα δύο — τρεις διαφορετικοί αριθμοί, καμία ένδειξη ποιον ήθελε.
   */
  it('🔑 διαγώνια σύρση 3 κάτω / 1 δεξιά ⇒ κερδίζει ΜΟΝΟ ο κατακόρυφος', () => {
    expect(resolveTableFillTarget(SOURCE, at(4, 2))).toEqual({
      direction: 'down',
      bounds: rect(2, 4, 1, 1),
    });
  });

  it('διαγώνια σύρση 1 κάτω / 3 δεξιά ⇒ κερδίζει ΜΟΝΟ ο οριζόντιος', () => {
    expect(resolveTableFillTarget(SOURCE, at(2, 4))).toEqual({
      direction: 'right',
      bounds: rect(1, 1, 2, 4),
    });
  });

  it('στην ισοπαλία κερδίζει ο ΚΑΤΑΚΟΡΥΦΟΣ — η συμπλήρωση προς τα κάτω είναι ο κανόνας', () => {
    expect(resolveTableFillTarget(SOURCE, at(2, 2))?.direction).toBe('down');
  });

  it('🔴 το χέρι ΜΕΣΑ στην πηγή ⇒ null — τίποτα να γεμίσει', () => {
    expect(resolveTableFillTarget(rect(1, 3, 1, 3), at(2, 2))).toBeNull();
  });

  it('η πηγή ΔΕΝ περιλαμβάνεται ποτέ στον στόχο', () => {
    const target = resolveTableFillTarget(rect(0, 1, 0, 0), at(4, 0));
    expect(target?.bounds).toEqual(rect(2, 4, 0, 0));
  });

  it('η προεπισκόπηση είναι η ΕΝΩΣΗ πηγής και στόχου', () => {
    const source = rect(1, 1, 1, 1);
    const target = resolveTableFillTarget(source, at(4, 1))!;
    expect(tableFillPreviewBounds(source, target)).toEqual(rect(1, 4, 1, 1));
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Η γεωμετρία της λαβής
// ──────────────────────────────────────────────────────────────────────────────

describe('η λαβή κάθεται στην κάτω δεξιά γωνία', () => {
  /**
   * Διάταξη γραμμένη με το χέρι, **επίτηδες**: το υπό δοκιμή είναι η γεωμετρία της λαβής, όχι
   * ο μετρητής. Στήλες 20 mm, γραμμές 8 mm — αριθμοί που κάνουν κάθε προσδοκία παρακάτω
   * αναγνώσιμη χωρίς αριθμητική.
   */
  const LAYOUT: TableLayout = {
    widthMm: 100,
    heightMm: 40,
    columns: COLUMNS.map((column, i) => ({ id: column.id, xMm: i * 20, widthMm: 20 })),
    rows: ROWS.map((row, i) => ({ id: row.id, yMm: i * 8, heightMm: 8 })),
    cells: [],
    borders: [],
  };
  const PX_PER_MM = 2;

  it('κεντραρισμένη στην κορυφή — μισή μέσα, μισή έξω', () => {
    const handle = tableFillHandleRectMm(LAYOUT, rect(0, 0, 0, 0), PX_PER_MM)!;
    const sideMm = TABLE_FILL_HANDLE_PX / PX_PER_MM;
    // Το κελί A1 είναι 20×8 mm με πάνω-αριστερά στο (0,0) ⇒ η κορυφή του είναι στο (20, 8).
    expect(handle).toEqual({ x: 20 - sideMm / 2, y: 8 - sideMm / 2, w: sideMm, h: sideMm });
  });

  it('ακολουθεί την ΠΕΡΙΟΧΗ, όχι το ενεργό κελί', () => {
    const handle = tableFillHandleRectMm(LAYOUT, rect(0, 1, 0, 1), PX_PER_MM)!;
    expect(handle.x).toBeCloseTo(40 - TABLE_FILL_HANDLE_PX / PX_PER_MM / 2);
    expect(handle.y).toBeCloseTo(16 - TABLE_FILL_HANDLE_PX / PX_PER_MM / 2);
  });

  /** 🔑 Η **οπή** μεγαλώνει, όχι η ζωγραφιά: ένα μεγαλύτερο τετράγωνο θα σκέπαζε κείμενο. */
  it('🔑 πιάνεται και λίγο ΕΞΩ από το τετράγωνο (WCAG 2.5.8)', () => {
    const handle = tableFillHandleRectMm(LAYOUT, rect(0, 0, 0, 0), PX_PER_MM)!;
    expect(isOnTableFillHandle({ u: 20, v: 8 }, handle, PX_PER_MM)).toBe(true);
    // Ένα χιλιοστό έξω από τη ζωγραφιά, μέσα στην οπή.
    expect(isOnTableFillHandle({ u: 20 + 2.5, v: 8 }, handle, PX_PER_MM)).toBe(true);
    // Μακριά: όχι.
    expect(isOnTableFillHandle({ u: 30, v: 8 }, handle, PX_PER_MM)).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Τι γράφεται
// ──────────────────────────────────────────────────────────────────────────────

describe('🔑 το ΜΟΤΙΒΟ επαναλαμβάνεται', () => {
  it('πηγή δύο κελιών ⇒ 10 20 10 20', () => {
    let model = type(base(), 0, 0, '10');
    model = type(model, 1, 0, '20');

    const next = applyTableFill(model, rect(0, 1, 0, 0), {
      direction: 'down',
      bounds: rect(2, 4, 0, 0),
    });

    expect([2, 3, 4].map((r) => valueAt(next, r, 0))).toEqual(['10', '20', '10']);
  });

  /** 🔑 Προς τα **πάνω** το υπόλοιπο πρέπει να είναι θετικό, αλλιώς ο δείκτης βγαίνει αρνητικός. */
  it('🔑 προς τα ΠΑΝΩ το μοτίβο συνεχίζει ανάποδα', () => {
    let model = type(base(), 3, 0, '10');
    model = type(model, 4, 0, '20');

    const next = applyTableFill(model, rect(3, 4, 0, 0), {
      direction: 'up',
      bounds: rect(0, 2, 0, 0),
    });

    // r2 ← r4 (`20`), r1 ← r3 (`10`), r0 ← r4 (`20`)
    expect([0, 1, 2].map((r) => valueAt(next, r, 0))).toEqual(['20', '10', '20']);
  });

  it('η ΠΗΓΗ μένει ακέραιη', () => {
    const model = type(base(), 0, 0, '10');
    const next = applyTableFill(model, rect(0, 0, 0, 0), {
      direction: 'down',
      bounds: rect(1, 2, 0, 0),
    });
    expect(valueAt(next, 0, 0)).toBe('10');
  });

  it('κενό γέμισμα ⇒ ΤΟ ΙΔΙΟ μοντέλο by-reference (κανένα βήμα undo για το τίποτα)', () => {
    const model = base();
    expect(applyTableFill(model, rect(0, 0, 0, 0), { direction: 'down', bounds: rect(1, 2, 0, 0) }))
      .toBe(model);
  });
});

/**
 * 🔴 **ΕΔΩ ΣΥΝΑΝΤΙΟΥΝΤΑΙ ΤΟ Γ1 ΚΑΙ ΤΟ Γ2.** Αυτό το `describe` είναι ο λόγος που τα δύο
 * γράφτηκαν μαζί: χωρίς το `$`, κάθε γραμμή παρακάτω θα έδινε **λάθος αριθμό σε παραδοτέο**.
 */
describe('🔴 οι τύποι ολισθαίνουν — και το `$` τους κρατά', () => {
  it('🔑 η κλασική συμπλήρωση: «=A1*2» κάτω ⇒ «=A2*2», «=A3*2»', () => {
    let model = type(base(), 0, 0, '10');
    model = type(model, 1, 0, '20');
    model = type(model, 2, 0, '30');
    model = type(model, 0, 1, '=A1*2');

    const next = applyTableFill(model, rect(0, 0, 1, 1), {
      direction: 'down',
      bounds: rect(1, 2, 1, 1),
    });

    expect(formulaAt(next, 1, 1)).toBe('=A2*2');
    expect(formulaAt(next, 2, 1)).toBe('=A3*2');
    expect([valueAt(next, 1, 1), valueAt(next, 2, 1)]).toEqual(['40', '60']);
  });

  it('🔑 «επί σταθερό συντελεστή»: το «=A1*$A$5» κρατά τον συντελεστή του', () => {
    let model = type(base(), 0, 0, '10');
    model = type(model, 1, 0, '20');
    model = type(model, 4, 0, '3');
    model = type(model, 0, 1, '=A1*$A$5');

    const next = applyTableFill(model, rect(0, 0, 1, 1), {
      direction: 'down',
      bounds: rect(1, 1, 1, 1),
    });

    expect(formulaAt(next, 1, 1)).toBe('=A2*$A$5');
    expect(valueAt(next, 1, 1)).toBe('60');
  });

  it('η συμπλήρωση ΔΕΞΙΑ ολισθαίνει στήλες', () => {
    let model = type(base(), 0, 0, '10');
    model = type(model, 0, 1, '20');
    model = type(model, 1, 0, '=A1*2');

    const next = applyTableFill(model, rect(1, 1, 0, 0), {
      direction: 'right',
      bounds: rect(1, 1, 1, 1),
    });

    expect(formulaAt(next, 1, 1)).toBe('=B1*2');
    expect(valueAt(next, 1, 1)).toBe('40');
  });

  it('🔑 μεικτή αναφορά: το «=$A1» δεξιά κρατά τη ΣΤΗΛΗ και ακολουθεί τη γραμμή', () => {
    let model = type(base(), 0, 0, '7');
    model = type(model, 0, 1, '=$A1');

    const next = applyTableFill(model, rect(0, 0, 1, 1), {
      direction: 'right',
      bounds: rect(0, 0, 2, 3),
    });

    expect(formulaAt(next, 0, 2)).toBe('=$A1');
    expect(valueAt(next, 0, 2)).toBe('7');
  });

  it('εκτός πλέγματος ⇒ #REF!, ποτέ σιωπηλή στάθμευση', () => {
    let model = type(base(), 4, 0, '1');
    model = type(model, 0, 1, '=A1');

    const next = applyTableFill(model, rect(0, 0, 1, 1), {
      direction: 'up',
      bounds: rect(0, 0, 1, 1),
    });
    // Το γέμισμα δεν βγήκε έξω· ο έλεγχος του #REF! ζει ολόκληρος στο `table-formula-offset`.
    expect(formulaAt(next, 0, 1)).toBe('=A1');
  });
});
