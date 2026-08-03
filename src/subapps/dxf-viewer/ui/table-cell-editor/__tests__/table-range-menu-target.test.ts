/**
 * ADR-750 Φάση 4, απόφαση **Α22** — **τι βάφει το δεξί κλικ μέσα στο πλέγμα**.
 *
 * Ο κανόνας σε μία γραμμή: *το κελί, εκτός αν ανήκει στην επιλογή — τότε όλη η επιλογή.*
 *
 * Είναι η σημασιολογία του Excel χωρίς την παρενέργειά του (το Excel τη συμπεραίνει
 * **μετακινώντας** την επιλογή στο κελί που πατήθηκε· εδώ το δεξί κλικ δεν αγγίζει ποτέ την
 * επιλογή, ADR-739 §27.14). Δοκιμάζεται ως **καθαρή συνάρτηση**, γι' αυτό ακριβώς η επιλογή
 * περνά ως όρισμα και δεν διαβάζεται από το store μέσα της.
 */

import { resolveTableModel } from '../../../bim/table/table-model-helpers';
import { rangeLabel, tableBorderTargetBounds } from '../use-table-range-menu';
import type { TableSelectionSpan } from '../../../bim/table/table-cell-range';
import type { CellSpan, PersistedTableModel, TableColumn, TableRow } from '../../../types/table';

function model(rowCount: number, colCount: number, merges: readonly CellSpan[] = []) {
  const columns: TableColumn[] = Array.from({ length: colCount }, (_, c) => ({
    id: `c${c + 1}`,
    sizing: { kind: 'fixed', widthMm: 10 },
    valueType: 'text',
    align: 'left',
  }));
  const rows: TableRow[] = Array.from({ length: rowCount }, (_, r) => ({
    id: `r${r + 1}`,
    rowClass: 'data',
    heightMm: 6,
  }));
  const persisted: PersistedTableModel = { columns, rows, cells: [], merges };
  return resolveTableModel(persisted);
}

const cell = (row: number, col: number) => ({ rowId: `r${row}`, colId: `c${col}` });

/** Επιλογή περιοχής B2:D4 σε δείκτες `{firstRow:1,lastRow:3,firstCol:1,lastCol:3}`. */
const B2_D4: TableSelectionSpan = { from: cell(2, 2), to: cell(4, 4), kind: 'range' };

describe('Α22 — ο στόχος του δεξιού κλικ σε κελιά', () => {
  it('κλικ ΜΕΣΑ στην επιλογή ⇒ στόχος ΟΛΗ η επιλογή', () => {
    expect(tableBorderTargetBounds(model(6, 6), cell(3, 3), B2_D4)).toEqual({
      firstRow: 1, lastRow: 3, firstCol: 1, lastCol: 3,
    });
  });

  it('🔴 κλικ ΕΞΩ από την επιλογή ⇒ στόχος ΜΟΝΟ το κελί, όχι η μακρινή επιλογή', () => {
    // Η εναλλακτική «πάντα η τρέχουσα επιλογή» θα έβαφε το B2:D4 ενώ ο δείκτης είναι στο E5 —
    // αλλαγή μακριά από το σημείο που κοιτά ο χρήστης, χωρίς καμία ένδειξη.
    expect(tableBorderTargetBounds(model(6, 6), cell(5, 5), B2_D4)).toEqual({
      firstRow: 4, lastRow: 4, firstCol: 4, lastCol: 4,
    });
  });

  it('καμία επιλογή ⇒ στόχος το κελί — η κύρια περίπτωση χρήσης', () => {
    expect(tableBorderTargetBounds(model(6, 6), cell(2, 3), null)).toEqual({
      firstRow: 1, lastRow: 1, firstCol: 2, lastCol: 2,
    });
  });

  it('κλικ σε γωνία της επιλογής μετράει ως ΜΕΣΑ (κλειστό διάστημα)', () => {
    expect(tableBorderTargetBounds(model(6, 6), cell(2, 2), B2_D4)).toEqual({
      firstRow: 1, lastRow: 3, firstCol: 1, lastCol: 3,
    });
    expect(tableBorderTargetBounds(model(6, 6), cell(4, 4), B2_D4)).toEqual({
      firstRow: 1, lastRow: 3, firstCol: 1, lastCol: 3,
    });
  });

  it('επιλογή ΟΛΟΚΛΗΡΗΣ στήλης: κλικ μέσα της δίνει τη στήλη ολόκληρη', () => {
    const column: TableSelectionSpan = { from: cell(1, 2), to: cell(6, 2), kind: 'column' };
    expect(tableBorderTargetBounds(model(6, 6), cell(4, 2), column)).toEqual({
      firstRow: 0, lastRow: 5, firstCol: 1, lastCol: 1,
    });
  });

  it('🔑 συγχωνευμένο κελί: ο στόχος κουμπώνει σε ΟΛΗ τη συγχώνευση, δωρεάν', () => {
    // Δώρο από τον ΕΝΑ δρόμο ερμηνείας: το μεμονωμένο κελί περνά με είδος `'range'`, άρα
    // κληρονομεί το κούμπωμα του ADR-739 §26.5 χωρίς μία γραμμή ειδικής λογικής.
    const merges: readonly CellSpan[] = [
      { anchorRowId: 'r2', anchorColId: 'c2', rowSpan: 2, colSpan: 3 },
    ];
    expect(tableBorderTargetBounds(model(6, 6, merges), cell(2, 2), null)).toEqual({
      firstRow: 1, lastRow: 2, firstCol: 1, lastCol: 3,
    });
  });

  it('μπαγιάτικο κελί (σβησμένη γραμμή μετά από undo) ⇒ `null`, ποτέ μαντεψιά', () => {
    expect(tableBorderTargetBounds(model(3, 3), cell(9, 1), null)).toBeNull();
  });
});

describe('η ετικέτα μιλά τη γλώσσα του χρήστη (Α5)', () => {
  it('ένα κελί ⇒ σκέτο όνομα· περιοχή ⇒ δύο γωνίες', () => {
    expect(rangeLabel({ firstRow: 2, lastRow: 2, firstCol: 2, lastCol: 2 })).toBe('C3');
    expect(rangeLabel({ firstRow: 1, lastRow: 3, firstCol: 1, lastCol: 3 })).toBe('B2:D4');
  });

  it('η αρίθμηση αρχίζει από το 1 και τα γράμματα από το A — όπως οι ζώνες δείκτη', () => {
    expect(rangeLabel({ firstRow: 0, lastRow: 0, firstCol: 0, lastCol: 0 })).toBe('A1');
  });

  it('ποτέ δεν λέει τη λέξη «ακμή» — ούτε σε περιοχή μιας γραμμής', () => {
    expect(rangeLabel({ firstRow: 0, lastRow: 0, firstCol: 0, lastCol: 4 })).toBe('A1:E1');
  });
});
