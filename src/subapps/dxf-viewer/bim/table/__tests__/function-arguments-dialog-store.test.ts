/**
 * ADR-763 §15 — **ο διάλογος ορισμάτων γράφει στο κελί, και το «Άκυρο» το γυρνά πίσω.**
 *
 * Τα δύο πράγματα που ελέγχονται εδώ δεν βγάζουν σφάλμα όταν σπάσουν:
 *   1. **η ζωντανή εγγραφή** — αν πάψει, η γραμμή τύπων μένει στο `=ΟΝΟΜΑ()` ενώ ο χρήστης
 *      γεμίζει κουτιά, και το «OK» δεσμεύει κενή κλήση·
 *   2. **η επαναφορά σε πλοήγηση** — αν αντιμετωπιστεί ως «κενό πρόχειρο», το «Άκυρο» πάνω σε
 *      κελί με περιεχόμενο το **αδειάζει**, αφήνοντάς το σε ανοιχτή γραφή.
 *
 * @see state/function-arguments-dialog-store.ts
 */

import {
  __resetTableCellCursorStoreForTests,
  getTableCellCursor,
  setTableCellCursor,
} from '../../../state/table-cell-cursor-store';
import {
  __resetFunctionArgumentsDialogForTests,
  cancelFunctionArgumentsDialog,
  closeFunctionArgumentsDialog,
  getFunctionArgumentsDialogState,
  openFunctionArgumentsDialog,
  setActiveFunctionArgument,
  setFunctionArgumentValue,
  subscribeFunctionArgumentsDialog,
} from '../../../state/function-arguments-dialog-store';
import { drawingFormulaGrammar } from '../formula/table-formula-grammar';
import { filledArgumentCount } from '../formula/catalog/formula-call-text';

const POSITION = { rowIndex: 0, columnIndex: 0, anchorColumnIndex: 0 };
const SEPARATOR = drawingFormulaGrammar().argumentSeparator;

/** Ο δρομέας σε ανοιχτή γραφή με το `=SUM()` που μόλις έγραψε η Φάση 1. */
function openOnSum(restore: Parameters<typeof openFunctionArgumentsDialog>[0]['restore']): void {
  setTableCellCursor('table-1', POSITION, 'edit', '=SUM()', 5);
  openFunctionArgumentsDialog({
    functionName: 'SUM',
    frame: { prefix: '=SUM(', suffix: ')' },
    restore,
  });
}

describe('ADR-763 §15 — άνοιγμα και κατάσταση', () => {
  beforeEach(() => {
    __resetTableCellCursorStoreForTests();
    __resetFunctionArgumentsDialogForTests();
  });

  it('ανοίγει κρατώντας όνομα, πλαίσιο και σημείο επαναφοράς', () => {
    openOnSum({ kind: 'navigation' });
    const state = getFunctionArgumentsDialogState();
    expect(state.open).toBe(true);
    expect(state.functionName).toBe('SUM');
    expect(state.frame).toEqual({ prefix: '=SUM(', suffix: ')' });
    expect(state.activeIndex).toBe(0);
  });

  it('🔴 το άνοιγμα ΔΕΝ ξαναγράφει το κελί — το πρόχειρο το έγραψε ο καλών', () => {
    setTableCellCursor('table-1', POSITION, 'edit', '=SUM()', 5);
    const before = getTableCellCursor();
    openFunctionArgumentsDialog({
      functionName: 'SUM',
      frame: { prefix: '=SUM(', suffix: ')' },
      restore: { kind: 'navigation' },
    });
    // Δεύτερη εγγραφή για το ίδιο κείμενο είναι αθώα σήμερα και ακριβώς το είδος του
    // πλεονασμού που αποκλίνει αύριο.
    expect(getTableCellCursor()).toEqual(before);
  });

  it('ειδοποιεί τους συνδρομητές σε κάθε αλλαγή', () => {
    let hits = 0;
    const unsubscribe = subscribeFunctionArgumentsDialog(() => { hits += 1; });
    openOnSum({ kind: 'navigation' });
    setFunctionArgumentValue(0, 'A1');
    setActiveFunctionArgument(1);
    unsubscribe();
    expect(hits).toBeGreaterThanOrEqual(3);
  });

  it('η αλλαγή ενεργού ορίσματος ΔΕΝ αγγίζει το κελί', () => {
    openOnSum({ kind: 'navigation' });
    setFunctionArgumentValue(0, 'A1');
    const before = getTableCellCursor();
    setActiveFunctionArgument(1);
    expect(getFunctionArgumentsDialogState().activeIndex).toBe(1);
    expect(getTableCellCursor()?.draft).toBe(before?.draft);
  });

  it('οι πράξεις είναι σιωπηλές όταν ο διάλογος είναι κλειστός', () => {
    setFunctionArgumentValue(0, 'A1');
    setActiveFunctionArgument(2);
    cancelFunctionArgumentsDialog();
    expect(getFunctionArgumentsDialogState().open).toBe(false);
    expect(getFunctionArgumentsDialogState().values).toEqual([]);
  });
});

describe('ADR-763 §15 — η ζωντανή εγγραφή στο κελί', () => {
  beforeEach(() => {
    __resetTableCellCursorStoreForTests();
    __resetFunctionArgumentsDialogForTests();
  });

  it('κάθε πληκτρολόγηση ξαναγράφει το πρόχειρο, όπως στο Excel', () => {
    openOnSum({ kind: 'navigation' });
    setFunctionArgumentValue(0, 'A1');
    expect(getTableCellCursor()?.draft).toBe('=SUM(A1)');
    setFunctionArgumentValue(1, 'B2');
    expect(getTableCellCursor()?.draft).toBe(`=SUM(A1${SEPARATOR}B2)`);
  });

  it('ο κέρσορας πάει στο ΤΕΛΟΣ του ορίσματος που άλλαξε', () => {
    // Δεν είναι διακοσμητικό: είναι η είσοδος του `resolveFormulaPointState`, δηλαδή αυτή
    // που κρίνει τι σημαίνει το επόμενο κλικ σε κελί (ADR-754 §1).
    openOnSum({ kind: 'navigation' });
    setFunctionArgumentValue(0, 'A1');
    expect(getTableCellCursor()?.caretIndex).toBe(7);
    setFunctionArgumentValue(1, 'B2');
    expect(getTableCellCursor()?.caretIndex).toBe(10);
  });

  it('ο πίνακας τιμών μεγαλώνει μόνος του σε δείκτη πέρα από το μήκος του', () => {
    openOnSum({ kind: 'navigation' });
    setFunctionArgumentValue(3, 'D4');
    expect(getFunctionArgumentsDialogState().values).toEqual(['', '', '', 'D4']);
    expect(getTableCellCursor()?.draft).toBe(`=SUM(${SEPARATOR}${SEPARATOR}${SEPARATOR}D4)`);
  });

  it('το σβήσιμο του τελευταίου ορίσματος καθαρίζει και τον διαχωριστή του', () => {
    openOnSum({ kind: 'navigation' });
    setFunctionArgumentValue(0, 'A1');
    setFunctionArgumentValue(1, 'B2');
    setFunctionArgumentValue(1, '');
    expect(getTableCellCursor()?.draft).toBe('=SUM(A1)');
  });

  it('«πόσα κουτιά είναι σε χρήση» μετρά μέχρι το τελευταίο γεμάτο', () => {
    openOnSum({ kind: 'navigation' });
    setFunctionArgumentValue(2, 'C3');
    expect(filledArgumentCount(getFunctionArgumentsDialogState().values)).toBe(3);
  });
});

describe('ADR-763 §15 — τι επαναφέρει το «Άκυρο»', () => {
  beforeEach(() => {
    __resetTableCellCursorStoreForTests();
    __resetFunctionArgumentsDialogForTests();
  });

  it('🔴 ΠΛΟΗΓΗΣΗ: ακυρώνει τη συνεδρία — ΔΕΝ γράφει κενό πρόχειρο', () => {
    // Το `fx` πατιέται συνήθως πάνω σε κελί που είναι απλώς επιλεγμένο. Εγγραφή `''` εδώ θα
    // άφηνε το κελί σε **ανοιχτή γραφή με κενό κείμενο** — δηλαδή το επόμενο `Enter` θα
    // έσβηνε το περιεχόμενό του.
    openOnSum({ kind: 'navigation' });
    setFunctionArgumentValue(0, 'A1');
    cancelFunctionArgumentsDialog();

    const cursor = getTableCellCursor();
    expect(cursor?.mode).toBe('nav');
    expect(cursor?.draft).toBe('');
    expect(cursor?.caretIndex).toBeUndefined();
  });

  it('ΓΡΑΦΗ: επαναφέρει το ακριβές κείμενο και τη θέση κέρσορα', () => {
    setTableCellCursor('table-1', POSITION, 'edit', '=B2*SUM()', 8);
    openFunctionArgumentsDialog({
      functionName: 'SUM',
      frame: { prefix: '=B2*SUM(', suffix: ')' },
      restore: { kind: 'draft', draft: '=B2*', caretIndex: 4 },
    });
    setFunctionArgumentValue(0, 'A1');
    expect(getTableCellCursor()?.draft).toBe('=B2*SUM(A1)');

    cancelFunctionArgumentsDialog();
    expect(getTableCellCursor()?.draft).toBe('=B2*');
    expect(getTableCellCursor()?.caretIndex).toBe(4);
    expect(getTableCellCursor()?.mode).toBe('edit');
  });

  it('🔴 η επαναφορά σε ΓΡΑΦΗ ξαναστήνει τη συνεδρία — αλλιώς χάνεται το πληκτρολόγιο', () => {
    // Το `setTableCellCursorDraftAt` σκοπίμως δεν αγγίζει τη συνεδρία, οπότε χωρίς ρητή
    // επανεκκίνηση η εστίαση θα έμενε στο ξεμονταρισμένο κουτί ορίσματος.
    setTableCellCursor('table-1', POSITION, 'edit', '=SUM()', 5);
    const sessionBefore = getTableCellCursor()?.sessionId ?? 0;
    openFunctionArgumentsDialog({
      functionName: 'SUM',
      frame: { prefix: '=SUM(', suffix: ')' },
      restore: { kind: 'draft', draft: '=', caretIndex: 1 },
    });
    cancelFunctionArgumentsDialog();
    expect(getTableCellCursor()?.sessionId).toBeGreaterThan(sessionBefore);
  });

  it('το «OK» ΔΕΝ επαναφέρει: ό,τι γράφτηκε μένει γραμμένο', () => {
    openOnSum({ kind: 'navigation' });
    setFunctionArgumentValue(0, 'A1');
    closeFunctionArgumentsDialog();
    expect(getFunctionArgumentsDialogState().open).toBe(false);
    expect(getTableCellCursor()?.draft).toBe('=SUM(A1)');
  });

  it('το «Άκυρο» είναι ιδεμποτές — δεύτερη κλήση δεν ξαναγράφει τίποτα', () => {
    openOnSum({ kind: 'draft', draft: '=', caretIndex: 1 });
    setFunctionArgumentValue(0, 'A1');
    cancelFunctionArgumentsDialog();
    const after = getTableCellCursor();
    cancelFunctionArgumentsDialog();
    expect(getTableCellCursor()).toEqual(after);
  });
});
