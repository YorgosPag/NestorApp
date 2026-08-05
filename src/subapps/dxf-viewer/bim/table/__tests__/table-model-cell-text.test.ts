/**
 * ADR-739 Φάση Δ βήμα 2 — ο **αμετάβλητος εγγραφέας κειμένου κελιού**
 * (`setPersistedCellText` / `getPersistedCellText`).
 *
 * Πέντε εγγυήσεις, καθεμιά με δικό της `describe`:
 *  1. Καθαρότητα — το `model` εισόδου δεν μεταλλάσσεται ποτέ.
 *  2. Ντετερμινιστική σειρά — ίδια θέση για αντικατάσταση, σωστή θέση γραμμή×στήλη
 *     για εισαγωγή.
 *  3. Διατήρηση — μόνο το `value` αλλάζει σε υπάρχον κελί.
 *  4. Ταυτότητα by-reference όταν το κείμενο δεν αλλάζει.
 *  5. JSON-safe έξοδος — το αποτέλεσμα περνά ακέραιο round-trip.
 */

import {
  createTableModel,
  getPersistedCellText,
  setPersistedCellText,
  toPersistedTableModel,
} from '../table-model-helpers';
import type {
  PersistedTableModel,
  TableCell,
  TableCellEntry,
  TableColumn,
  TableColumnId,
  TableRow,
  TableRowId,
} from '../../../types/table';

const COLUMNS: TableColumn[] = [
  { id: 'c1', sizing: { kind: 'fixed', widthMm: 40 }, valueType: 'text', align: 'left' },
  { id: 'c2', sizing: { kind: 'fixed', widthMm: 20 }, valueType: 'number', align: 'right' },
];

const ROWS: TableRow[] = [
  { id: 'r1', rowClass: 'header', heightMm: 8 },
  { id: 'r2', rowClass: 'data', heightMm: 8 },
];

const text = (value: string | number): TableCell => ({ kind: 'text', value });

/** Τέσσερα γεμάτα κελιά — πλήρης ο αραιός χάρτης του 2×2, ήδη σε ντετερμινιστική σειρά. */
const ALL_CELLS: readonly TableCellEntry[] = [
  ['r1', 'c1', text('Στοιχείο')],
  ['r1', 'c2', text('Ποσότητα')],
  ['r2', 'c1', text('Δοκός Δ1')],
  ['r2', 'c2', text(12.5)],
];

function makePersisted(cells: readonly TableCellEntry[] = ALL_CELLS): PersistedTableModel {
  return toPersistedTableModel(createTableModel({ columns: COLUMNS, rows: ROWS, cells }));
}

/**
 * 🔴 ADR-739 §50 — ο γραφέας δεν επιστρέφει πια μοντέλο αλλά **εκκρεμότητα**
 * ({@link PendingCellWrites}). Οι έλεγχοι των τεσσάρων εγγυήσεων ρωτούν το μοντέλο της· η
 * **πέμπτη** εγγύηση (τι δηλώνει ότι έγραψε) ελέγχεται χωριστά, στην ενότητα 5.
 *
 * ⚠️ Η ταυτότητα by-reference **επιβιώνει μέσα από τον βοηθό**: `unchanged()` επιστρέφει το
 * ίδιο `model`, οπότε το `expect(noOp).toBe(model)` παραμένει ο ίδιος έλεγχος που ήταν.
 */
function writeText(
  model: PersistedTableModel,
  rowId: TableRowId,
  colId: TableColumnId,
  value: string,
): PersistedTableModel {
  return setPersistedCellText(model, rowId, colId, value).model;
}

// ── 1. Καθαρότητα — το `model` εισόδου δεν αγγίζεται ποτέ ─────────────────

describe('setPersistedCellText — καθαρότητα', () => {
  it('δεν μεταλλάσσει τον πίνακα `cells` του μοντέλου εισόδου', () => {
    const model = makePersisted();
    const before = model.cells;
    const beforeSnapshot = JSON.parse(JSON.stringify(before));

    writeText(model, 'r1', 'c1', 'Νέο κείμενο');

    expect(model.cells).toBe(before); // ίδια αναφορά πίνακα — καμία μετάλλαξη in-place
    expect(model.cells).toEqual(beforeSnapshot);
  });

  it('δεν μεταλλάσσει το ίδιο το υπάρχον αντικείμενο κελιού', () => {
    const model = makePersisted();
    const existingCellRef = model.cells[0][2];

    writeText(model, 'r1', 'c1', 'Νέο κείμενο');

    expect(model.cells[0][2]).toBe(existingCellRef); // ίδιο κελί, αμετάβλητο
    expect(existingCellRef.value).toBe('Στοιχείο'); // δεν άλλαξε ΠΟΤΕ η αρχική τιμή
  });

  it('δεν μεταλλάσσει το μοντέλο όταν εισάγει ΝΕΟ κελί', () => {
    const model = makePersisted([]);
    const before = model.cells;

    writeText(model, 'r1', 'c1', 'Πρώτο κελί');

    expect(model.cells).toBe(before);
    expect(model.cells).toEqual([]);
  });

  it('επιστρέφει ΝΕΟ αντικείμενο μοντέλου (όχι το ίδιο) όταν πράγματι αλλάζει κάτι', () => {
    const model = makePersisted();
    const result = writeText(model, 'r1', 'c1', 'Νέο κείμενο');
    expect(result).not.toBe(model);
    expect(result.cells).not.toBe(model.cells);
  });
});

// ── 2. Ντετερμινιστική σειρά ────────────────────────────────────────────────

describe('setPersistedCellText — ντετερμινιστική σειρά', () => {
  it('υπάρχον κελί αντικαθίσταται ΣΤΗΝ ΙΔΙΑ ΘΕΣΗ — η σειρά των άλλων μένει ίδια', () => {
    const model = makePersisted();
    const result = writeText(model, 'r2', 'c1', 'Δοκός Δ2');

    expect(result.cells.map(([r, c]) => `${r}/${c}`)).toEqual([
      'r1/c1', 'r1/c2', 'r2/c1', 'r2/c2',
    ]);
    expect(result.cells[2][2].value).toBe('Δοκός Δ2');
  });

  it('νέο κελί μπαίνει στη ΣΩΣΤΗ θέση γραμμή×στήλη, όχι στο τέλος', () => {
    // Λείπει το (r1,c2) — πρέπει να καταλήξει ΑΝΑΜΕΣΑ στο (r1,c1) και το (r2,c1).
    const sparse = makePersisted([ALL_CELLS[0], ALL_CELLS[2], ALL_CELLS[3]]);
    const result = writeText(sparse, 'r1', 'c2', 'Ποσότητα');

    expect(result.cells.map(([r, c]) => `${r}/${c}`)).toEqual([
      'r1/c1', 'r1/c2', 'r2/c1', 'r2/c2',
    ]);
  });

  it('νέο κελί σε άδειο μοντέλο γίνεται το μοναδικό στοιχείο', () => {
    const empty = makePersisted([]);
    const result = writeText(empty, 'r2', 'c1', 'Πρώτο');
    expect(result.cells).toEqual([['r2', 'c1', { kind: 'text', value: 'Πρώτο' }]]);
  });

  it('νέο κελί πριν από ΟΛΑ τα υπάρχοντα μπαίνει στην αρχή', () => {
    const withoutFirst = makePersisted([ALL_CELLS[1], ALL_CELLS[2], ALL_CELLS[3]]);
    const result = writeText(withoutFirst, 'r1', 'c1', 'Στοιχείο');
    expect(result.cells.map(([r, c]) => `${r}/${c}`)).toEqual([
      'r1/c1', 'r1/c2', 'r2/c1', 'r2/c2',
    ]);
  });

  it('κελί σε άγνωστη γραμμή/στήλη (ορφανή αναφορά) δεν επηρεάζει τη σύγκριση θέσης', () => {
    // Χτισμένο ΑΠΕΥΘΕΙΑΣ ως `PersistedTableModel` (όχι μέσω `makePersisted`, που θα
    // αποσφαλμάτωνε — δηλαδή θα πετούσε — το ορφανό κελί στο `toPersistedTableModel`):
    // το `setPersistedCellText` λειτουργεί πάνω στο ΤΑΞΙΔΕΥΟΝ σχήμα, όπου ένα ορφανό
    // (γραμμή που διαγράφηκε ΑΦΟΥ αποθηκεύτηκε ο πίνακας) είναι φυσιολογικό ενδιάμεσο.
    const withOrphan: PersistedTableModel = {
      columns: COLUMNS,
      rows: ROWS,
      cells: [ALL_CELLS[0], ['r_deleted', 'c1', text('ορφανό')], ALL_CELLS[3]],
      merges: [],
    };
    const result = writeText(withOrphan, 'r2', 'c1', 'Δοκός Δ1');
    // Το ορφανό μένει όπου ήταν (δεν αγγίζεται)· το νέο μπαίνει στη σωστή θέση ανάμεσα
    // στα ΕΓΚΥΡΑ κελιά.
    expect(result.cells.map(([r, c]) => `${r}/${c}`)).toEqual([
      'r1/c1', 'r_deleted/c1', 'r2/c1', 'r2/c2',
    ]);
  });
});

// ── 3. Διατήρηση — μόνο το `value` αλλάζει ─────────────────────────────────

describe('setPersistedCellText — διατήρηση των υπόλοιπων πεδίων', () => {
  it('styleOverride / locked / kind ενός υπάρχοντος κελιού μένουν ΑΘΙΚΤΑ', () => {
    const styled: TableCell = {
      kind: 'text',
      value: 'Παλιό',
      styleOverride: { bold: true, textColorHex: '#ff0000' },
      locked: true,
    };
    const model = makePersisted([['r1', 'c1', styled], ALL_CELLS[1], ALL_CELLS[2], ALL_CELLS[3]]);
    const result = writeText(model, 'r1', 'c1', 'Νέο');

    const updated = result.cells[0][2];
    expect(updated.value).toBe('Νέο');
    expect(updated.kind).toBe('text');
    expect(updated.locked).toBe(true);
    expect(updated.styleOverride).toEqual({ bold: true, textColorHex: '#ff0000' });
    expect(updated.styleOverride).toBe(styled.styleOverride); // ίδια αναφορά, όχι κλώνος
  });

  it('νέο κελί παίρνει τα προεπιλεγμένα του module: μόνο `kind`+`value`', () => {
    const model = makePersisted([]);
    const result = writeText(model, 'r1', 'c1', 'Κείμενο');
    expect(result.cells[0][2]).toEqual({ kind: 'text', value: 'Κείμενο' });
  });
});

// ── 4. Ταυτότητα by-reference ──────────────────────────────────────────────

describe('setPersistedCellText — ταυτότητα by-reference όταν το κείμενο δεν αλλάζει', () => {
  it('ίδιο κείμενο με υπάρχον κελί ⇒ επιστρέφει ΤΟ ΙΔΙΟ μοντέλο (===)', () => {
    const model = makePersisted();
    const result = writeText(model, 'r1', 'c1', 'Στοιχείο');
    expect(result).toBe(model);
  });

  it('ίδιο κείμενο με κελί αριθμητικής τιμής (σύγκριση μέσω `cellText`) ⇒ ΤΟ ΙΔΙΟ μοντέλο', () => {
    const model = makePersisted();
    const result = writeText(model, 'r2', 'c2', '12.5');
    expect(result).toBe(model);
  });

  it('διαφορετικό κείμενο ⇒ ΝΕΟ μοντέλο, ποτέ η ίδια αναφορά', () => {
    const model = makePersisted();
    const result = writeText(model, 'r1', 'c1', 'Αλλαγμένο');
    expect(result).not.toBe(model);
  });

  it('η ταυτότητα σπάει η αλυσίδα `resolveTableModel`/`WeakMap` ΜΟΝΟ όταν πράγματι αλλάζει κάτι', () => {
    // Χωρίς την ταυτότητα by-reference, μία επεξεργασία που δεν άλλαξε τίποτα θα ακύρωνε
    // σιωπηλά τη μνήμη του `resolveTableModel` — αχρείαστη επανα-διάταξη σε κάθε πλήκτρο.
    const model = makePersisted();
    const noOp = writeText(model, 'r1', 'c1', 'Στοιχείο');
    const changed = writeText(model, 'r1', 'c1', 'Αλλαγή');

    expect(noOp).toBe(model);
    expect(changed).not.toBe(model);
  });
});

// ── 5. JSON-safe — το αποτέλεσμα ταξιδεύει ακέραιο ─────────────────────────

describe('setPersistedCellText — η έξοδος είναι JSON-safe', () => {
  it('περνά ακέραιο round-trip `JSON.parse(JSON.stringify())`', () => {
    const model = makePersisted();
    const result = writeText(model, 'r1', 'c1', 'Νέο κείμενο');
    const revived: PersistedTableModel = JSON.parse(JSON.stringify(result));
    expect(revived).toEqual(result);
  });

  it('η εισαγωγή νέου κελιού επίσης περνά ακέραιη round-trip', () => {
    const model = makePersisted([]);
    const result = writeText(model, 'r1', 'c1', 'Πρώτο');
    const revived: PersistedTableModel = JSON.parse(JSON.stringify(result));
    expect(revived).toEqual(result);
  });
});

// ── getPersistedCellText — η ανάγνωση που ταιριάζει στον εγγραφέα ─────────

describe('getPersistedCellText', () => {
  it('διαβάζει το κείμενο ενός υπάρχοντος κελιού', () => {
    const model = makePersisted();
    expect(getPersistedCellText(model, 'r1', 'c1')).toBe('Στοιχείο');
    expect(getPersistedCellText(model, 'r2', 'c2')).toBe('12.5'); // αριθμός ⇒ αλφαριθμητικό
  });

  it('κενό κελί ⇒ κενό αλφαριθμητικό, όχι `undefined`', () => {
    const model = makePersisted([]);
    expect(getPersistedCellText(model, 'r1', 'c1')).toBe('');
  });

  it('συμφωνεί με το `setPersistedCellText`: ό,τι γράφεται, διαβάζεται πίσω ίδιο', () => {
    const model = makePersisted();
    const result = writeText(model, 'r1', 'c1', 'Δοκιμή');
    expect(getPersistedCellText(result, 'r1', 'c1')).toBe('Δοκιμή');
  });
});
