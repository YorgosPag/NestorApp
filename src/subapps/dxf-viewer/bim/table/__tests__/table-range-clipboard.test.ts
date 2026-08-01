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
import { createTableModel, getPersistedCellText, toPersistedTableModel } from '../table-model-helpers';
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
    const result = pasteTsvIntoTable(persisted(), ref('r1', 'c1'), [['x', 'y']]);
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
    const result = pasteTsvIntoTable(before, ref('r0', 'c0'), [
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
    pasteTsvIntoTable(before, ref('r0', 'c0'), [['νέο', 'x']]);
    expect(readGrid(before)).toEqual(snapshot);
  });

  it('επικόλληση ΙΔΙΩΝ τιμών ⇒ το ΙΔΙΟ μοντέλο by-reference (καμία εντολή, κανένα undo)', () => {
    const before = persisted([text('r0', 'c0', 'ίδιο')]);
    expect(pasteTsvIntoTable(before, ref('r0', 'c0'), [['ίδιο']]).model).toBe(before);
  });

  // ── §4.3: κόβεται, δεν μεγαλώνει ─────────────────────────────────────────

  it('🔴 §4.3 — ό,τι δεν χωράει ΚΟΒΕΤΑΙ· ο πίνακας ΔΕΝ αποκτά γραμμές', () => {
    // 3 γραμμές προσφέρονται με αφετηρία την τελευταία ⇒ χωράει **μία**.
    const result = pasteTsvIntoTable(persisted(), ref('r2', 'c0'), [['α'], ['β'], ['γ']]);

    expect({ offered: result.offeredRows, fitted: result.fittedRows }).toEqual({ offered: 3, fitted: 1 });
    expect(readGrid(result.model)).toEqual([
      ['', '', ''],
      ['', '', ''],
      ['α', '', ''],
    ]);
  });

  it('§4.3 — το ίδιο κατά ΣΤΗΛΕΣ', () => {
    const result = pasteTsvIntoTable(persisted(), ref('r0', 'c2'), [['α', 'β', 'γ']]);
    expect({ offered: result.offeredColumns, fitted: result.fittedColumns }).toEqual({
      offered: 3,
      fitted: 1,
    });
    expect(readGrid(result.model)[0]).toEqual(['', '', 'α']);
  });

  it('πλέγμα που χωράει ολόκληρο δεν αναφέρει καμία απώλεια', () => {
    const result = pasteTsvIntoTable(persisted(), ref('r0', 'c0'), [['α', 'β']]);
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
    const result = pasteTsvIntoTable(persisted([], [merge]), ref('r0', 'c0'), [['α', 'β', 'γ']]);

    expect(result.skippedMergedCells).toBe(2);
    expect(readGrid(result.model)[0]).toEqual(['α', '', '']);
  });

  // ── Ανθεκτικότητα ────────────────────────────────────────────────────────

  it('ακανόνιστο πλέγμα: κοντή γραμμή ΔΕΝ σβήνει τα κελιά για τα οποία δεν πρόσφερε τιμή', () => {
    const before = persisted([text('r1', 'c1', 'μένει')]);
    const result = pasteTsvIntoTable(before, ref('r0', 'c0'), [['α', 'β'], ['γ']]);
    expect(readGrid(result.model)).toEqual([
      ['α', 'β', ''],
      ['γ', 'μένει', ''],
      ['', '', ''],
    ]);
  });

  it('κενό πλέγμα ⇒ τίποτα δεν αλλάζει, τίποτα δεν σβήνεται', () => {
    const before = persisted([text('r0', 'c0', 'μένει')]);
    expect(pasteTsvIntoTable(before, ref('r0', 'c0'), []).model).toBe(before);
  });

  it('μπαγιάτικο ενεργό κελί ⇒ μηδέν γραμμένα, ίδιο μοντέλο — ποτέ σιωπηλή επιτυχία', () => {
    const before = persisted();
    const result = pasteTsvIntoTable(before, ref('r9', 'c9'), [['α']]);
    expect({ model: result.model, fitted: result.fittedRows }).toEqual({ model: before, fitted: 0 });
  });

  it('κενό κελί στο προσφερόμενο πλέγμα ΣΒΗΝΕΙ τον προορισμό — είναι υπαρκτή τιμή', () => {
    const before = persisted([text('r0', 'c0', 'παλιό')]);
    expect(getPersistedCellText(pasteTsvIntoTable(before, ref('r0', 'c0'), [['']]).model, 'r0', 'c0')).toBe('');
  });
});

// ── Delete πάνω σε περιοχή ──────────────────────────────────────────────────

describe('clearTableRange — το Delete αδειάζει ΟΛΗ την περιοχή, με ένα undo', () => {
  it('αδειάζει κάθε κελί μέσα στα όρια και μόνο αυτά', () => {
    const before = persisted([text('r0', 'c0', 'μέσα'), text('r2', 'c2', 'έξω')]);
    const after = clearTableRange(before, { firstRow: 0, lastRow: 1, firstCol: 0, lastCol: 1 });
    expect(readGrid(after)).toEqual([
      ['', '', ''],
      ['', '', ''],
      ['', '', 'έξω'],
    ]);
  });

  it('ήδη κενή περιοχή ⇒ ΙΔΙΟ μοντέλο by-reference (κανένα βήμα undo από το πουθενά)', () => {
    const before = persisted();
    expect(clearTableRange(before, FULL)).toBe(before);
  });
});
