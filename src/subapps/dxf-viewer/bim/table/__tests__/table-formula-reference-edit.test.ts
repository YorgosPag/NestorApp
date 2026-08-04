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
  toggleFormulaReferenceAbsolute,
} from '../formula/table-formula-reference-edit';

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

/** 5×5 ⇒ το `E4` του στιγμιότυπου είναι **υπαρκτό** κελί. Δες `table-formula-point-state.test`. */
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

// ──────────────────────────────────────────────────────────────────────────────
// ADR-754 Γ3 — το `F4`
// ──────────────────────────────────────────────────────────────────────────────

/**
 * 🔴 **Το `F4` δουλεύει πάνω στην αναφορά που ο χρήστης ΒΛΕΠΕΙ φωτισμένη.**
 *
 * Δεν είναι λεπτομέρεια υλοποίησης: η ίδια συνάρτηση (`tableFormulaReferenceSpans`) που
 * ζωγραφίζει τα χρωματιστά περιγράμματα της Φάσης Β1 απαντά και εδώ. Ένας δεύτερος «ελαφρύς»
 * σαρωτής θα κλείδωνε άλλη αναφορά από εκείνη που είναι φωτισμένη μπροστά του — δηλαδή θα
 * έκανε την οθόνη να λέει ψέματα για το τι πρόκειται να αλλάξει.
 */
describe('🔴 Γ3 — `F4`: ποια αναφορά είναι «του δρομέα»', () => {
  const f4 = (draft: string, caret: number) =>
    toggleFormulaReferenceAbsolute(MODEL, draft, caret);

  it('ο κύκλος, με τον δρομέα στο τέλος της αναφοράς', () => {
    let draft = '=A1';
    const seen: string[] = [];
    for (let i = 0; i < 5; i++) {
      seen.push(draft);
      draft = f4(draft, draft.length)!.draft;
    }
    expect(seen).toEqual(['=A1', '=$A$1', '=A$1', '=$A1', '=A1']);
  });

  /**
   * 🔑 Ο δρομέας κάθεται **αμέσως μετά** την αναφορά μόλις αυτή πληκτρολογηθεί ή μπει με
   * υπόδειξη (§4). Αν το διάστημα δεν ήταν κλειστό στο δεξί άκρο, η **συνηθέστερη χρήση όλων**
   * —γράφω `=A1`, πατώ `F4`— δεν θα δούλευε καθόλου.
   */
  it.each([
    [1, 'στην αρχή της αναφοράς'],
    [2, 'ανάμεσα στο γράμμα και τον αριθμό'],
    [3, '🔑 ΑΜΕΣΩΣ ΜΕΤΑ — εκεί που τον αφήνει η πληκτρολόγηση'],
  ])('«=A1» με δρομέα στο %i (%s) ⇒ «=$A$1»', (caret) => {
    expect(f4('=A1', caret)?.draft).toBe('=$A$1');
  });

  it('🔴 ο δρομέας μένει στο ΤΕΛΟΣ της αναφοράς — το μήκος της άλλαξε', () => {
    expect(f4('=A1', 3)).toEqual({ draft: '=$A$1', caretIndex: 5 });
  });

  it('διαλέγει τη ΣΩΣΤΗ από πολλές — «=A1+B2» με δρομέα στο B2', () => {
    expect(f4('=A1+B2', 6)?.draft).toBe('=A1+$B$2');
  });

  it('και την πρώτη, όταν ο δρομέας είναι εκεί', () => {
    expect(f4('=A1+B2', 3)?.draft).toBe('=$A$1+B2');
  });

  /**
   * ⚠️ Ένα εύρος αλλάζει ως **ένα**: μισοκλειδωμένο εύρος (`$A$1:B5`) είναι κατάσταση που τα
   * ίδια πατήματα στο Excel **δεν μπορούν να παραγάγουν**.
   */
  it('🔑 το ΕΥΡΟΣ κλειδώνει ΟΛΟΚΛΗΡΟ — «=SUM(A1:B2)» ⇒ «=SUM($A$1:$B$2)»', () => {
    expect(f4('=SUM(A1:B2)', 9)?.draft).toBe('=SUM($A$1:$B$2)');
  });

  it('η μορφή του ΕΥΡΟΥΣ διαβάζεται από το πρώτο άκρο', () => {
    expect(f4('=SUM($A$1:$B$2)', 13)?.draft).toBe('=SUM(A$1:B$2)');
  });

  it('η υπόλοιπη γραμμή δεν πειράζεται καθόλου', () => {
    expect(f4('=SUM(A1:B2)*2+C3', 9)?.draft).toBe('=SUM($A$1:$B$2)*2+C3');
  });
});

describe('🔴 Γ3 — πότε το `F4` ΔΕΝ κάνει τίποτα', () => {
  it.each([
    ['σκέτο κείμενο', 'Δοκός C25', 5],
    ['αριθμός, όχι αναφορά', '=1+2', 2],
    ['όνομα συνάρτησης', '=SUM(A1)', 3],
    ['κελί ΕΚΤΟΣ πλέγματος', '=Z99', 4],
    ['δρομέας μακριά από κάθε αναφορά', '=A1+123', 7],
  ])('%s ⇒ null (ο καλών δεν γράφει τίποτα)', (_name, draft, caret) => {
    expect(toggleFormulaReferenceAbsolute(MODEL, draft, caret)).toBeNull();
  });

  /**
   * 🔑 **Το κενό που θα ήταν εύκολο να χαθεί**: το `SUM` περνά τη μορφή «γράμματα+ψηφία» μόνο
   * αν υπάρχει στήλη `SU`… αλλά το `A1` του ορίσματος είναι πραγματική αναφορά. Ο δρομέας
   * πάνω στο όνομα της συνάρτησης **δεν** επιτρέπεται να κλειδώσει το όρισμα.
   */
  it('🔴 δρομέας πάνω στο όνομα συνάρτησης ⇒ δεν αγγίζει το όρισμά της', () => {
    expect(toggleFormulaReferenceAbsolute(MODEL, '=SUM(A1)', 2)).toBeNull();
  });
});
