/**
 * 🔴 ADR-739 §36 (ΦΑΣΗ 2) — **οι τύποι απέναντι στη μεταφορά περιοχής**.
 *
 * Τρία πράγματα κλειδώνουν εδώ, και τα δύο πρώτα είναι **parity που κερδήθηκε**, όχι που
 * υπήρχε:
 *
 * 1. Αναφορά **έξω** από την περιοχή που δείχνει **μέσα** της → **ακολουθεί** τη μετακίνηση.
 *    (Χωρίς το `remapTableFormulaRefs` θα έμενε να δείχνει σε άδειο κελί.)
 * 2. Αναφορά **μέσα** στην περιοχή προς κελί **έξω** → **μένει** — δεν ολισθαίνει.
 * 3. ✅ Η **αντιγραφή** ολισθαίνει τις **σχετικές** αναφορές και αφήνει ακέραιες τις
 *    **κλειδωμένες** — ADR-754 Γ1. Μέχρι τότε αυτή η γραμμή έγραφε το αντίθετο («ΔΕΝ
 *    ολισθαίνει, μετρημένη απόκλιση») και το test ήταν καρφωμένο ρητά *«ώστε η μέρα που θα
 *    αλλάξει να είναι απόφαση και όχι ατύχημα»*. 🔑 **Δούλεψε**: κοκκίνισε ακριβώς τη στιγμή
 *    που άλλαξε η συμπεριφορά, και η αλλαγή γράφτηκε εδώ αντί να περάσει απαρατήρητη.
 * 4. 🔴 Η **μετακίνηση** αγνοεί το `$` — και αυτό είναι κι αυτό Excel parity, όχι παράλειψη.
 */

import { remapTableFormulaRefs } from '../formula/table-formula-remap';
import { cellInputText, commitCellWrites, writeCellInput } from '../formula/table-formula-engine';
import { applyTableRangeTransfer } from '../table-range-transfer';
import { planTableRangeTransfer } from '../table-range-transfer-plan';
import type { TableRangeTransferRequest } from '../table-range-transfer-types';
import { cellKey, createTableModel, getPersistedCellText, toPersistedTableModel } from '../table-model-helpers';
import { PLAIN_TABLE_RANGE_DRAG } from '../table-range-move-zone';
import type {
  PersistedTableModel,
  TableColumn,
  TableColumnId,
  TableRow,
  TableRowId,
} from '../../../types/table';
import { bookOf, commitPendingForTest } from './formula-book-fixture';

const COLUMNS: TableColumn[] = ['c0', 'c1', 'c2'].map((id) => ({
  id,
  sizing: { kind: 'fixed', widthMm: 20 },
  valueType: 'number',
  align: 'right',
}));

const ROWS: TableRow[] = ['r0', 'r1', 'r2', 'r3'].map((id) => ({ id, rowClass: 'data', heightMm: 8 }));

const row = (id: string) => id as TableRowId;
const col = (id: string) => id as TableColumnId;

function base(): PersistedTableModel {
  return toPersistedTableModel(createTableModel({ columns: COLUMNS, rows: ROWS }));
}

/**
 * Γράφει σαν χρήστης: κείμενο ή `=τύπος`, μέσω της ΜΙΑΣ διακλάδωσης `=` **και** του
 * επαναϋπολογισμού — ακριβώς η αλυσίδα του `buildTableCellEditCommand`. Χωρίς το δεύτερο σκέλος
 * το κελί θα κρατούσε κενή τιμή και οι έλεγχοι θα μετρούσαν κάτι που ο χρήστης δεν βλέπει ποτέ.
 */
function type(model: PersistedTableModel, rowId: string, colId: string, input: string): PersistedTableModel {
  return commitPendingForTest(writeCellInput(bookOf(model),model, row(rowId), col(colId), input));
}

function transfer(model: PersistedTableModel, request: TableRangeTransferRequest): PersistedTableModel {
  const outcome = planTableRangeTransfer(model, request);
  if (!outcome.ok) throw new Error(`Το σχέδιο απορρίφθηκε: ${outcome.reason}`);
  return applyTableRangeTransfer(bookOf(model),model, outcome.plan);
}

const at = (rowId: string, colId: string) => ({ rowId: row(rowId), colId: col(colId) });

// ── Ο καθαρός μετασχηματισμός ─────────────────────────────────────────────────

describe('🔴 §36 remapTableFormulaRefs — η εγγύηση ταυτότητας ανεβαίνει ως τη ρίζα', () => {
  it('καμία μετακόμιση ⇒ ΤΟ ΙΔΙΟ μοντέλο by-reference', () => {
    const model = type(base(), 'r2', 'c0', '=A1+B1');
    expect(remapTableFormulaRefs(model, new Map())).toBe(model);
  });

  it('μετακόμιση που δεν αγγίζει καμία αναφορά ⇒ ΤΟ ΙΔΙΟ μοντέλο by-reference', () => {
    const model = type(base(), 'r2', 'c0', '=A1+B1');
    const untouched = new Map([[cellKey(row('r3'), col('c2')), at('r0', 'c2')]]);
    expect(remapTableFormulaRefs(model, untouched)).toBe(model);
  });

  it('🔑 το ΕΥΡΟΣ ακολουθεί μόνο αν μετακόμισαν ΚΑΙ ΤΑ ΔΥΟ άκρα του (Excel parity)', () => {
    const model = type(base(), 'r3', 'c2', '=SUM(A1:A3)');
    const halfMoved = new Map([[cellKey(row('r1'), col('c0')), at('r1', 'c1')]]);

    // Μόνο το μεσαίο κελί του εύρους μετακόμισε ⇒ το εύρος μένει ακέραιο. Αν ακολουθούσε το
    // ένα άκρο, το `A1:A3` θα παραμορφωνόταν σε σχήμα που κανείς δεν έγραψε.
    expect(remapTableFormulaRefs(model, halfMoved)).toBe(model);
    expect(cellInputText(bookOf(model),model, row('r3'), col('c2'))).toBe('=SUM(A1:A3)');
  });
});

// ── Η μετακίνηση: parity που κερδήθηκε ────────────────────────────────────────

describe('🔴 §36 μετακίνηση — «κάθε αναφορά σε κελί που μετακόμισε, ακολουθεί»', () => {
  it('🔴 τύπος ΕΞΩ που δείχνει ΜΕΣΑ στην περιοχή ξαναγράφεται στον προορισμό', () => {
    let model = type(base(), 'r0', 'c0', '10');
    model = type(model, 'r3', 'c2', '=A1*2');
    expect(getPersistedCellText(model, row('r3'), col('c2'))).toBe('20');

    // Το «10» μετακομίζει από το A1 στο B2.
    const next = transfer(model, {
      source: { firstRow: 0, lastRow: 0, firstCol: 0, lastCol: 0 },
      to: at('r1', 'c1'),
      intent: PLAIN_TABLE_RANGE_DRAG,
      shiftAxis: 'down',
    });

    // Χωρίς την επαναχαρτογράφηση, ο τύπος θα έδειχνε σε **άδειο** κελί και θα έδινε 0.
    expect(cellInputText(bookOf(next),next, row('r3'), col('c2'))).toBe('=B2*2');
    expect(getPersistedCellText(next, row('r3'), col('c2'))).toBe('20');
  });

  it('τύπος ΜΕΣΑ στην περιοχή κρατά τις αναφορές του προς τα ΕΞΩ — δεν ολισθαίνει', () => {
    let model = type(base(), 'r0', 'c2', '7');
    model = type(model, 'r0', 'c0', '=C1+1');

    const next = transfer(model, {
      source: { firstRow: 0, lastRow: 0, firstCol: 0, lastCol: 0 },
      to: at('r2', 'c0'),
      intent: PLAIN_TABLE_RANGE_DRAG,
      shiftAxis: 'down',
    });

    expect(cellInputText(bookOf(next),next, row('r2'), col('c0'))).toBe('=C1+1');
    expect(getPersistedCellText(next, row('r2'), col('c0'))).toBe('8');
  });

  it('τύπος και ο τελεστέος του μετακομίζουν ΜΑΖΙ — η εσωτερική αναφορά ακολουθεί', () => {
    let model = type(base(), 'r0', 'c0', '4');
    model = type(model, 'r0', 'c1', '=A1*3');

    const next = transfer(model, {
      source: { firstRow: 0, lastRow: 0, firstCol: 0, lastCol: 1 },
      to: at('r2', 'c0'),
      intent: PLAIN_TABLE_RANGE_DRAG,
      shiftAxis: 'down',
    });

    expect(cellInputText(bookOf(next),next, row('r2'), col('c1'))).toBe('=A3*3');
    expect(getPersistedCellText(next, row('r2'), col('c1'))).toBe('12');
  });
});

// ── Η αντιγραφή: η απόκλιση, δηλωμένη ─────────────────────────────────────────

describe('✅ §36 αντιγραφή — ΤΟ PARITY ΕΚΛΕΙΣΕ (ADR-754 Γ1): οι σχετικές ΟΛΙΣΘΑΙΝΟΥΝ', () => {
  /**
   * 🔴 **Αυτό το `describe` έλεγε μέχρι το ADR-754 το ΑΚΡΙΒΩΣ ΑΝΤΙΘΕΤΟ** — «οι αναφορές ΔΕΝ
   * ολισθαίνουν» — και ήταν σωστό: όσο ο τύπος δεν είχε τρόπο να πει «εγώ είμαι κλειδωμένος»,
   * μια καθολική ολίσθηση θα έσπαγε **σιωπηλά** την άλλη μισή πρόθεση των χρηστών. Το παλιό
   * σχόλιο έγραφε ρητά ότι «η θεραπεία είναι να αποκτήσει ο τύπος σημαία `$` ανά άξονα — δική
   * της φάση».
   *
   * Αυτή η φάση ήρθε. Το καρφί **δούλεψε ακριβώς όπως σχεδιάστηκε**: κοκκίνισε τη στιγμή που
   * άλλαξε η συμπεριφορά, ώστε η αλλαγή να είναι **απόφαση και όχι ατύχημα**.
   */
  it('✅ το αντίγραφο μία γραμμή κάτω ολισθαίνει: «=A1*2» ⇒ «=A2*2» (Excel parity)', () => {
    let model = type(base(), 'r0', 'c0', '5');
    model = type(model, 'r1', 'c0', '9');
    model = type(model, 'r0', 'c1', '=A1*2');

    const next = copyDown(model);

    expect(cellInputText(bookOf(next),next, row('r1'), col('c1'))).toBe('=A2*2');
    expect(getPersistedCellText(next, row('r1'), col('c1'))).toBe('18');

    // Και η πηγή μένει ακέραιη — το parity που ίσχυε ήδη.
    expect(cellInputText(bookOf(next),next, row('r0'), col('c1'))).toBe('=A1*2');
  });

  /** 🔑 Η άλλη μισή πρόθεση, που τώρα **μπορεί να εκφραστεί**: το `$` κρατά την αναφορά. */
  it('✅ το κλειδωμένο «=$A$1*2» μένει ακέραιο στο αντίγραφο', () => {
    let model = type(base(), 'r0', 'c0', '5');
    model = type(model, 'r1', 'c0', '9');
    model = type(model, 'r0', 'c1', '=$A$1*2');

    const next = copyDown(model);

    expect(cellInputText(bookOf(next),next, row('r1'), col('c1'))).toBe('=$A$1*2');
    expect(getPersistedCellText(next, row('r1'), col('c1'))).toBe('10');
  });

  /**
   * 🔴 **Η ΜΕΤΑΚΙΝΗΣΗ ΔΕΝ ΕΓΙΝΕ ΑΝΤΙΓΡΑΦΗ.** Οι δύο πράξεις μοιράζονται πλέον την κάθοδο στο
   * δέντρο (`table-formula-rewrite.ts`) και η προφανής αστοχία θα ήταν να μοιραστούν και τη
   * σημασιολογία. Εδώ κλειδώνει ότι το `$` παραμένει **αδιάφορο** στη μετακίνηση: το Excel
   * ενημερώνει τις αναφορές προς ό,τι μετακόμισε *«ανεξάρτητα από το αν είναι σχετικές ή
   * απόλυτες»*.
   */
  it('🔴 στη ΜΕΤΑΚΙΝΗΣΗ το `$` δεν εμποδίζει τίποτα — η αναφορά ακολουθεί το κελί', () => {
    let model = type(base(), 'r0', 'c0', '5');
    model = type(model, 'r0', 'c2', '=$A$1*2');

    const next = transfer(model, {
      source: { firstRow: 0, lastRow: 0, firstCol: 0, lastCol: 0 },
      to: at('r1', 'c0'),
      intent: { copy: false, insert: false },
      shiftAxis: 'down',
    });

    // Το `A1` μετακόμισε στο `A2` ⇒ ο τύπος το ακολουθεί, **κρατώντας** τα δολάρια του.
    expect(cellInputText(bookOf(next),next, row('r0'), col('c2'))).toBe('=$A$2*2');
    expect(getPersistedCellText(next, row('r0'), col('c2'))).toBe('10');
  });

  /** Αντιγραφή του **ίδιου** κελιού μια γραμμή πιο κάτω, στην ίδια στήλη. */
  function copyDown(model: PersistedTableModel): PersistedTableModel {
    return transfer(model, {
      source: { firstRow: 0, lastRow: 0, firstCol: 1, lastCol: 1 },
      to: at('r1', 'c1'),
      intent: { copy: true, insert: false },
      shiftAxis: 'down',
    });
  }
});
