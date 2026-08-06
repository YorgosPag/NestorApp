/**
 * 🔴 ADR-763 Φ2.4 — **ΤΟ ΚΛΙΚ ΣΕ ΚΕΛΙ ΓΡΑΦΕΙ ΣΤΟ ΕΝΕΡΓΟ ΟΡΙΣΜΑ.**
 *
 * Το αρχείο γράφτηκε **πριν** από την καλωδίωση, επίτηδες: η μετατόπιση «+1 στην ερώτηση, −1
 * στην απάντηση» ήταν **υπόθεση δύο συνεδριών** που κανείς δεν είχε εκτελέσει. Εδώ εκτελείται.
 *
 * Τι πιάνει κάθε ομάδα, αν σπάσει:
 *  1. **η μετατόπιση** — αν λείψει, το κενό κουτί δίνει `off` (`caret 0 < bodyStart 1`) και το
 *     κλικ **δεν γράφει πουθενά**· αυτό ακριβώς ανέφερε ο ιδιοκτήτης.
 *  2. **η σειρά των δύο στόχων** — αν ο διάλογος ρωτηθεί δεύτερος, η διεύθυνση πάει στο
 *     **πρόχειρο του κελιού**, δηλαδή μέσα στο όνομα της συνάρτησης, σιωπηλά.
 *  3. **ο γραφέας** — αν γραφτεί απευθείας το πρόχειρο, τα κουτιά του διαλόγου και το κελί
 *     αποκλίνουν και η επόμενη πληκτρολόγηση σβήνει ό,τι έγραψε το ποντίκι.
 *
 * @see ui/table-cell-editor/table-point-target.ts
 */

import {
  __resetTableCellCursorStoreForTests,
  getTableCellCursor,
  setTableCellCursor,
} from '../../../state/table-cell-cursor-store';
import {
  __resetFunctionArgumentsDialogForTests,
  getFunctionArgumentsDialogState,
  openFunctionArgumentsDialog,
  setActiveFunctionArgument,
  setFunctionArgumentValue,
} from '../../../state/function-arguments-dialog-store';
import { functionArgumentFieldId } from '../../../ui/dialogs/function-argument-field';
import { resolveTablePointTarget } from '../../../ui/table-cell-editor/table-point-target';
import { resolveFormulaPointState } from '../formula/table-formula-point-state';
import { applyPointedReference } from '../formula/table-formula-reference-edit';
import { tableFormulaReferenceSpans } from '../formula/table-formula-reference-spans';
import { createTableModel } from '../table-model-helpers';
import { TABLE_CELL_SESSION_MARKER } from '../../../ui/table-cell-editor/table-cell-session-focus';
import type { TableColumn, TableModel, TableRow } from '../../../types/table';

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

/** Πλέγμα 5×5 ⇒ `A1`…`E5` υπαρκτά. Ίδιο μέγεθος με το `table-formula-point-state.test.ts`. */
const MODEL: TableModel = createTableModel({ columns: COLUMNS, rows: ROWS, cells: [] });

const POSITION = { rowIndex: 0, columnIndex: 3, anchorColumnIndex: 3 };

/** Το σημάδι συνεδρίας ως ζεύγος `[attribute, value]` — ο ΕΝΑΣ ορισμός, όχι ξαναγραμμένος. */
const [SESSION_ATTRIBUTE, SESSION_VALUE] = Object.entries(TABLE_CELL_SESSION_MARKER)[0];

/** Ο δρομέας σε ανοιχτή γραφή με το `=SUM()` που έγραψε η Φάση 1, και ο διάλογος πάνω του. */
function openArgumentsOnSum(): void {
  setTableCellCursor('table-1', POSITION, 'edit', '=SUM()', 5);
  openFunctionArgumentsDialog({
    functionName: 'SUM',
    frame: { prefix: '=SUM(', suffix: ')' },
    restore: { kind: 'navigation' },
  });
}

/**
 * Στήνει ένα εστιασμένο κουτί ορίσματος με τον κέρσορα στη θέση `caret`.
 *
 * Χρησιμοποιεί το **πραγματικό** `id` (και όχι δικό του κείμενο), ώστε μια μετονομασία να
 * σπάει εδώ αντί να σβήνει σιωπηλά τον κέρσορα στην παραγωγή.
 */
function focusArgumentField(index: number, value: string, caret: number): HTMLInputElement {
  const input = document.createElement('input');
  input.id = functionArgumentFieldId(index);
  input.setAttribute(SESSION_ATTRIBUTE, SESSION_VALUE);
  input.value = value;
  document.body.appendChild(input);
  input.focus();
  input.setSelectionRange(caret, caret);
  return input;
}

/** Το πλήρες κύκλωμα: «τι σημαίνει το κλικ;» → «τι γίνεται το κείμενο;» → «ποιος το γράφει;». */
function pointAt(reference: string): void {
  const cursor = getTableCellCursor();
  if (cursor === null) throw new Error('χωρίς δρομέα δεν υπάρχει υπόδειξη');
  const target = resolveTablePointTarget(cursor);
  if (target === null) throw new Error('κανένας στόχος υπόδειξης');
  const state = resolveFormulaPointState(MODEL, target.formulaText, target.caretIndex);
  const edit = applyPointedReference(target.formulaText, state, reference);
  if (edit === null) throw new Error(`η υπόδειξη ήταν «${state.kind}»`);
  target.write(edit.draft, edit.caretIndex);
}

beforeEach(() => {
  __resetTableCellCursorStoreForTests();
  __resetFunctionArgumentsDialogForTests();
  document.body.innerHTML = '';
});

describe('Η ΜΕΤΑΤΟΠΙΣΗ — ένα πεδίο ορίσματος ΕΙΝΑΙ θραύσμα τύπου', () => {
  it.each([
    ['', 0, { kind: 'armed', at: 1 }],
    ['A1', 2, { kind: 'liveRef', from: 1, to: 3 }],
    ['A1+', 3, { kind: 'armed', at: 4 }],
    ['A1:', 3, { kind: 'armed', at: 4 }],
    ['A1:B2', 5, { kind: 'liveRef', from: 1, to: 6 }],
    ['SUM(', 4, { kind: 'armed', at: 5 }],
  ])('«%s» με κέρσορα %i ⇒ %o', (value, caret, expected) => {
    openArgumentsOnSum();
    setFunctionArgumentValue(0, value);
    focusArgumentField(0, value, caret);

    const cursor = getTableCellCursor();
    const target = resolveTablePointTarget(cursor as NonNullable<typeof cursor>);
    expect(target).not.toBeNull();
    expect(resolveFormulaPointState(MODEL, (target as TablePointTargetLike).formulaText,
      (target as TablePointTargetLike).caretIndex)).toEqual(expected);
  });

  /**
   * 🔴 Η γραμμή που δικαιολογεί ολόκληρη τη φάση: **κενό κουτί**. Πριν τη δρομολόγηση ο
   * κέρσορας ήταν `0` μετρημένος πάνω στο `=SUM()` ⇒ `0 < 1` ⇒ `off` ⇒ το κλικ δεν έγραφε
   * τίποτα. Είναι η **πρώτη** κατάσταση που συναντά κάθε χρήστης, κάθε φορά.
   */
  it('🔴 κενό κουτί ⇒ οπλισμένο (πριν τη Φ2.4 ήταν «off» και το κλικ σιωπούσε)', () => {
    openArgumentsOnSum();
    const cursor = getTableCellCursor();
    const target = resolveTablePointTarget(cursor as NonNullable<typeof cursor>);
    const state = resolveFormulaPointState(
      MODEL,
      (target as TablePointTargetLike).formulaText,
      (target as TablePointTargetLike).caretIndex,
    );
    expect(state.kind).toBe('armed');
    expect(resolveFormulaPointState(MODEL, '=SUM()', 0).kind).toBe('off');
  });
});

describe('Ο ΓΡΑΦΕΑΣ — η διεύθυνση μπαίνει στο κουτί ΚΑΙ στο κελί, σε μία πράξη', () => {
  it('κενό κουτί + κλικ ⇒ το όρισμα γίνεται «B2» και το κελί «=SUM(B2)»', () => {
    openArgumentsOnSum();
    pointAt('B2');
    expect(getFunctionArgumentsDialogState().values[0]).toBe('B2');
    expect(getTableCellCursor()?.draft).toBe('=SUM(B2)');
  });

  it('🔑 δεύτερο κλικ ΑΝΤΙΚΑΘΙΣΤΑ — ποτέ «B2C3»', () => {
    openArgumentsOnSum();
    pointAt('B2');
    pointAt('C3');
    expect(getFunctionArgumentsDialogState().values[0]).toBe('C3');
    expect(getTableCellCursor()?.draft).toBe('=SUM(C3)');
  });

  it('σύρσιμο ⇒ το εύρος αντικαθιστά ΟΛΟΚΛΗΡΟ, ποτέ «B2:B2:D4»', () => {
    openArgumentsOnSum();
    pointAt('B2');
    pointAt('B2:D4');
    expect(getFunctionArgumentsDialogState().values[0]).toBe('B2:D4');
    expect(getTableCellCursor()?.draft).toBe('=SUM(B2:D4)');
  });

  it('τελεστής μετά την αναφορά ⇒ το επόμενο κλικ ΕΙΣΑΓΕΙ, δεν αντικαθιστά', () => {
    openArgumentsOnSum();
    setFunctionArgumentValue(0, 'A1+');
    pointAt('C3');
    expect(getFunctionArgumentsDialogState().values[0]).toBe('A1+C3');
  });

  it('γράφει στο ΕΝΕΡΓΟ όρισμα, όχι πάντα στο πρώτο', () => {
    openArgumentsOnSum();
    setFunctionArgumentValue(0, 'A1');
    setActiveFunctionArgument(1);
    pointAt('E5');
    const values = getFunctionArgumentsDialogState().values;
    expect(values[0]).toBe('A1');
    expect(values[1]).toBe('E5');
    expect(getTableCellCursor()?.draft).toBe('=SUM(A1;E5)');
  });
});

describe('Η ΣΕΙΡΑ ΤΩΝ ΣΤΟΧΩΝ — ο διάλογος ρωτιέται ΠΡΩΤΟΣ', () => {
  it('🔴 με ανοιχτό διάλογο, το πρόχειρο του κελιού ΔΕΝ κρίνεται καθόλου', () => {
    openArgumentsOnSum();
    // Εστιασμένο πεδίο **του κελιού**: πριν τη δρομολόγηση, ο κέρσοράς του θα έκρινε το κλικ.
    const cell = document.createElement('textarea');
    cell.setAttribute(SESSION_ATTRIBUTE, SESSION_VALUE);
    cell.value = '=SUM()';
    document.body.appendChild(cell);
    cell.focus();
    cell.setSelectionRange(5, 5);

    pointAt('D4');
    expect(getFunctionArgumentsDialogState().values[0]).toBe('D4');
    expect(getTableCellCursor()?.draft).toBe('=SUM(D4)');
  });

  it('χωρίς διάλογο, ο στόχος είναι το πρόχειρο του κελιού', () => {
    setTableCellCursor('table-1', POSITION, 'edit', '=', 1);
    const cell = document.createElement('textarea');
    cell.setAttribute(SESSION_ATTRIBUTE, SESSION_VALUE);
    cell.value = '=';
    document.body.appendChild(cell);
    cell.focus();
    cell.setSelectionRange(1, 1);

    pointAt('C3');
    expect(getTableCellCursor()?.draft).toBe('=C3');
    expect(getFunctionArgumentsDialogState().open).toBe(false);
  });

  it('χωρίς διάλογο ΚΑΙ χωρίς εστιασμένο πεδίο ⇒ καμία υπόδειξη', () => {
    setTableCellCursor('table-1', POSITION, 'edit', '=', 1);
    const cursor = getTableCellCursor();
    expect(resolveTablePointTarget(cursor as NonNullable<typeof cursor>)).toBeNull();
  });
});

describe('§5.3 Η ΕΣΤΙΑΣΗ — ρητή απόφαση, όχι σιωπή', () => {
  it('κανένα κουτί εστιασμένο ⇒ ο κέρσορας θεωρείται στο ΤΕΛΟΣ και το κλικ γράφει', () => {
    openArgumentsOnSum();
    setFunctionArgumentValue(0, 'A1');
    // Καμία εστίαση πουθενά — π.χ. αμέσως μετά το `⬆` ή μετά από κλικ στην κάρτα.
    pointAt('C3');
    expect(getFunctionArgumentsDialogState().values[0]).toBe('C3');
  });

  it('εστιασμένο κουτί ⇒ κρίνει ο ΔΙΚΟΣ ΤΟΥ κέρσορας, όχι το τέλος', () => {
    openArgumentsOnSum();
    setFunctionArgumentValue(0, 'A1+B2');
    // Ο κέρσορας **αμέσως μετά το `A1`**: ζωντανή είναι εκείνη η αναφορά, όχι η τελευταία.
    // Με κέρσορα στο τέλος η ίδια πράξη θα έδινε `A1+E5` — η διαφορά ΕΙΝΑΙ το test.
    focusArgumentField(0, 'A1+B2', 2);
    pointAt('E5');
    expect(getFunctionArgumentsDialogState().values[0]).toBe('E5+B2');
  });

  /**
   * 🔑 Ο κέρσορας **μέσα σε λέξη που γράφεται ακόμη** (`A1+|B2`) δεν δίνει δικαίωμα στο κλικ —
   * ο ίδιος κανόνας που ισχύει και στο κελί (`continuesLexeme`, ADR-754 §1). Καταγράφεται εδώ
   * ως **απόφαση**: η δρομολόγηση της Φ2.4 δεν χαλαρώνει τη γραμματική, τη δανείζεται ακέραιη.
   */
  it('κέρσορας που κόβει λέξη ⇒ «off», ίδιος κανόνας με το κελί', () => {
    openArgumentsOnSum();
    setFunctionArgumentValue(0, 'A1+B2');
    focusArgumentField(0, 'A1+B2', 3);
    const cursor = getTableCellCursor();
    const target = resolveTablePointTarget(cursor as NonNullable<typeof cursor>);
    expect(resolveFormulaPointState(
      MODEL,
      (target as TablePointTargetLike).formulaText,
      (target as TablePointTargetLike).caretIndex,
    ).kind).toBe('off');
  });

  it('εστιασμένο ΑΛΛΟ κουτί ⇒ ο κέρσοράς του αγνοείται (άλλο σύστημα συντεταγμένων)', () => {
    openArgumentsOnSum();
    setFunctionArgumentValue(0, 'A1');
    focusArgumentField(1, '', 0);
    // Ενεργό είναι ακόμη το 0· ο κέρσορας του κουτιού 1 δεν επιτρέπεται να το κρίνει.
    pointAt('C3');
    expect(getFunctionArgumentsDialogState().values[0]).toBe('C3');
  });

  it('μπαγιάτικος κέρσορας πέρα από το μήκος ⇒ κόβεται, ποτέ σιωπηλό «off»', () => {
    openArgumentsOnSum();
    setFunctionArgumentValue(0, 'A1');
    focusArgumentField(0, 'A1++++', 6);
    pointAt('C3');
    expect(getFunctionArgumentsDialogState().values[0]).toBe('C3');
  });
});

/**
 * 🔴 ADR-763 Φ2.4 — **ΤΟ ΔΙΑΚΕΚΟΜΜΕΝΟ ΠΕΡΙΓΡΑΜΜΑ** (κελί `A4` στο στιγμιότυπο του Excel).
 *
 * ## Γιατί ΔΕΝ γράφτηκε ζωγράφος γι' αυτό
 * Το περίγραμμα **υπάρχει ήδη** και είναι το `stamp-table-formula-references` (ADR-754 Β1):
 * ζωγραφίζει διακεκομμένο πλαίσιο γύρω από **κάθε** κελί που διαβάζει ο τύπος του προχείρου.
 * Ένας δεύτερος ζωγράφος «για την υπόδειξη» θα ήταν τρίτος ορισμός του «ποια κελιά αφορά αυτός
 * ο τύπος» (N.18) — και θα διαφωνούσε με τον πρώτο τη μέρα που η γραμματική δεχτεί κάτι νέο.
 *
 * Ο **λόγος** που το περίγραμμα εμφανίζεται τώρα δεν είναι ζωγραφική: είναι ότι ο ΕΝΑΣ γραφέας
 * του διαλόγου ξαναγράφει το **πρόχειρο του κελιού** σε κάθε αλλαγή ορίσματος. Άρα η άγκυρα
 * είναι εδώ, στο κύκλωμα, και όχι σε test καμβά: αν η εγγραφή στο πρόχειρο πάψει, το
 * περίγραμμα σβήνει σιωπηλά και **καμία** δοκιμή ζωγραφικής δεν θα το έδειχνε.
 */
describe('ΤΟ ΟΠΤΙΚΟ FEEDBACK — το περίγραμμα είναι ΠΑΡΑΓΩΓΟ του ενός γραφέα', () => {
  it('🔴 κλικ στο B2 ⇒ το B2 αποκτά αναφορά προς ζωγράφισμα', () => {
    openArgumentsOnSum();
    pointAt('B2');
    const spans = tableFormulaReferenceSpans(MODEL, getTableCellCursor()?.draft ?? '');
    expect(spans).toHaveLength(1);
    expect(spans[0].bounds).toEqual({ firstRow: 1, firstCol: 1, lastRow: 1, lastCol: 1 });
  });

  it('σύρσιμο ⇒ το περίγραμμα καλύπτει ΟΛΟΚΛΗΡΟ το ορθογώνιο', () => {
    openArgumentsOnSum();
    pointAt('B2:D4');
    const spans = tableFormulaReferenceSpans(MODEL, getTableCellCursor()?.draft ?? '');
    expect(spans[0].bounds).toEqual({ firstRow: 1, firstCol: 1, lastRow: 3, lastCol: 3 });
  });

  it('δύο ορίσματα ⇒ δύο περιγράμματα, με ΔΙΑΦΟΡΕΤΙΚΟ χρώμα το καθένα', () => {
    openArgumentsOnSum();
    pointAt('A1');
    setActiveFunctionArgument(1);
    pointAt('C3');
    const spans = tableFormulaReferenceSpans(MODEL, getTableCellCursor()?.draft ?? '');
    expect(spans.map((span) => span.colorIndex)).toEqual([0, 1]);
  });
});

/** Τοπικός δομικός τύπος — το test δεν εισάγει τον τύπο για να μη δεσμεύσει το σχήμα του. */
interface TablePointTargetLike {
  readonly formulaText: string;
  readonly caretIndex: number;
}
