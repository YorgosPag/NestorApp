/**
 * ADR-754 §2 — **εισαγωγή vs αντικατάσταση**, και η ονομασία που μπαίνει.
 *
 * Το κεντρικό εδώ είναι η αλυσίδα «κλικ, κλικ, κλικ»: χωρίς την αντικατάσταση ο χρήστης που
 * διορθώνει την επιλογή του θα έγραφε `=E4E3E7`. Είναι η συμπεριφορά που ξεχωρίζει την
 * υπόδειξη από μια απλή «εισαγωγή κειμένου στον δρομέα».
 */

import { createTableModel } from '../table-model-helpers';
import type { TableColumn, TableModel, TableRow } from '../../../types/table';
import { resolveFormulaPointState } from '../formula/table-formula-point-state';
import {
  applyPointedReference,
  pointedCellReference,
  pointedRangeReference,
} from '../formula/table-formula-reference-edit';

const COLUMNS: TableColumn[] = ['c1', 'c2', 'c3'].map((id) => ({
  id,
  sizing: { kind: 'fixed', widthMm: 20 },
  valueType: 'number',
  align: 'right',
}));

const ROWS: TableRow[] = ['r1', 'r2', 'r3'].map((id) => ({ id, rowClass: 'data', heightMm: 8 }));

const MODEL: TableModel = createTableModel({ columns: COLUMNS, rows: ROWS, cells: [] });

const AT = (row: number, col: number) => ({ rowId: ROWS[row].id, colId: COLUMNS[col].id });

/** Ένα ολόκληρο κλικ: πού είναι ο δρομέας → τι σημαίνει → τι γράφεται. */
function click(draft: string, caretIndex: number, reference: string) {
  const state = resolveFormulaPointState(MODEL, draft, caretIndex);
  return applyPointedReference(draft, state, reference);
}

describe('ονομασία — τι κείμενο μπαίνει', () => {
  it('κλικ σε κελί ⇒ η άγκυρά του', () => {
    expect(pointedCellReference(MODEL, AT(1, 1))).toBe('B2');
  });

  it('σύρσιμο ⇒ εύρος, κανονικοποιημένο ανεξάρτητα από τη φορά', () => {
    expect(pointedRangeReference(MODEL, AT(0, 0), AT(2, 2))).toBe('A1:C3');
    expect(pointedRangeReference(MODEL, AT(2, 2), AT(0, 0))).toBe('A1:C3');
  });

  it('σύρσιμο που δεν κινήθηκε ⇒ σκέτο κελί, όχι «A1:A1»', () => {
    expect(pointedRangeReference(MODEL, AT(0, 0), AT(0, 0))).toBe('A1');
  });

  it('ταυτότητα εκτός μοντέλου ⇒ τίποτα, ποτέ μαντεψιά', () => {
    expect(pointedCellReference(MODEL, { rowId: 'σβησμένη', colId: 'c1' })).toBeNull();
  });
});

describe('ΕΙΣΑΓΩΓΗ — η γραμματική περίμενε τελεστέο', () => {
  it('μετά το «=» μπαίνει η αναφορά και ο δρομέας πάει μετά', () => {
    expect(click('=', 1, 'E4')).toEqual({ draft: '=E4', caretIndex: 3 });
  });

  it('μετά από τελεστή προστίθεται ΔΕΥΤΕΡΗ αναφορά — δεν χάνεται η πρώτη', () => {
    expect(click('=E4+', 4, 'B2')).toEqual({ draft: '=E4+B2', caretIndex: 6 });
  });

  it('μέσα σε συνάρτηση, με κείμενο ΔΕΞΙΑ του δρομέα', () => {
    expect(click('=SUM()', 5, 'A1')).toEqual({ draft: '=SUM(A1)', caretIndex: 7 });
  });
});

describe('ΑΝΤΙΚΑΤΑΣΤΑΣΗ — η αναφορά ήταν ακόμη ζωντανή', () => {
  it('δεύτερο κλικ διορθώνει, δεν συσσωρεύει', () => {
    expect(click('=E4', 3, 'B2')).toEqual({ draft: '=B2', caretIndex: 3 });
  });

  it('αντικαθίσταται ΜΟΝΟ η τελευταία αναφορά', () => {
    expect(click('=A1+E4', 6, 'C3')).toEqual({ draft: '=A1+C3', caretIndex: 6 });
  });

  it('🔑 τρία διαδοχικά κλικ αφήνουν ΕΝΑ ίχνος, όχι τρία', () => {
    const first = click('=', 1, 'A1');
    const second = click(first!.draft, first!.caretIndex, 'B2');
    const third = click(second!.draft, second!.caretIndex, 'C3');
    expect(third).toEqual({ draft: '=C3', caretIndex: 3 });
  });

  it('εύρος αντικαθιστά εύρος (σύρσιμο πάνω σε σύρσιμο)', () => {
    expect(click('=SUM(A1:B2', 10, 'A1:C3')).toEqual({ draft: '=SUM(A1:C3', caretIndex: 10 });
  });
});

describe('ΑΡΝΗΣΗ — το κλικ δεν ανήκει στην υπόδειξη', () => {
  it.each([
    ['σκέτο κείμενο', 'Δοκός', 5],
    ['μετά από αριθμό', '=1', 2],
    ['μετά από κλείσιμο', '=SUM(A1)', 8],
  ])('%s ⇒ null, ώστε ο καλών να αφήσει τη δέσμευση να τρέξει', (_name, draft, caret) => {
    expect(click(draft, caret, 'E4')).toBeNull();
  });
});
