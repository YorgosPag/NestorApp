/**
 * ADR-754 §1 — **ο πίνακας καταστάσεων της υπόδειξης, ως πίνακας περιπτώσεων**.
 *
 * Κάθε γραμμή εδώ είναι μία απάντηση στο «τι σημαίνει τώρα ένα κλικ σε κελί;». Το κρίσιμο
 * δεν είναι τα `armed`/`liveRef` — είναι τα **`off`**: κάθε ένα από αυτά είναι μια θέση όπου
 * ένα κλικ θα έγραφε `E4` μέσα σε κείμενο που ο χρήστης δεν ήθελε να πειραχτεί.
 */

import { createTableModel } from '../table-model-helpers';
import type { TableColumn, TableModel, TableRow } from '../../../types/table';
import { resolveFormulaPointState } from '../formula/table-formula-point-state';

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

/**
 * Πλέγμα 5×5 ⇒ έγκυρες αναφορές `A1`…`E5`· οτιδήποτε πιο πέρα είναι εκτός ορίων.
 *
 * Το μέγεθος δεν είναι τυχαίο: κάνει το `E4` του στιγμιότυπου που ζήτησε ο ιδιοκτήτης
 * **υπαρκτό** κελί. Σε μικρότερο πλέγμα κάθε περίπτωση με `E4` θα περνούσε για `off` όχι
 * επειδή η λογική το αποφάσισε, αλλά επειδή η στήλη δεν υπήρχε — δηλαδή πράσινο test που
 * δεν δοκιμάζει τίποτα.
 */
const MODEL: TableModel = createTableModel({ columns: COLUMNS, rows: ROWS, cells: [] });

/**
 * Ο χαρακτήρας `|` δηλώνει τον δρομέα και αφαιρείται πριν την ερώτηση. Γράφεται έτσι ώστε
 * κάθε περίπτωση να διαβάζεται όπως ακριβώς φαίνεται στην οθόνη — μια θέση δρομέα σε
 * αριθμητικό δείκτη είναι ακριβώς το είδος λεπτομέρειας που ξεγελά τον αναγνώστη.
 */
function stateAt(marked: string) {
  const caretIndex = marked.indexOf('|');
  return resolveFormulaPointState(MODEL, marked.replace('|', ''), caretIndex);
}

describe('ARMED — η γραμματική περιμένει τελεστέο, το κλικ ΕΙΣΑΓΕΙ', () => {
  it.each([
    ['=|', 1],
    [' =|', 2],
    ['=A1+|', 4],
    ['=A1*|', 4],
    ['=SUM(|', 5],
    // ADR-761: ο διαχωριστής της γραμματικής του σχεδίου.
    ['=SUM(A1;|', 8],
    ['=A1:|', 4],
    ['=-|', 2],
    ['=A1>|', 4],
  ])('«%s» ⇒ οπλισμένο στη θέση %i', (marked, at) => {
    expect(stateAt(marked)).toEqual({ kind: 'armed', at });
  });
});

describe('LIVE_REF — αναφορά χωρίς τελεστή μετά, το κλικ ΑΝΤΙΚΑΘΙΣΤΑ', () => {
  it.each([
    ['=A1|', 1, 3],
    ['=E4|', 1, 3],
    ['=B2+C3|', 4, 6],
    ['=SUM(A1|', 5, 7],
  ])('«%s» ⇒ ζωντανή αναφορά [%i, %i)', (marked, from, to) => {
    expect(stateAt(marked)).toEqual({ kind: 'liveRef', from, to });
  });

  // 🔴 Ένα εύρος είναι **μία** αναφορά με τρεις μονάδες: το κλικ αντικαθιστά και τα δύο
  // άκρα μαζί με την άνω τελεία. Η αντικατάσταση μόνο του `B2` έδινε `=SUM(A1:A1:C3`.
  it.each([
    ['=SUM(A1:B2|', 5, 10],
    ['=A1:B2|', 1, 6],
    ['=C3+A1:B2|', 4, 9],
  ])('«%s» ⇒ ΟΛΟΚΛΗΡΟ το εύρος [%i, %i)', (marked, from, to) => {
    expect(stateAt(marked)).toEqual({ kind: 'liveRef', from, to });
  });
});

describe('OFF — το κλικ σημαίνει ό,τι σήμαινε πάντα', () => {
  it.each([
    ['σκέτο κείμενο', 'Δοκός Δ1|'],
    ['κείμενο που ΠΕΡΙΕΧΕΙ ίσον', '2+2=4|'],
    ['ο δρομέας ΠΡΙΝ το ίσον', '|=A1'],
    ['μετά από αριθμό', '=1|'],
    ['μετά από δεκαδικό', '=1.5|'],
    ['μετά από κλείσιμο παρένθεσης', '=SUM(A1:A3)|'],
    ['μετά από κυριολεκτικό κείμενο', '="ναι"|'],
    ['όνομα συνάρτησης, όχι αναφορά', '=SUM|'],
    ['αναφορά ΕΚΤΟΣ πλέγματος', '=Z9|'],
    ['χαρακτήρας εκτός γραμματικής', '=A1#|'],
  ])('%s: «%s»', (_name, marked) => {
    expect(stateAt(marked)).toEqual({ kind: 'off' });
  });

  // 🔑 Το ελάττωμα που θα έσβηνε λέξη υπό πληκτρολόγηση: αριστερά του δρομέα το `=A1|2`
  // σαρώνεται ως τέλειο `A1`, δηλαδή θα περνούσε για ζωντανή αναφορά.
  it.each([
    ['=A12', 3],
    ['=A12', 2],
    ['=SUM(A11', 7],
  ])('ο δρομέας ΚΟΒΕΙ μονάδα: «%s» στη θέση %i', (draft, caretIndex) => {
    expect(resolveFormulaPointState(MODEL, draft, caretIndex)).toEqual({ kind: 'off' });
  });

  it.each([-1, 99])('δρομέας εκτός κειμένου (%i) ⇒ ποτέ υπόδειξη', (caretIndex) => {
    expect(resolveFormulaPointState(MODEL, '=A1+', caretIndex)).toEqual({ kind: 'off' });
  });
});

describe('η κατάσταση ΕΙΝΑΙ το κείμενο — καμία αποθηκευμένη σημαία', () => {
  it('η ίδια θέση δρομέα δίνει άλλη απάντηση όταν αλλάξει το κείμενο', () => {
    expect(resolveFormulaPointState(MODEL, '=A1+', 4)).toEqual({ kind: 'armed', at: 4 });
    // Ο χρήστης έσβησε το `=`: **τίποτα δεν χρειάστηκε να «καθαρίσει»** την κατάσταση.
    expect(resolveFormulaPointState(MODEL, ' A1+', 4)).toEqual({ kind: 'off' });
  });

  it('ίδιο κείμενο + ίδιος δρομέας ⇒ ίδια απάντηση (καθαρή συνάρτηση)', () => {
    const first = resolveFormulaPointState(MODEL, '=SUM(A1,', 8);
    const second = resolveFormulaPointState(MODEL, '=SUM(A1,', 8);
    expect(first).toEqual(second);
  });
});
