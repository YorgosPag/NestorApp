/**
 * 🔴 ADR-764 — **η δομική πράξη είναι ΑΛΛΑΓΗ ΤΙΜΗΣ, όχι μόνο σχήματος**.
 *
 * Το σενάριο του στιγμιότυπου (06/08): `A1 = =CONCATENATE(A2;" ";A3)`, `A2=20`, `A3=30`.
 * Ο χρήστης σβήνει τη **γραμμή 3** και το `A1` εξακολουθεί να δείχνει `20 30` — ενώ η
 * γραμμή τύπων γράφει σωστά `=CONCATENATE(A2;" ";#REF!)`. Η **αποθηκευμένη τιμή** έμεινε
 * μπαγιάτικη, και σε πίνακα ποσοτήτων αυτό δεν είναι σφάλμα εμφάνισης: ταξιδεύει στο DXF.
 *
 * ## Οι δύο ανεξάρτητες υποσχέσεις που καρφώνονται εδώ
 * 1. **Η δομική πράξη ξαναϋπολογίζει** — όπως κάθε αδελφή διαδρομή περιεχομένου.
 * 2. **Ο αξιολογητής ξεχωρίζει «κενό» από «δεν υπάρχει πια»** — αλλιώς ο επαναϋπολογισμός
 *    απλώς ανταλλάσσει το μπαγιάτικο λάθος νούμερο με ένα **φρέσκο** λάθος νούμερο
 *    (`=CONCATENATE(A2;" ";A3)` θα έδινε `«20 »`, `=SUM(...)` θα έδινε αριθμό).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-764-structural-ops-formula-recalc.md
 */

import type { PersistedTableModel, TableColumn, TableRow } from '../../../types/table';
import { createTableModel, getCell, resolveTableModel, toPersistedTableModel } from '../table-model-helpers';
import { cellInputText, commitCellWrites, writeCellInput } from '../formula/table-formula-engine';
import { FORMULA_ERROR } from '../formula/table-formula-value';
import {
  deleteTableColumn,
  deleteTableRow,
  insertTableRow,
} from '../table-row-column-ops';
import { deleteTableRows, insertTableRows } from '../table-row-column-bulk-ops';

const REF = FORMULA_ERROR.reference;

const COLUMNS: readonly TableColumn[] = ['c1', 'c2'].map((id) => ({
  id,
  sizing: { kind: 'fixed', widthMm: 20 } as const,
  valueType: 'number' as const,
  align: 'right' as const,
}));

const ROWS: readonly TableRow[] = ['r1', 'r2', 'r3', 'r4', 'r5'].map((id) => ({
  id,
  rowClass: 'data' as const,
  heightMm: 8,
}));

function emptyModel(): PersistedTableModel {
  return toPersistedTableModel(createTableModel({ columns: COLUMNS, rows: ROWS }));
}

/** Ακριβώς ό,τι κάνει το `buildTableCellEditCommand`: γράψε, ξαναϋπολόγισε, ένα μοντέλο. */
function edit(
  model: PersistedTableModel,
  rowId: string,
  colId: string,
  text: string,
): PersistedTableModel {
  return commitCellWrites(writeCellInput(model, rowId, colId, text));
}

function valueAt(model: PersistedTableModel, rowId: string, colId: string): unknown {
  return getCell(resolveTableModel(model), rowId, colId)?.value;
}

// ──────────────────────────────────────────────────────────────────────────────
// Το στιγμιότυπο, αυτούσιο
// ──────────────────────────────────────────────────────────────────────────────

describe('🔴 ADR-764 — το σενάριο του στιγμιότυπου', () => {
  /** `A1 = =CONCATENATE(A2;" ";A3)`, `A2=20`, `A3=30` — ο πίνακας της οθόνης. */
  function screenshotModel(): PersistedTableModel {
    let model = emptyModel();
    model = edit(model, 'r2', 'c1', '20');
    model = edit(model, 'r3', 'c1', '30');
    model = edit(model, 'r1', 'c1', '=CONCATENATE(A2;" ";A3)');
    return model;
  }

  it('αφετηρία: το `A1` δείχνει «20 30»', () => {
    expect(valueAt(screenshotModel(), 'r1', 'c1')).toBe('20 30');
  });

  it('🔴 μετά τη διαγραφή της γραμμής 3 η ΤΙΜΗ γίνεται `#REF!` — όχι «20 30»', () => {
    const next = deleteTableRow(screenshotModel(), 'r3');
    expect(valueAt(next, 'r1', 'c1')).toBe(REF);
  });

  it('η γραμμή τύπων εξακολουθεί να λέει το ίδιο πράγμα με την τιμή', () => {
    const next = deleteTableRow(screenshotModel(), 'r3');
    expect(cellInputText(next, 'r1', 'c1')).toBe('=CONCATENATE(A2;" ";#REF!)');
  });

  it('🔑 η πράξη είναι ΚΑΘΑΡΗ — το προηγούμενο μοντέλο μένει άθικτο (το `Ctrl+Z` επιστρέφει «20 30»)', () => {
    const before = screenshotModel();
    deleteTableRow(before, 'r3');
    expect(valueAt(before, 'r1', 'c1')).toBe('20 30');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Ο πλήρης πίνακας: αναφορές, εύρη, διάδοση
// ──────────────────────────────────────────────────────────────────────────────

/**
 * `A1..A5` = 10,20,30,40,50 · `B1 = =SUM(A1:A5)` · `B2 = =A4` · `B3 = =B2*2` ·
 * `B5 = =SUM(A1:A4)` (το `A4` είναι **άκρο** του εύρους).
 */
function fullModel(): PersistedTableModel {
  let model = emptyModel();
  ['10', '20', '30', '40', '50'].forEach((value, index) => {
    model = edit(model, `r${index + 1}`, 'c1', value);
  });
  model = edit(model, 'r1', 'c2', '=SUM(A1:A5)');
  model = edit(model, 'r2', 'c2', '=A4');
  model = edit(model, 'r3', 'c2', '=B2*2');
  model = edit(model, 'r5', 'c2', '=SUM(A1:A4)');
  return model;
}

describe('🔴 ADR-764 — διαγραφή γραμμής', () => {
  it('αφετηρία', () => {
    const model = fullModel();
    expect(valueAt(model, 'r1', 'c2')).toBe(150);
    expect(valueAt(model, 'r2', 'c2')).toBe(40);
    expect(valueAt(model, 'r3', 'c2')).toBe(80);
    expect(valueAt(model, 'r5', 'c2')).toBe(100);
  });

  it('🔴 άμεση αναφορά σε σβησμένη γραμμή ⇒ `#REF!`', () => {
    expect(valueAt(deleteTableRow(fullModel(), 'r4'), 'r2', 'c2')).toBe(REF);
  });

  it('🔴 το `#REF!` ΔΙΑΔΙΔΕΤΑΙ — `=B2*2` πάνω σε `#REF!` δεν είναι `0`', () => {
    expect(valueAt(deleteTableRow(fullModel(), 'r4'), 'r3', 'c2')).toBe(REF);
  });

  it('🔴 εύρος με σβησμένο ΕΣΩΤΕΡΙΚΟ ⇒ συρρικνώνεται και ξαναϋπολογίζεται (Excel)', () => {
    // 10+20+30+50 — το 40 έφυγε μαζί με τη γραμμή του.
    expect(valueAt(deleteTableRow(fullModel(), 'r4'), 'r1', 'c2')).toBe(110);
  });

  it('🔴 εύρος με σβησμένο ΑΚΡΟ ⇒ συρρικνώνεται στο επιζών άκρο (Excel), ΔΕΝ πεθαίνει', () => {
    // `=SUM(A1:A4)` → `=SUM(A1:A3)` = 10+20+30.
    const next = deleteTableRow(fullModel(), 'r4');
    expect(valueAt(next, 'r5', 'c2')).toBe(60);
    expect(cellInputText(next, 'r5', 'c2')).toBe('=SUM(A1:A3)');
  });

  it('🔴 εύρος που έσβησε ΟΛΟΚΛΗΡΟ ⇒ `#REF!`', () => {
    let model = emptyModel();
    model = edit(model, 'r2', 'c1', '10');
    model = edit(model, 'r3', 'c1', '20');
    model = edit(model, 'r1', 'c2', '=SUM(A2:A3)');
    expect(valueAt(model, 'r1', 'c2')).toBe(30);

    const next = deleteTableRows(model, ['r2', 'r3']);
    expect(valueAt(next, 'r1', 'c2')).toBe(REF);
  });

  it('🔑 τύπος που δεν αφορά τη σβησμένη γραμμή ΔΕΝ ξαναγράφεται (καμία περιττή ακύρωση)', () => {
    const model = fullModel();
    const before = model.cells.find(([r, c]) => r === 'r2' && c === 'c2')?.[2];
    const next = deleteTableRow(model, 'r5');
    expect(next.cells.find(([r, c]) => r === 'r2' && c === 'c2')?.[2]).toBe(before);
  });
});

describe('🔴 ADR-764 — διαγραφή στήλης', () => {
  it('άμεση αναφορά σε σβησμένη στήλη ⇒ `#REF!`', () => {
    let model = emptyModel();
    model = edit(model, 'r1', 'c1', '7');
    model = edit(model, 'r1', 'c2', '=A1*2');
    expect(valueAt(model, 'r1', 'c2')).toBe(14);

    expect(valueAt(deleteTableColumn(model, 'c1'), 'r1', 'c2')).toBe(REF);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Η τέταρτη ερώτηση του §3: χρειάζεται η ΕΙΣΑΓΩΓΗ επαναϋπολογισμό;
// ──────────────────────────────────────────────────────────────────────────────

describe('🔴 ADR-764 — εισαγωγή γραμμής', () => {
  it('🔴 εισαγωγή ΜΕΣΑ στο εύρος: το εύρος μεγαλώνει και η τιμή ενημερώνεται', () => {
    const model = fullModel();
    // Νέα γραμμή ανάμεσα στη 2 και στην 3· γεμίζει με 100.
    const grown = insertTableRow(model, 2);
    const newRowId = grown.rows[2].id;
    const filled = edit(grown, newRowId, 'c1', '100');
    expect(valueAt(filled, 'r1', 'c2')).toBe(250);
  });

  it('🔴 εισαγωγή ΚΕΝΗΣ γραμμής μέσα στο εύρος δεν αλλάζει το άθροισμα, αλλά περνά από τη μηχανή', () => {
    expect(valueAt(insertTableRow(fullModel(), 2), 'r1', 'c2')).toBe(150);
  });

  it('η γραμμή τύπων δείχνει το μεγαλωμένο εύρος', () => {
    expect(cellInputText(insertTableRow(fullModel(), 2), 'r1', 'c2')).toBe('=SUM(A1:A6)');
  });

  /**
   * 🔴 Η **απόδειξη** ότι η εισαγωγή δεν είναι ακίνδυνη: με `SUM`/`AVERAGE`/`COUNT` μια κενή
   * γραμμή δεν αλλάζει τίποτα (τα κενά κελιά αγνοούνται στο `gatherNumbers`), αλλά οι
   * συναρτήσεις που κοιτούν **θέση μέσα στο εύρος** αλλάζουν απάντηση **σήμερα**. Είναι η
   * ίδια αιτία για την οποία το §49 απέρριψε τις `ROW`/`ROWS` ως «graph-opaque».
   */
  it('🔴 `=MATCH` μέσα σε εύρος: η εισαγωγή αλλάζει τη ΘΕΣΗ, άρα και την τιμή', () => {
    const model = edit(fullModel(), 'r2', 'c2', '=MATCH(30;A1:A5;0)');
    expect(valueAt(model, 'r2', 'c2')).toBe(3);

    // Κενή γραμμή πάνω από το `30` ⇒ το `30` είναι πλέον το **τέταρτο** κελί του εύρους.
    expect(valueAt(insertTableRow(model, 2), 'r2', 'c2')).toBe(4);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Οι μαζικές πράξεις — ίδιες υποσχέσεις, μία εντολή
// ──────────────────────────────────────────────────────────────────────────────

describe('🔴 ADR-764 — μαζικές πράξεις', () => {
  it('`deleteTableRows` ξαναϋπολογίζει', () => {
    expect(valueAt(deleteTableRows(fullModel(), ['r4']), 'r2', 'c2')).toBe(REF);
  });

  it('`insertTableRows` ξαναϋπολογίζει', () => {
    const grown = insertTableRows(fullModel(), 2, 2);
    expect(grown.rows).toHaveLength(7);
    expect(valueAt(grown, 'r1', 'c2')).toBe(150);
  });
});
