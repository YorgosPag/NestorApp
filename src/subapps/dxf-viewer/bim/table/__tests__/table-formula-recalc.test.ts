/**
 * ADR-739 Φ.Ζ — **ο επαναϋπολογισμός και η διαδρομή commit**.
 *
 * Εδώ ζει η **άγκυρα της υπόσχεσης του §11 #7**: εισαγωγή γραμμής πάνω από τύπο δεν αλλάζει
 * το αποτέλεσμα, και η γραμμή τύπων δείχνει μόνη της τη νέα διεύθυνση. Αν αυτό το test
 * κοκκινίσει, ο πίνακας μόλις απέκτησε το ελάττωμα του AutoCAD που το ADR υπόσχεται να μην
 * έχει — δηλαδή **λάθος νούμερο σε παραδοτέο**, όχι πρόβλημα εμφάνισης.
 */

import {
  cellKey,
  createTableModel,
  getPersistedCellText,
  toPersistedTableModel,
} from '../table-model-helpers';
import type {
  PersistedTableModel,
  TableCellEntry,
  TableColumn,
  TableRow,
} from '../../../types/table';
import { insertTableRow } from '../table-row-column-ops';
import {
  cellInputText,
  recalculateTableModel,
  writeCellInput,
} from '../formula/table-formula-engine';

const COLUMNS: TableColumn[] = ['c1', 'c2'].map((id) => ({
  id,
  sizing: { kind: 'fixed', widthMm: 20 },
  valueType: 'number',
  align: 'right',
}));

const ROWS: TableRow[] = ['r1', 'r2', 'r3', 'r4'].map((id) => ({
  id,
  rowClass: 'data',
  heightMm: 8,
}));

const CELLS: readonly TableCellEntry[] = [
  ['r1', 'c1', { kind: 'text', value: '10' }],
  ['r2', 'c1', { kind: 'text', value: '20' }],
];

function makeModel(): PersistedTableModel {
  return toPersistedTableModel(createTableModel({ columns: COLUMNS, rows: ROWS, cells: CELLS }));
}

/**
 * **Ακριβώς** ό,τι κάνει το `buildTableCellEditCommand`: γράφε, ξαναϋπολόγισε, ένα μοντέλο.
 * Γραμμένο έτσι ώστε το test να δοκιμάζει τη ζωντανή αλυσίδα και όχι μια δική του εκδοχή της.
 */
function edit(
  model: PersistedTableModel,
  rowId: string,
  colId: string,
  text: string,
): PersistedTableModel {
  return recalculateTableModel(writeCellInput(model, rowId, colId, text), [cellKey(rowId, colId)]);
}

describe('γραφή κελιού — η μία διακλάδωση `=`', () => {
  it('κείμενο χωρίς `=` παραμένει κείμενο', () => {
    const model = edit(makeModel(), 'r3', 'c1', '42');
    expect(model.cells.find(([r, c]) => r === 'r3' && c === 'c1')?.[2]).toEqual({
      kind: 'text',
      value: '42',
    });
  });

  it('τύπος γίνεται κελί `formula` με το ΑΠΟΤΕΛΕΣΜΑ στην τιμή', () => {
    const model = edit(makeModel(), 'r3', 'c1', '=(2*5)/2');
    const cell = model.cells.find(([r, c]) => r === 'r3' && c === 'c1')?.[2];
    expect(cell?.kind).toBe('formula');
    expect(cell?.value).toBe(5);
    // Ο καμβάς διαβάζει την τιμή· η γραμμή τύπων το πηγαίο.
    expect(getPersistedCellText(model, 'r3', 'c1')).toBe('5');
    expect(cellInputText(model, 'r3', 'c1')).toBe('=(2*5)/2');
  });

  it('τύπος που δεν αναλύεται μένει ΚΕΙΜΕΝΟ, αυτούσιος', () => {
    const model = edit(makeModel(), 'r3', 'c1', '=1+');
    expect(model.cells.find(([r, c]) => r === 'r3' && c === 'c1')?.[2]).toEqual({
      kind: 'text',
      value: '=1+',
    });
  });

  it('🔴 κείμενο πάνω σε κελί τύπου ΣΒΗΝΕΙ τον τύπο', () => {
    const withFormula = edit(makeModel(), 'r3', 'c1', '=A1+A2');
    const overwritten = edit(withFormula, 'r3', 'c1', '5');
    const cell = overwritten.cells.find(([r, c]) => r === 'r3' && c === 'c1')?.[2];
    // Χωρίς αυτό το κελί θα έμενε τύπος με μπαγιάτικο δέντρο και ο επόμενος
    // επαναϋπολογισμός θα ξανάγραφε το 30 πάνω από το 5 που πληκτρολόγησε ο χρήστης.
    expect(cell).toEqual({ kind: 'text', value: '5' });
  });

  it('ο ίδιος τύπος ξανά ⇒ ΤΟ ΙΔΙΟ μοντέλο by-reference (κανένα βήμα undo για το τίποτα)', () => {
    const withFormula = edit(makeModel(), 'r3', 'c1', '=A1+A2');
    expect(edit(withFormula, 'r3', 'c1', '=A1+A2')).toBe(withFormula);
  });
});

describe('εξαρτήσεις', () => {
  it('ο τύπος βλέπει τα κελιά που αναφέρει', () => {
    const model = edit(makeModel(), 'r3', 'c1', '=SUM(A1:A2)');
    expect(cellValue(model, 'r3', 'c1')).toBe(30);
  });

  it('αλλαγή προγόνου ξαναϋπολογίζει τον εξαρτημένο', () => {
    const withSum = edit(makeModel(), 'r3', 'c1', '=SUM(A1:A2)');
    const changed = edit(withSum, 'r1', 'c1', '1');
    expect(cellValue(changed, 'r3', 'c1')).toBe(21);
  });

  it('αλυσίδα δύο επιπέδων λύνεται με ΕΝΑ πέρασμα (τοπολογική σειρά)', () => {
    let model = edit(makeModel(), 'r3', 'c1', '=A1+A2');
    model = edit(model, 'r4', 'c1', '=A3*2');
    expect(cellValue(model, 'r4', 'c1')).toBe(60);

    // Το `A1` αλλάζει: πρέπει να ενημερωθούν ΚΑΙ τα δύο, με τη σωστή σειρά.
    model = edit(model, 'r1', 'c1', '30');
    expect(cellValue(model, 'r3', 'c1')).toBe(50);
    expect(cellValue(model, 'r4', 'c1')).toBe(100);
  });

  it('κελί που ΔΕΝ εξαρτάται δεν αγγίζεται', () => {
    let model = edit(makeModel(), 'r3', 'c1', '=A1+A2');
    model = edit(model, 'r4', 'c2', '=100');
    const before = model.cells.find(([r, c]) => r === 'r4' && c === 'c2');

    model = edit(model, 'r1', 'c1', '11');
    // Ίδια **αναφορά** αντικειμένου: το ανεξάρτητο κελί δεν ξαναγράφτηκε καν.
    expect(model.cells.find(([r, c]) => r === 'r4' && c === 'c2')).toBe(before);
  });
});

describe('κύκλοι', () => {
  it('αυτοαναφορά δίνει `#CIRCULAR!`, όχι παλιά τιμή', () => {
    const model = edit(makeModel(), 'r3', 'c1', '=A3+1');
    expect(cellValue(model, 'r3', 'c1')).toBe('#CIRCULAR!');
  });

  it('κύκλος δύο κελιών δίνει `#CIRCULAR!` και στα δύο', () => {
    let model = edit(makeModel(), 'r3', 'c1', '=A4');
    model = edit(model, 'r4', 'c1', '=A3');
    expect(cellValue(model, 'r3', 'c1')).toBe('#CIRCULAR!');
    expect(cellValue(model, 'r4', 'c1')).toBe('#CIRCULAR!');
  });
});

describe('🔑 δομικές πράξεις — η υπόσχεση του §11 #7', () => {
  it('εισαγωγή γραμμής ΠΑΝΩ από τα δεδομένα δεν αλλάζει το αποτέλεσμα', () => {
    const withSum = edit(makeModel(), 'r3', 'c1', '=SUM(A1:A2)');
    expect(cellValue(withSum, 'r3', 'c1')).toBe(30);

    const grown = insertTableRow(withSum, 0);

    // Το αποτέλεσμα μένει 30: οι αναφορές δείχνουν σε **ταυτότητες**, όχι σε θέσεις.
    expect(cellValue(grown, 'r3', 'c1')).toBe(30);
  });

  it('…και η γραμμή τύπων δείχνει ΜΟΝΗ ΤΗΣ τη νέα διεύθυνση', () => {
    const withSum = edit(makeModel(), 'r3', 'c1', '=SUM(A1:A2)');
    expect(cellInputText(withSum, 'r3', 'c1')).toBe('=SUM(A1:A2)');

    const grown = insertTableRow(withSum, 0);
    // Κανείς δεν ξαναέγραψε τον τύπο — το `A1` απλώς λέγεται πλέον `A2`.
    expect(cellInputText(grown, 'r3', 'c1')).toBe('=SUM(A2:A3)');
  });

  it('…και ο ΕΠΟΜΕΝΟΣ υπολογισμός διαβάζει ακόμα τα σωστά κελιά', () => {
    const withSum = edit(makeModel(), 'r3', 'c1', '=SUM(A1:A2)');
    const grown = insertTableRow(withSum, 0);

    // Το `r1` έχει μετακινηθεί στη θέση 2 (λέγεται πλέον `A2`) — ο τύπος το βρίσκει.
    const changed = edit(grown, 'r1', 'c1', '100');
    expect(cellValue(changed, 'r3', 'c1')).toBe(120);
  });

  it('εύρος ΜΕΣΑ στο οποίο μπήκε γραμμή επεκτείνεται, όπως στο Excel', () => {
    const withSum = edit(makeModel(), 'r3', 'c1', '=SUM(A1:A2)');
    // Νέα γραμμή **ανάμεσα** στα δύο άκρα του εύρους.
    const grown = insertTableRow(withSum, 1);
    expect(cellInputText(grown, 'r3', 'c1')).toBe('=SUM(A1:A3)');

    const [newRowId] = grown.rows.filter((row) => !ROWS.some((old) => old.id === row.id));
    const filled = edit(grown, newRowId.id, 'c1', '5');
    // Το νέο κελί μετρά: το εύρος είναι ορθογώνιο **θέσεων** ανάμεσα σε δύο ταυτότητες.
    expect(cellValue(filled, 'r3', 'c1')).toBe(35);
  });
});

function cellValue(model: PersistedTableModel, rowId: string, colId: string) {
  return model.cells.find(([r, c]) => r === rowId && c === colId)?.[2].value;
}
