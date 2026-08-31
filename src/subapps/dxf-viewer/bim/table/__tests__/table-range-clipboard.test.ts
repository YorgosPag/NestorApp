/**
 * ADR-739 Φ.Δ βήμα 8 — **αντιγραφή/επικόλληση περιοχής** (`table-range-clipboard.ts`).
 *
 * Εδώ κλειδώνουν οι σχεδιαστικές αποφάσεις που πήρε ο Giorgio, ως **εκτελέσιμη**
 * προδιαγραφή και όχι ως σχόλιο:
 *  - §4.3 «ό,τι δεν χωράει **κόβεται**· ο πίνακας **ΔΕΝ** μεγαλώνει μόνος του»
 *  - §4.4 «**ΕΝΑ** undo για όλη την επικόλληση» — ελέγχεται ως **ένα** νέο μοντέλο
 *  - §6.4 «οι συγχωνεύσεις είναι το ρίσκο»
 */

import {
  clearTableRange,
  pasteTsvIntoTable,
  tableRangeToTsvGrid,
} from '../table-range-clipboard';
import {
  cellKey,
  createTableModel,
  getPersistedCellText,
  toPersistedTableModel,
} from '../table-model-helpers';
import { commitCellWrites, writeCellInput } from '../formula/table-formula-engine';
import { formatTsv, parseTsv } from '@/lib/spreadsheet/tsv';
import type {
  CellSpan,
  PersistedTableModel,
  TableCellEntry,
  TableColumn,
  TableColumnId,
  TableRow,
  TableRowId,
} from '../../../types/table';
import { bookOf, commitPendingForTest } from './formula-book-fixture';

const COLUMNS: TableColumn[] = ['c0', 'c1', 'c2'].map((id) => ({
  id,
  sizing: { kind: 'fixed', widthMm: 20 },
  valueType: 'text',
  align: 'left',
}));

const ROWS: TableRow[] = ['r0', 'r1', 'r2'].map((id) => ({ id, rowClass: 'data', heightMm: 8 }));

function persisted(cells: TableCellEntry[] = [], merges: CellSpan[] = []): PersistedTableModel {
  return toPersistedTableModel(createTableModel({ columns: COLUMNS, rows: ROWS, cells, merges }));
}

const text = (rowId: string, colId: string, value: string): TableCellEntry => [
  rowId as TableRowId,
  colId as TableColumnId,
  { kind: 'text', value },
];

const ref = (rowId: string, colId: string) => ({
  rowId: rowId as TableRowId,
  colId: colId as TableColumnId,
});

const FULL = { firstRow: 0, lastRow: 2, firstCol: 0, lastCol: 2 };

/** Ολόκληρο το μοντέλο ως πλέγμα κειμένου — για συγκρίσεις που διαβάζονται. */
function readGrid(model: PersistedTableModel): string[][] {
  return ROWS.map((row) => COLUMNS.map((col) => getPersistedCellText(model, row.id, col.id)));
}

// ── Αντιγραφή ───────────────────────────────────────────────────────────────

describe('tableRangeToTsvGrid — η περιοχή ως ορθογώνιο πλέγμα', () => {
  it('γεμάτα και κενά κελιά, σε σειρά γραμμή × στήλη', () => {
    const model = persisted([text('r0', 'c0', 'Α/Α'), text('r0', 'c2', 'Ποσότητα'), text('r1', 'c1', 'Πλάκα')]);
    expect(tableRangeToTsvGrid(model, FULL)).toEqual([
      ['Α/Α', '', 'Ποσότητα'],
      ['', 'Πλάκα', ''],
      ['', '', ''],
    ]);
  });

  it('υπο-περιοχή αντιγράφει μόνο ό,τι της ανήκει', () => {
    const model = persisted([text('r0', 'c0', 'έξω'), text('r1', 'c1', 'μέσα')]);
    expect(tableRangeToTsvGrid(model, { firstRow: 1, lastRow: 1, firstCol: 1, lastCol: 2 })).toEqual([
      ['μέσα', ''],
    ]);
  });

  /**
   * 🔴 Η συγχώνευση δίνει το κείμενό της στην **πρώτη** στήλη και κενά στις υπόλοιπες. Αν
   * παραλείπαμε τα καλυμμένα, το πλέγμα θα ήταν 1 στήλη αντί για 3 και ο πίνακας που
   * επικολλάται στο Excel θα έβγαινε με **μετατοπισμένες** τις επόμενες στήλες.
   */
  it('🔴 συγχωνευμένο κελί: κείμενο στην άγκυρα, ΚΕΝΑ στα καλυμμένα — το πλέγμα μένει ορθογώνιο', () => {
    const merge: CellSpan = { anchorRowId: 'r0', anchorColId: 'c0', rowSpan: 1, colSpan: 3 };
    const model = persisted([text('r0', 'c0', 'ΤΙΤΛΟΣ')], [merge]);
    expect(tableRangeToTsvGrid(model, { firstRow: 0, lastRow: 0, firstCol: 0, lastCol: 2 })).toEqual([
      ['ΤΙΤΛΟΣ', '', ''],
    ]);
  });

  it('ταξιδεύει σωστά μέσα από το TSV — κύκλος με κείμενο που θέλει εισαγωγικά', () => {
    const model = persisted([text('r0', 'c0', 'με\tστηλοθέτη'), text('r0', 'c1', 'απλό')]);
    const grid = tableRangeToTsvGrid(model, { firstRow: 0, lastRow: 0, firstCol: 0, lastCol: 1 });
    expect(parseTsv(formatTsv(grid))).toEqual(grid);
  });
});

// ── Επικόλληση ──────────────────────────────────────────────────────────────

describe('pasteTsvIntoTable — η γωνία είναι το ενεργό κελί', () => {
  it('γράφει το πλέγμα με πάνω-αριστερή γωνία το ενεργό κελί', () => {
    const result = pasteTsvIntoTable(bookOf(persisted()),persisted(), ref('r1', 'c1'), [['x', 'y']]);
    expect(readGrid(result.model)).toEqual([
      ['', '', ''],
      ['', 'x', 'y'],
      ['', '', ''],
    ]);
  });

  it('🔴 ΕΝΑ μοντέλο έξω — η βάση του «ένα undo» (§4.4)', () => {
    // Έξι κελιά γραμμένα, **ένα** αντικείμενο μοντέλου: ο καλών φτιάχνει ένα και μόνο
    // `UpdateEntityCommand`. Δεν υπάρχει ενδιάμεση κατάσταση να αναιρεθεί χωριστά.
    const before = persisted();
    const result = pasteTsvIntoTable(bookOf(before),before, ref('r0', 'c0'), [
      ['a', 'b', 'c'],
      ['d', 'e', 'f'],
    ]);
    expect(result.model).not.toBe(before);
    expect(readGrid(result.model)).toEqual([
      ['a', 'b', 'c'],
      ['d', 'e', 'f'],
      ['', '', ''],
    ]);
  });

  it('🔴 ΚΑΘΑΡΗ: το μοντέλο εισόδου δεν αγγίζεται', () => {
    const before = persisted([text('r0', 'c0', 'αρχικό')]);
    const snapshot = readGrid(before);
    pasteTsvIntoTable(bookOf(before),before, ref('r0', 'c0'), [['νέο', 'x']]);
    expect(readGrid(before)).toEqual(snapshot);
  });

  it('επικόλληση ΙΔΙΩΝ τιμών ⇒ το ΙΔΙΟ μοντέλο by-reference (καμία εντολή, κανένα undo)', () => {
    const before = persisted([text('r0', 'c0', 'ίδιο')]);
    expect(pasteTsvIntoTable(bookOf(before),before, ref('r0', 'c0'), [['ίδιο']]).model).toBe(before);
  });

  // ── §4.3: κόβεται, δεν μεγαλώνει ─────────────────────────────────────────

  it('🔴 §4.3 — ό,τι δεν χωράει ΚΟΒΕΤΑΙ· ο πίνακας ΔΕΝ αποκτά γραμμές', () => {
    // 3 γραμμές προσφέρονται με αφετηρία την τελευταία ⇒ χωράει **μία**.
    const result = pasteTsvIntoTable(bookOf(persisted()),persisted(), ref('r2', 'c0'), [['α'], ['β'], ['γ']]);

    expect({ offered: result.offeredRows, fitted: result.fittedRows }).toEqual({ offered: 3, fitted: 1 });
    expect(readGrid(result.model)).toEqual([
      ['', '', ''],
      ['', '', ''],
      ['α', '', ''],
    ]);
  });

  it('§4.3 — το ίδιο κατά ΣΤΗΛΕΣ', () => {
    const result = pasteTsvIntoTable(bookOf(persisted()),persisted(), ref('r0', 'c2'), [['α', 'β', 'γ']]);
    expect({ offered: result.offeredColumns, fitted: result.fittedColumns }).toEqual({
      offered: 3,
      fitted: 1,
    });
    expect(readGrid(result.model)[0]).toEqual(['', '', 'α']);
  });

  it('πλέγμα που χωράει ολόκληρο δεν αναφέρει καμία απώλεια', () => {
    const result = pasteTsvIntoTable(bookOf(persisted()),persisted(), ref('r0', 'c0'), [['α', 'β']]);
    expect({
      rows: result.fittedRows === result.offeredRows,
      cols: result.fittedColumns === result.offeredColumns,
      merged: result.skippedMergedCells,
    }).toEqual({ rows: true, cols: true, merged: 0 });
  });

  // ── §6.4: συγχωνεύσεις ───────────────────────────────────────────────────

  it('🔴 §6.4 — καλυμμένο κελί συγχώνευσης ΔΕΝ γράφεται, και αναφέρεται', () => {
    // Κείμενο σε καλυμμένο κελί δεν ζωγραφίζεται πουθενά: θα εξαφανιζόταν από την οθόνη
    // ενώ θα υπήρχε στο αρχείο — η χειρότερη δυνατή έκβαση.
    const merge: CellSpan = { anchorRowId: 'r0', anchorColId: 'c0', rowSpan: 1, colSpan: 3 };
    const result = pasteTsvIntoTable(bookOf(persisted([], [merge])),persisted([], [merge]), ref('r0', 'c0'), [['α', 'β', 'γ']]);

    expect(result.skippedMergedCells).toBe(2);
    expect(readGrid(result.model)[0]).toEqual(['α', '', '']);
  });

  // ── Ανθεκτικότητα ────────────────────────────────────────────────────────

  it('ακανόνιστο πλέγμα: κοντή γραμμή ΔΕΝ σβήνει τα κελιά για τα οποία δεν πρόσφερε τιμή', () => {
    const before = persisted([text('r1', 'c1', 'μένει')]);
    const result = pasteTsvIntoTable(bookOf(before),before, ref('r0', 'c0'), [['α', 'β'], ['γ']]);
    expect(readGrid(result.model)).toEqual([
      ['α', 'β', ''],
      ['γ', 'μένει', ''],
      ['', '', ''],
    ]);
  });

  it('κενό πλέγμα ⇒ τίποτα δεν αλλάζει, τίποτα δεν σβήνεται', () => {
    const before = persisted([text('r0', 'c0', 'μένει')]);
    expect(pasteTsvIntoTable(bookOf(before),before, ref('r0', 'c0'), []).model).toBe(before);
  });

  it('μπαγιάτικο ενεργό κελί ⇒ μηδέν γραμμένα, ίδιο μοντέλο — ποτέ σιωπηλή επιτυχία', () => {
    const before = persisted();
    const result = pasteTsvIntoTable(bookOf(before),before, ref('r9', 'c9'), [['α']]);
    expect({ model: result.model, fitted: result.fittedRows }).toEqual({ model: before, fitted: 0 });
  });

  it('κενό κελί στο προσφερόμενο πλέγμα ΣΒΗΝΕΙ τον προορισμό — είναι υπαρκτή τιμή', () => {
    const before = persisted([text('r0', 'c0', 'παλιό')]);
    expect(getPersistedCellText(pasteTsvIntoTable(bookOf(before),before, ref('r0', 'c0'), [['']]).model, 'r0', 'c0')).toBe('');
  });
});

// ── Delete πάνω σε περιοχή ──────────────────────────────────────────────────

describe('clearTableRange — το Delete αδειάζει ΟΛΗ την περιοχή, με ένα undo', () => {
  it('αδειάζει κάθε κελί μέσα στα όρια και μόνο αυτά', () => {
    const before = persisted([text('r0', 'c0', 'μέσα'), text('r2', 'c2', 'έξω')]);
    const after = clearTableRange(bookOf(before),before, { firstRow: 0, lastRow: 1, firstCol: 0, lastCol: 1 });
    expect(readGrid(after)).toEqual([
      ['', '', ''],
      ['', '', ''],
      ['', '', 'έξω'],
    ]);
  });

  it('ήδη κενή περιοχή ⇒ ΙΔΙΟ μοντέλο by-reference (κανένα βήμα undo από το πουθενά)', () => {
    const before = persisted();
    expect(clearTableRange(bookOf(before),before, FULL)).toBe(before);
  });
});

// ── ADR-739 §47 — το πρόχειρο ΜΙΛΑΕΙ με τη μηχανή τύπων ─────────────────────

/**
 * 🔴 Οι δύο σιωπηλές αστοχίες που έζησαν εδώ ως το 2026-08-05, ως **εκτελέσιμη** απόδειξη.
 *
 * Καμία από τις δύο δεν πετούσε εξαίρεση και καμία δεν έβαφε test κόκκινο: και οι δύο
 * παρήγαν **λάθος νούμερα σε πίνακα ποσοτήτων**, δηλαδή το είδος σφάλματος που φτάνει
 * αυτούσιο σε παραδοτέο. Γι' αυτό τα tests ελέγχουν την **τιμή** του εξαρτημένου κελιού και
 * όχι τη μορφή του: η τιμή είναι ό,τι βλέπει ο χρήστης και ό,τι εξάγεται στο DXF.
 *
 * `A3 = SUM(A1:A2)` σε πλέγμα 3 × 3 — στήλες `c0 c1 c2` = `A B C`, γραμμές `r0 r1 r2` = `1 2 3`.
 */
const TOTAL = ref('r2', 'c0');

/** Πίνακας με **ζωντανό** τύπο στο `A3`, ήδη υπολογισμένο (όπως θα ερχόταν από commit). */
function withTotalFormula(cells: TableCellEntry[] = []): PersistedTableModel {
  return commitPendingForTest(writeCellInput(bookOf(persisted(cells)),persisted(cells), TOTAL.rowId, TOTAL.colId, '=SUM(A1:A2)'));
}

const totalOf = (model: PersistedTableModel): string =>
  getPersistedCellText(model, TOTAL.rowId, TOTAL.colId);

describe('🔴 επικόλληση ⇒ ΕΠΑΝΑΫΠΟΛΟΓΙΣΜΟΣ των τύπων που διαβάζουν τα κελιά', () => {
  it('αριθμοί επικολλημένοι σε στήλη ανανεώνουν το άθροισμα που την διαβάζει', () => {
    const before = withTotalFormula([text('r0', 'c0', '1'), text('r1', 'c0', '2')]);
    expect(totalOf(before)).toBe('3');

    const after = pasteTsvIntoTable(bookOf(before),before, ref('r0', 'c0'), [['5'], ['7']]).model;
    expect(totalOf(after)).toBe('12');
  });

  it('ο τύπος ανανεώνεται ΚΑΙ όταν η επικόλληση αγγίζει μόνο ΜΕΡΟΣ του εύρους του', () => {
    const before = withTotalFormula([text('r0', 'c0', '1'), text('r1', 'c0', '2')]);
    const after = pasteTsvIntoTable(bookOf(before),before, ref('r1', 'c0'), [['10']]).model;
    expect(totalOf(after)).toBe('11');
  });

  it('επικόλληση εκτός του εύρους ⇒ ο τύπος ΔΕΝ αλλάζει (καμία επινοημένη διάδοση)', () => {
    const before = withTotalFormula([text('r0', 'c0', '1'), text('r1', 'c0', '2')]);
    const after = pasteTsvIntoTable(bookOf(before),before, ref('r0', 'c1'), [['999']]).model;
    expect(totalOf(after)).toBe('3');
  });

  it('ίδιες τιμές ⇒ ΙΔΙΟ μοντέλο by-reference, παρότι υπάρχει τύπος στον πίνακα', () => {
    const before = withTotalFormula([text('r0', 'c0', '1'), text('r1', 'c0', '2')]);
    expect(pasteTsvIntoTable(bookOf(before),before, ref('r0', 'c0'), [['1'], ['2']]).model).toBe(before);
  });
});

describe('🔴 επικόλληση ⇒ το `=` ΑΝΑΓΝΩΡΙΖΕΤΑΙ, όπως και από το πληκτρολόγιο', () => {
  it('κείμενο `=SUM(A1:A2)` από το πρόχειρο γίνεται ΤΥΠΟΣ και δίνει το αποτέλεσμά του', () => {
    const before = persisted([text('r0', 'c0', '4'), text('r1', 'c0', '6')]);
    const after = pasteTsvIntoTable(bookOf(before),before, TOTAL, [['=SUM(A1:A2)']]).model;
    // '10' ⇒ έγινε τύπος. '=SUM(A1:A2)' ⇒ αποθηκεύτηκε ωμό κείμενο (η παλιά συμπεριφορά).
    expect(totalOf(after)).toBe('10');
  });

  it('τύπος που ΔΕΝ αναλύεται μένει κείμενο αυτούσιο — τίποτα δεν χάνεται', () => {
    const after = pasteTsvIntoTable(bookOf(persisted()),persisted(), ref('r0', 'c0'), [['=1+']]).model;
    expect(getPersistedCellText(after, 'r0' as TableRowId, 'c0' as TableColumnId)).toBe('=1+');
  });

  it('επικολλημένος τύπος υπολογίζεται ΜΑΖΙ με τα δεδομένα της ίδιας επικόλλησης', () => {
    // Ένα πέρασμα: τα `3`/`4` και ο τύπος που τα αθροίζει έρχονται στο ΙΔΙΟ πλέγμα. Χωρίς
    // τον επαναϋπολογισμό στο τέλος, ο τύπος θα διάβαζε κελιά που δεν είχαν γραφτεί ακόμα.
    const after = pasteTsvIntoTable(bookOf(persisted()),persisted(), ref('r0', 'c0'), [
      ['3'],
      ['4'],
      ['=SUM(A1:A2)'],
    ]).model;
    expect(totalOf(after)).toBe('7');
  });
});

describe('🔴 Delete σε περιοχή ⇒ ΕΠΑΝΑΫΠΟΛΟΓΙΣΜΟΣ (η ίδια κλάση σφάλματος)', () => {
  it('άδειασμα της στήλης μηδενίζει το άθροισμα που τη διάβαζε', () => {
    const before = withTotalFormula([text('r0', 'c0', '1'), text('r1', 'c0', '2')]);
    const after = clearTableRange(bookOf(before),before, { firstRow: 0, lastRow: 1, firstCol: 0, lastCol: 0 });
    expect(totalOf(after)).toBe('0');
  });

  it('άδειασμα εκτός του εύρους ⇒ ο τύπος ΔΕΝ αλλάζει', () => {
    const before = withTotalFormula([text('r0', 'c0', '1'), text('r1', 'c0', '2'), text('r0', 'c2', 'x')]);
    const after = clearTableRange(bookOf(before),before, { firstRow: 0, lastRow: 0, firstCol: 2, lastCol: 2 });
    expect(totalOf(after)).toBe('3');
  });
});
