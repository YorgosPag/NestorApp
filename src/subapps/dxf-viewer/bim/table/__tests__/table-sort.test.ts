/**
 * 🔴 ADR-828 Φ4β — άγκυρες της **ταξινόμησης πίνακα**.
 *
 * Δύο πράγματα κλειδώνονται εδώ, και το δεύτερο είναι ο λόγος που η ταξινόμηση ζει σε **αυτό**
 * το ADR και όχι σε δικό της:
 *
 * 1. Η ταξινόμηση είναι **μετάθεση πάνω στην υπάρχουσα μηχανή μεταφοράς** — άρα ό,τι ξέρει
 *    εκείνη (τύποι, `runs`, κενά, undo) ισχύει δωρεάν, και τα tests το **αποδεικνύουν** αντί
 *    να το υποθέτουν.
 * 2. Η ταξινόμηση **με λίστα** απαντά την ίδια ερώτηση με τη λαβή συμπλήρωσης: «ποια είναι η
 *    διάταξη αυτών των ονομάτων;». Γι' αυτό λέγονται *Sort Lists* στο LibreOffice.
 */

import { applyTableSort, planTableSort } from '../table-sort-plan';
import type { TableSortCriterion } from '../table-sort-types';
import {
  createTableModel,
  getPersistedCellText,
  resolveTableModel,
  toPersistedTableModel,
} from '../table-model-helpers';
import { parseTableFormula } from '../formula/table-formula-parse';
import type {
  CellSpan,
  PersistedTableModel,
  TableCellEntry,
  TableColumn,
  TableColumnId,
  TableRow,
  TableRowId,
} from '../../../types/table';

const COLUMNS: TableColumn[] = ['c0', 'c1'].map((id) => ({
  id,
  sizing: { kind: 'fixed', widthMm: 20 },
  valueType: 'text',
  align: 'left',
}));

const ROWS: TableRow[] = ['r0', 'r1', 'r2', 'r3'].map((id) => ({
  id,
  rowClass: 'data',
  heightMm: 8,
}));

const text = (rowId: string, colId: string, value: string | number): TableCellEntry => [
  rowId as TableRowId,
  colId as TableColumnId,
  { kind: 'text', value },
];

function persisted(cells: TableCellEntry[], merges: CellSpan[] = []): PersistedTableModel {
  return toPersistedTableModel(
    createTableModel({ columns: COLUMNS, rows: ROWS, cells, merges, edges: [] }),
  );
}

/** Η πρώτη στήλη ως λίστα, για ισχυρισμούς που διαβάζονται. */
function column0(model: PersistedTableModel): string[] {
  return ROWS.map((row) => getPersistedCellText(model, row.id, 'c0' as TableColumnId));
}

const ALL: { firstRow: number; lastRow: number; firstCol: number; lastCol: number } = {
  firstRow: 0,
  lastRow: 3,
  firstCol: 0,
  lastCol: 1,
};

const byColumn0 = (descending = false): TableSortCriterion[] => [
  { columnIndex: 0, descending },
];

// ════════════════════════════════════════════════════════════════════════════════
describe('φυσική σειρά', () => {
  it('🎯 αλφαβητικά, με το ελληνικό αλφάβητο', () => {
    const model = persisted([
      text('r0', 'c0', 'Δοκός'),
      text('r1', 'c0', 'Ακρόβαθρο'),
      text('r2', 'c0', 'Γέφυρα'),
      text('r3', 'c0', 'Βάθρο'),
    ]);
    expect(column0(applyTableSort(model, { range: ALL, criteria: byColumn0(), hasHeader: false })))
      .toEqual(['Ακρόβαθρο', 'Βάθρο', 'Γέφυρα', 'Δοκός']);
  });

  it('φθίνουσα αντιστρέφει', () => {
    const model = persisted([
      text('r0', 'c0', 'Α'),
      text('r1', 'c0', 'Β'),
      text('r2', 'c0', 'Γ'),
      text('r3', 'c0', 'Δ'),
    ]);
    expect(
      column0(applyTableSort(model, { range: ALL, criteria: byColumn0(true), hasHeader: false })),
    ).toEqual(['Δ', 'Γ', 'Β', 'Α']);
  });

  it('οι αριθμοί συγκρίνονται ως αριθμοί, όχι ως κείμενο', () => {
    const model = persisted([
      text('r0', 'c0', 100),
      text('r1', 'c0', 9),
      text('r2', 'c0', 25),
      text('r3', 'c0', 3),
    ]);
    // Ως κείμενο θα έδινε «100, 25, 3, 9» — το κλασικό σφάλμα λεξικογραφικής ταξινόμησης.
    expect(column0(applyTableSort(model, { range: ALL, criteria: byColumn0(), hasHeader: false })))
      .toEqual(['3', '9', '25', '100']);
  });

  /**
   * ⚠️ Σύμβαση **υπολογιστικού φύλλου**, όχι SQL: τα κενά μένουν τελευταία και στις **δύο**
   * φορές. Ο άνθρωπος που ταξινομεί ψάχνει άκρο, και μια γραμμή χωρίς τιμή δεν είναι
   * υποψήφια για κανένα από τα δύο.
   */
  it('🔑 τα ΚΕΝΑ μένουν τελευταία — και στη φθίνουσα', () => {
    const model = persisted([
      text('r0', 'c0', 'Β'),
      text('r2', 'c0', 'Α'),
    ]);
    expect(column0(applyTableSort(model, { range: ALL, criteria: byColumn0(), hasHeader: false })))
      .toEqual(['Α', 'Β', '', '']);
    expect(
      column0(applyTableSort(model, { range: ALL, criteria: byColumn0(true), hasHeader: false })),
    ).toEqual(['Β', 'Α', '', '']);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
describe('🎯 ΤΟ ΑΙΤΗΜΑ — ταξινόμηση ΜΕ ΛΙΣΤΑ', () => {
  const MONTHS: TableSortCriterion[] = [
    {
      columnIndex: 0,
      descending: false,
      byList: {
        key: 'user:Μήνες',
        entries: ['Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος'],
      },
    },
  ];

  it('«Μάρτιος, Ιανουάριος, Απρίλιος, Φεβρουάριος» ⇒ ημερολογιακή σειρά, όχι αλφαβητική', () => {
    const model = persisted([
      text('r0', 'c0', 'Μάρτιος'),
      text('r1', 'c0', 'Ιανουάριος'),
      text('r2', 'c0', 'Απρίλιος'),
      text('r3', 'c0', 'Φεβρουάριος'),
    ]);
    // Αλφαβητικά θα έδινε «Απρίλιος, Ιανουάριος, Μάρτιος, Φεβρουάριος» — καμία σύγκριση
    // κειμένου δεν μπορεί να ανακαλύψει τη διάταξη του ημερολογίου.
    expect(column0(applyTableSort(model, { range: ALL, criteria: MONTHS, hasHeader: false })))
      .toEqual(['Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος']);
  });

  it('η φθίνουσα διαβάζει τη λίστα ανάποδα', () => {
    const model = persisted([
      text('r0', 'c0', 'Ιανουάριος'),
      text('r1', 'c0', 'Μάρτιος'),
      text('r2', 'c0', 'Φεβρουάριος'),
      text('r3', 'c0', 'Απρίλιος'),
    ]);
    const descending = MONTHS.map((c) => ({ ...c, descending: true }));
    expect(column0(applyTableSort(model, { range: ALL, criteria: descending, hasHeader: false })))
      .toEqual(['Απρίλιος', 'Μάρτιος', 'Φεβρουάριος', 'Ιανουάριος']);
  });

  /**
   * ⚠️ Ό,τι δεν ανήκει στη λίστα **δεν χάνεται και δεν ανεβαίνει**: πηγαίνει μετά από κάθε
   * μέλος της, ταξινομημένο μεταξύ του φυσικά. Η αντίστροφη επιλογή θα έφερνε τα άσχετα στην
   * κορυφή κάθε φθίνουσας ταξινόμησης.
   */
  it('🔑 ό,τι ΔΕΝ είναι στη λίστα πάει ΜΕΤΑ — και μένει ταξινομημένο μεταξύ του', () => {
    const model = persisted([
      text('r0', 'c0', 'Ωμέγα'),
      text('r1', 'c0', 'Φεβρουάριος'),
      text('r2', 'c0', 'Άλφα'),
      text('r3', 'c0', 'Ιανουάριος'),
    ]);
    expect(column0(applyTableSort(model, { range: ALL, criteria: MONTHS, hasHeader: false })))
      .toEqual(['Ιανουάριος', 'Φεβρουάριος', 'Άλφα', 'Ωμέγα']);
  });

  it('αγνοεί κεφαλαία και τόνους, όπως και η λαβή συμπλήρωσης', () => {
    const model = persisted([
      text('r0', 'c0', 'ΜΑΡΤΙΟΣ'),
      text('r1', 'c0', 'ιανουαριος'),
    ]);
    expect(column0(applyTableSort(model, { range: ALL, criteria: MONTHS, hasHeader: false })))
      .toEqual(['ιανουαριος', 'ΜΑΡΤΙΟΣ', '', '']);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
describe('🔴 ό,τι ταξιδεύει με τη γραμμή', () => {
  it('🔑 η ΔΙΠΛΑΝΗ στήλη ακολουθεί — η γραμμή μένει ακέραιη', () => {
    const model = persisted([
      text('r0', 'c0', 'Γ'), text('r0', 'c1', 'γάμμα'),
      text('r1', 'c0', 'Α'), text('r1', 'c1', 'άλφα'),
      text('r2', 'c0', 'Β'), text('r2', 'c1', 'βήτα'),
    ]);
    const next = applyTableSort(model, { range: ALL, criteria: byColumn0(), hasHeader: false });
    expect(ROWS.map((row) => getPersistedCellText(next, row.id, 'c1' as TableColumnId)))
      .toEqual(['άλφα', 'βήτα', 'γάμμα', '']);
  });

  /**
   * 🔴 **Ο ΛΟΓΟΣ ΠΟΥ Η ΤΑΞΙΝΟΜΗΣΗ ΔΕΝ ΓΡΑΨΕ ΔΙΚΗ ΤΗΣ ΜΗΧΑΝΗ.**
   *
   * Το `relocationOf` του {@link applyTableRangeTransfer} χτίζει χάρτη **ανά κελί**, οπότε
   * μια αναφορά ακολουθεί το κελί της όπου κι αν το στείλει η μετάθεση. Αυτό δεν είναι
   * παρενέργεια που τυχαίνει να δουλεύει — είναι η συμπεριφορά του Excel, και εδώ μετριέται.
   */
  it('🔴 οι ΑΝΑΦΟΡΕΣ ΤΥΠΩΝ ακολουθούν τα κελιά τους στη νέα τους θέση', () => {
    const base = createTableModel({
      columns: COLUMNS,
      rows: ROWS,
      cells: [
        text('r0', 'c0', 'Γ'), text('r0', 'c1', 30),
        text('r1', 'c0', 'Α'), text('r1', 'c1', 10),
        text('r2', 'c0', 'Β'), text('r2', 'c1', 20),
      ],
      merges: [],
      edges: [],
    });
    // Ο τύπος ζει **έξω** από την ταξινομούμενη περιοχή και δείχνει **μέσα** της, στο κελί
    // που κρατά το 30 — δηλαδή στη γραμμή που η ταξινόμηση θα στείλει τελευταία.
    const formula = parseTableFormula(base, '=B1');
    expect(formula).not.toBeNull();
    const model = toPersistedTableModel(
      createTableModel({
        columns: COLUMNS,
        rows: ROWS,
        cells: [
          text('r0', 'c0', 'Γ'), text('r0', 'c1', 30),
          text('r1', 'c0', 'Α'), text('r1', 'c1', 10),
          text('r2', 'c0', 'Β'), text('r2', 'c1', 20),
          [
            'r3' as TableRowId,
            'c1' as TableColumnId,
            { kind: 'formula', value: 30, formula: formula! },
          ],
        ],
        merges: [],
        edges: [],
      }),
    );

    const sorted = applyTableSort(model, {
      range: { firstRow: 0, lastRow: 2, firstCol: 0, lastCol: 1 },
      criteria: byColumn0(),
      hasHeader: false,
    });

    expect(column0(sorted)).toEqual(['Α', 'Β', 'Γ', '']);
    // Το «Γ» και το 30 του μετακόμισαν στη γραμμή 2· ο τύπος **δεν** έμεινε να δείχνει σε ό,τι
    // τυχαίνει τώρα να κάθεται στη γραμμή 0 (που είναι το 10).
    expect(getPersistedCellText(sorted, 'r3' as TableRowId, 'c1' as TableColumnId)).toBe('30');
  });
});

// ════════════════════════════════════════════════════════════════════════════════
describe('κεφαλίδα', () => {
  it('🔑 η πρώτη γραμμή ΜΕΝΕΙ ακίνητη και ΔΕΝ συμμετέχει στη σύγκριση', () => {
    const model = persisted([
      text('r0', 'c0', 'Περιγραφή'),
      text('r1', 'c0', 'Γ'),
      text('r2', 'c0', 'Α'),
      text('r3', 'c0', 'Β'),
    ]);
    // Χωρίς τον διακόπτη, το «Περιγραφή» θα ταξινομούνταν σαν δεδομένο και θα κατέβαινε.
    expect(column0(applyTableSort(model, { range: ALL, criteria: byColumn0(), hasHeader: true })))
      .toEqual(['Περιγραφή', 'Α', 'Β', 'Γ']);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
describe('🔴 πότε ΑΡΝΕΙΤΑΙ, και με ποιον λόγο', () => {
  const model = () =>
    persisted([text('r0', 'c0', 'Β'), text('r1', 'c0', 'Α')]);

  const plan = (criteria: TableSortCriterion[], hasHeader = false) =>
    planTableSort(resolveTableModel(model()), { range: ALL, criteria, hasHeader });

  it('χωρίς κριτήρια', () => {
    expect(plan([])).toEqual({ ok: false, reason: 'no-criteria' });
  });

  it('κριτήριο σε στήλη ΕΞΩ από την περιοχή — καμία σιωπηλή διεύρυνση', () => {
    expect(plan([{ columnIndex: 5, descending: false }])).toMatchObject({ reason: 'no-criteria' });
  });

  it('μπαγιάτικα όρια μετά από undo', () => {
    const outcome = planTableSort(resolveTableModel(model()), {
      range: { firstRow: 0, lastRow: 99, firstCol: 0, lastCol: 1 },
      criteria: byColumn0(),
      hasHeader: false,
    });
    expect(outcome).toEqual({ ok: false, reason: 'stale-range' });
  });

  /**
   * ⚠️ Το Excel λέει *«This operation requires the merged cells to be identically sized»* και
   * αρνείται. Η εναλλακτική — να σπάσει τη συγχώνευση ή να σύρει μαζί της γραμμές που ο
   * κανόνας τοποθέτησε αλλού — είναι απόφαση που δεν παίρνεται σιωπηλά για τον άνθρωπο.
   */
  it('🔑 ΣΥΓΧΩΝΕΥΣΗ μέσα στην περιοχή ⇒ άρνηση με λόγο, ποτέ μισή ταξινόμηση', () => {
    const merged = persisted(
      [text('r0', 'c0', 'Β'), text('r1', 'c0', 'Α')],
      [{ anchorRowId: 'r0' as TableRowId, anchorColId: 'c0' as TableColumnId, rowSpan: 1, colSpan: 2 }],
    );
    expect(planTableSort(resolveTableModel(merged), {
      range: ALL,
      criteria: byColumn0(),
      hasHeader: false,
    })).toEqual({ ok: false, reason: 'merged-range' });
  });

  it('🔑 ήδη ταξινομημένο ⇒ ΚΑΝΕΝΑ βήμα undo για το τίποτα', () => {
    const already = persisted([text('r0', 'c0', 'Α'), text('r1', 'c0', 'Β')]);
    expect(planTableSort(resolveTableModel(already), {
      range: ALL,
      criteria: byColumn0(),
      hasHeader: false,
    })).toEqual({ ok: false, reason: 'already-sorted' });
    // Και ο εφαρμοστής δίνει το **ίδιο** μοντέλο by-reference.
    expect(applyTableSort(already, { range: ALL, criteria: byColumn0(), hasHeader: false }))
      .toBe(already);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
describe('πολλαπλά επίπεδα', () => {
  it('🔑 το δεύτερο κριτήριο κρίνει ΜΟΝΟ όπου το πρώτο ισοβαθμεί', () => {
    const model = persisted([
      text('r0', 'c0', 'Α'), text('r0', 'c1', 'δ'),
      text('r1', 'c0', 'Β'), text('r1', 'c1', 'α'),
      text('r2', 'c0', 'Α'), text('r2', 'c1', 'β'),
      text('r3', 'c0', 'Β'), text('r3', 'c1', 'γ'),
    ]);
    const next = applyTableSort(model, {
      range: ALL,
      criteria: [
        { columnIndex: 0, descending: false },
        { columnIndex: 1, descending: false },
      ],
      hasHeader: false,
    });
    expect(column0(next)).toEqual(['Α', 'Α', 'Β', 'Β']);
    expect(ROWS.map((row) => getPersistedCellText(next, row.id, 'c1' as TableColumnId)))
      .toEqual(['β', 'δ', 'α', 'γ']);
  });
});
