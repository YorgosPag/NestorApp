/**
 * 🔴 ADR-739 §36 (ΦΑΣΗ 2) — **η μεταφορά περιοχής**: σχέδιο + οι τρεις πράξεις.
 *
 * Εδώ κλειδώνουν ως **εκτελέσιμη προδιαγραφή** οι τρεις αποφάσεις του Giorgio (03/08) και οι
 * αποφάσεις που χρειάστηκε να παρθούν για να υλοποιηθούν:
 *
 *  - «**ρωτά πριν σβήσει**» ⇒ {@link tableRangeOverwrittenCells}, ορισμένο **δομικά**
 *  - «**κείμενο + μορφοποίηση + ακμές**» ⇒ και τα τρία ταξιδεύουν· η **απόκλιση** του
 *    επιπέδου 2/3 (η μορφοποίηση του άξονα ΔΕΝ ταξιδεύει) είναι **καρφωμένη**, όχι σιωπηλή
 *  - «**Ctrl ΚΑΙ Shift**» ⇒ αντιγραφή χωρίς άδειασμα· ολίσθηση ως **μετάθεση**
 *  - «**ΕΝΑ undo ανά χειρονομία**» ⇒ ελέγχεται ως **ένα** νέο μοντέλο, και ως το **ίδιο**
 *    μοντέλο by-reference όταν δεν αλλάζει τίποτα
 */

import { planTableRangeTransfer, tableRangeOverwrittenCells } from '../table-range-transfer-plan';
import type {
  TableRangeTransferPlan,
  TableRangeTransferRequest,
} from '../table-range-transfer-types';
import { applyTableRangeTransfer } from '../table-range-transfer';
import { createTableModel, getPersistedCellText, toPersistedTableModel } from '../table-model-helpers';
import { buildTableEdgeIndex, tableEdgeKeyAt } from '../table-edge-model';
import { PLAIN_TABLE_RANGE_DRAG } from '../table-range-move-zone';
import type {
  CellSpan,
  PersistedTableModel,
  TableCellEntry,
  TableCellStyleOverride,
  TableColumn,
  TableColumnId,
  TableRow,
  TableRowId,
} from '../../../types/table';
import type { TableBorderSpec, TableEdgeEntry } from '../../../types/table-edges';

const COLUMNS: TableColumn[] = ['c0', 'c1', 'c2', 'c3'].map((id) => ({
  id,
  sizing: { kind: 'fixed', widthMm: 20 },
  valueType: 'text',
  align: 'left',
}));

const ROWS: TableRow[] = ['r0', 'r1', 'r2', 'r3'].map((id) => ({ id, rowClass: 'data', heightMm: 8 }));

function persisted(
  cells: TableCellEntry[] = [],
  merges: CellSpan[] = [],
  edges: TableEdgeEntry[] = [],
): PersistedTableModel {
  return toPersistedTableModel(createTableModel({ columns: COLUMNS, rows: ROWS, cells, merges, edges }));
}

const text = (rowId: string, colId: string, value: string): TableCellEntry => [
  rowId as TableRowId,
  colId as TableColumnId,
  { kind: 'text', value },
];

const styled = (
  rowId: string,
  colId: string,
  value: string,
  styleOverride: TableCellStyleOverride,
): TableCellEntry => [
  rowId as TableRowId,
  colId as TableColumnId,
  { kind: 'text', value, styleOverride },
];

const ref = (rowId: string, colId: string) => ({
  rowId: rowId as TableRowId,
  colId: colId as TableColumnId,
});

const PEN: TableBorderSpec = { visible: true, colorHex: '#ff0000', widthMm: 0.35 };

/** Ολόκληρο το μοντέλο ως πλέγμα κειμένου — για συγκρίσεις που διαβάζονται. */
function readGrid(model: PersistedTableModel): string[][] {
  return ROWS.map((row) => COLUMNS.map((col) => getPersistedCellText(model, row.id, col.id)));
}

/** Το σχέδιο, ή αποτυχία με τον λόγο — ώστε ένα απρόσμενο «όχι» να διαβάζεται στο μήνυμα. */
function planOf(model: PersistedTableModel, request: TableRangeTransferRequest): TableRangeTransferPlan {
  const outcome = planTableRangeTransfer(model, request);
  if (!outcome.ok) throw new Error(`Το σχέδιο απορρίφθηκε: ${outcome.reason}`);
  return outcome.plan;
}

function transfer(model: PersistedTableModel, request: TableRangeTransferRequest): PersistedTableModel {
  return applyTableRangeTransfer(model, planOf(model, request));
}

const move = (source: TableRangeTransferRequest['source'], to: ReturnType<typeof ref>) =>
  ({ source, to, intent: PLAIN_TABLE_RANGE_DRAG, shiftAxis: 'down' }) as const;

// ── Το σχέδιο: πότε ΔΕΝ γίνεται ────────────────────────────────────────────────

describe('🔴 §36 planTableRangeTransfer — κάθε άρνηση έχει ΛΟΓΟ, ποτέ σιωπηλό null', () => {
  it('μπαγιάτικος προορισμός (γραμμή που σβήστηκε) ⇒ stale-range', () => {
    const outcome = planTableRangeTransfer(persisted(), move({ firstRow: 0, lastRow: 0, firstCol: 0, lastCol: 0 }, ref('r9', 'c0')));
    expect(outcome).toEqual({ ok: false, reason: 'stale-range' });
  });

  it('η περιοχή δεν προσγειώνεται ΑΚΕΡΑΙΑ ⇒ outside-grid (ο πίνακας δεν μεγαλώνει)', () => {
    const outcome = planTableRangeTransfer(persisted(), move({ firstRow: 0, lastRow: 1, firstCol: 0, lastCol: 0 }, ref('r3', 'c0')));
    expect(outcome).toEqual({ ok: false, reason: 'outside-grid' });
  });

  it('απόθεση στην ίδια θέση ⇒ no-movement — καμία εντολή, κανένα βήμα undo', () => {
    const outcome = planTableRangeTransfer(persisted(), move({ firstRow: 1, lastRow: 1, firstCol: 1, lastCol: 1 }, ref('r1', 'c1')));
    expect(outcome).toEqual({ ok: false, reason: 'no-movement' });
  });

  it('ο στόχος τέμνει συγχώνευση που ΔΕΝ ταξιδεύει ⇒ merged-target (Excel parity)', () => {
    const model = persisted([], [{ anchorRowId: 'r2' as TableRowId, anchorColId: 'c0' as TableColumnId, rowSpan: 1, colSpan: 2 }]);
    const outcome = planTableRangeTransfer(model, move({ firstRow: 0, lastRow: 0, firstCol: 0, lastCol: 0 }, ref('r2', 'c1')));
    expect(outcome).toEqual({ ok: false, reason: 'merged-target' });
  });

  it('🔑 σύρσιμο συγχωνευμένης περιοχής ΠΑΝΩ ΣΤΟΝ ΕΑΥΤΟ ΤΗΣ επιτρέπεται — η ίδια η πράξη την αφαιρεί', () => {
    const span: CellSpan = { anchorRowId: 'r0' as TableRowId, anchorColId: 'c0' as TableColumnId, rowSpan: 1, colSpan: 2 };
    const model = persisted([text('r0', 'c0', 'ΤΙΤΛΟΣ')], [span]);
    const next = transfer(model, move({ firstRow: 0, lastRow: 0, firstCol: 0, lastCol: 1 }, ref('r1', 'c0')));

    expect(next.merges).toEqual([{ ...span, anchorRowId: 'r1' }]);
    expect(getPersistedCellText(next, 'r1' as TableRowId, 'c0' as TableColumnId)).toBe('ΤΙΤΛΟΣ');
    expect(getPersistedCellText(next, 'r0' as TableRowId, 'c0' as TableColumnId)).toBe('');
  });
});

// ── Μετακίνηση ────────────────────────────────────────────────────────────────

describe('🔴 §36 μετακίνηση — το περιεχόμενο φεύγει ΚΑΙ αφήνει πίσω του κενό', () => {
  it('κείμενο μετακομίζει, η πηγή αδειάζει, ο στόχος αντικαθίσταται', () => {
    const model = persisted([text('r0', 'c0', 'Α'), text('r0', 'c1', 'Β'), text('r2', 'c0', 'ΠΑΛΙΟ')]);
    const next = transfer(model, move({ firstRow: 0, lastRow: 0, firstCol: 0, lastCol: 1 }, ref('r2', 'c0')));

    expect(readGrid(next)).toEqual([
      ['', '', '', ''],
      ['', '', '', ''],
      ['Α', 'Β', '', ''],
      ['', '', '', ''],
    ]);
  });

  it('🔑 ΕΠΙΚΑΛΥΠΤΟΜΕΝΟ σύρσιμο — οι πηγές διαβάζονται από την ΠΡΙΝ εικόνα, όχι σβούρισμα', () => {
    const model = persisted([text('r0', 'c0', 'Α'), text('r1', 'c0', 'Β'), text('r2', 'c0', 'Γ')]);
    const next = transfer(model, move({ firstRow: 0, lastRow: 2, firstCol: 0, lastCol: 0 }, ref('r1', 'c0')));

    expect(readGrid(next).map((row) => row[0])).toEqual(['', 'Α', 'Β', 'Γ']);
  });

  it('🔴 Η ΠΑΡΑΚΑΜΨΗ ΣΤΥΛ ΤΟΥ ΚΕΛΙΟΥ ΤΑΞΙΔΕΥΕΙ — και ΦΕΥΓΕΙ από την πηγή (Excel parity)', () => {
    const model = persisted([styled('r0', 'c0', 'Α', { bold: true, fillColorHex: '#eeeeee' })]);
    const next = transfer(model, move({ firstRow: 0, lastRow: 0, firstCol: 0, lastCol: 0 }, ref('r1', 'c1')));

    const landed = next.cells.find(([r, c]) => r === 'r1' && c === 'c1');
    expect(landed?.[2].styleOverride).toEqual({ bold: true, fillColorHex: '#eeeeee' });
    const vacated = next.cells.find(([r, c]) => r === 'r0' && c === 'c0');
    expect(vacated?.[2].styleOverride).toBeUndefined();
    expect(vacated?.[2].value).toBe('');
  });

  it('🔴 ΜΕΤΡΗΜΕΝΗ ΑΠΟΚΛΙΣΗ ΑΠΟ EXCEL: η μορφοποίηση του ΑΞΟΝΑ δεν ταξιδεύει (δοκτρίνα BYLAYER)', () => {
    // Η γραμμή `r0` είναι έντονη· το κελί δεν δηλώνει τίποτα δικό του.
    const rows: TableRow[] = ROWS.map((row) => (row.id === 'r0' ? { ...row, styleOverride: { bold: true } } : row));
    const model = toPersistedTableModel(
      createTableModel({ columns: COLUMNS, rows, cells: [text('r0', 'c0', 'Α')] }),
    );
    const next = transfer(model, move({ firstRow: 0, lastRow: 0, firstCol: 0, lastCol: 0 }, ref('r1', 'c0')));

    // Το Excel θα κουβαλούσε τα έντονα· εμείς **όχι** — το κελί ξανακληρονομεί από τη νέα του
    // γραμμή, όπως μια οντότητα AutoCAD που αλλάζει επίπεδο. Απόφαση, όχι παράλειψη.
    expect(next.cells.find(([r, c]) => r === 'r1' && c === 'c0')?.[2].styleOverride).toBeUndefined();
    expect(next.rows.find((row) => row.id === 'r0')?.styleOverride).toEqual({ bold: true });
  });

  it('🔴 ΟΙ ΡΗΤΕΣ ΑΚΜΕΣ ΤΑΞΙΔΕΥΟΥΝ ΚΑΙ ΔΙΑΓΡΑΦΟΝΤΑΙ ΑΠΟ ΤΗΝ ΠΗΓΗ (ΟΧΙ αόρατη γραμμή)', () => {
    const model = persisted([], [], [['H', 'r0' as TableRowId, 'c0' as TableColumnId, PEN]]);
    const next = transfer(model, move({ firstRow: 0, lastRow: 0, firstCol: 0, lastCol: 0 }, ref('r2', 'c1')));

    const index = buildTableEdgeIndex(next.edges);
    expect(index.get(tableEdgeKeyAt(next, 'H', 2, 1)!)).toEqual(PEN);
    expect(index.has(tableEdgeKeyAt(next, 'H', 0, 0)!)).toBe(false);
  });
});

// ── Αντιγραφή (`Ctrl`) ────────────────────────────────────────────────────────

describe('🔴 §36 αντιγραφή — το ίδιο, ΧΩΡΙΣ άδειασμα της πηγής', () => {
  const copyOf = (source: TableRangeTransferRequest['source'], to: ReturnType<typeof ref>) =>
    ({ source, to, intent: { copy: true, insert: false }, shiftAxis: 'down' }) as const;

  it('η πηγή μένει ακέραιη, ο στόχος γεμίζει', () => {
    const model = persisted([text('r0', 'c0', 'Α'), text('r0', 'c1', 'Β')]);
    const next = transfer(model, copyOf({ firstRow: 0, lastRow: 0, firstCol: 0, lastCol: 1 }, ref('r2', 'c0')));

    expect(readGrid(next)).toEqual([
      ['Α', 'Β', '', ''],
      ['', '', '', ''],
      ['Α', 'Β', '', ''],
      ['', '', '', ''],
    ]);
  });

  it('η συγχώνευση αντιγράφεται — υπάρχει και στις ΔΥΟ θέσεις', () => {
    const span: CellSpan = { anchorRowId: 'r0' as TableRowId, anchorColId: 'c0' as TableColumnId, rowSpan: 1, colSpan: 2 };
    const model = persisted([text('r0', 'c0', 'ΤΙΤΛΟΣ')], [span]);
    const next = transfer(model, copyOf({ firstRow: 0, lastRow: 0, firstCol: 0, lastCol: 1 }, ref('r2', 'c0')));

    expect(next.merges).toEqual([span, { ...span, anchorRowId: 'r2' }]);
  });

  it('οι ρητές ακμές της πηγής ΜΕΝΟΥΝ (αντιγραφή, όχι μετακίνηση)', () => {
    const model = persisted([], [], [['H', 'r0' as TableRowId, 'c0' as TableColumnId, PEN]]);
    const next = transfer(model, copyOf({ firstRow: 0, lastRow: 0, firstCol: 0, lastCol: 0 }, ref('r2', 'c1')));

    const index = buildTableEdgeIndex(next.edges);
    expect(index.get(tableEdgeKeyAt(next, 'H', 0, 0)!)).toEqual(PEN);
    expect(index.get(tableEdgeKeyAt(next, 'H', 2, 1)!)).toEqual(PEN);
  });
});

// ── Εισαγωγή & ολίσθηση (`Shift`) ─────────────────────────────────────────────

describe('🔴 §36 εισαγωγή & ολίσθηση — ΜΕΤΑΘΕΣΗ θέσεων, όχι αντικατάσταση', () => {
  const insertDown = (source: TableRangeTransferRequest['source'], to: ReturnType<typeof ref>, copy = false) =>
    ({ source, to, intent: { copy, insert: true }, shiftAxis: 'down' }) as const;

  it('🔑 ΙΔΙΑ ΛΩΡΙΔΑ: τίποτα δεν χάνεται και τίποτα δεν διπλασιάζεται — η τρύπα ΚΛΕΙΝΕΙ', () => {
    const model = persisted([
      text('r0', 'c0', 'Α'),
      text('r1', 'c0', 'Β'),
      text('r2', 'c0', 'Γ'),
      text('r3', 'c0', 'Δ'),
    ]);
    // Η «Δ» (τελευταία) μπαίνει ανάμεσα στην «Α» και τη «Β».
    const next = transfer(model, insertDown({ firstRow: 3, lastRow: 3, firstCol: 0, lastCol: 0 }, ref('r1', 'c0')));

    expect(readGrid(next).map((row) => row[0])).toEqual(['Α', 'Δ', 'Β', 'Γ']);
  });

  it('η ολίσθηση προς τα κάτω σπρώχνει — δεν αντικαθιστά', () => {
    const model = persisted([text('r0', 'c0', 'ΝΕΟ'), text('r2', 'c0', 'Γ'), text('r3', 'c0', 'Δ')]);
    const next = transfer(model, insertDown({ firstRow: 0, lastRow: 0, firstCol: 0, lastCol: 0 }, ref('r2', 'c0')));

    // Η τρύπα της κορυφής κλείνει (Γ, Δ ανεβαίνουν κατά μία), και η «ΝΕΟ» μπαίνει **πριν** τη «Γ»
    // — δηλαδή ακριβώς εκεί που έδειχνε η γραμμή-Ι. Κανένα κελί δεν αντικαταστάθηκε.
    expect(readGrid(next).map((row) => row[0])).toEqual(['', 'ΝΕΟ', 'Γ', 'Δ']);
  });

  it('🔴 ΔΙΑΦΟΡΕΤΙΚΗ ΛΩΡΙΔΑ: η τρύπα ΔΕΝ κλείνει — αλλιώς η περιοχή θα σχιζόταν', () => {
    const model = persisted([text('r0', 'c0', 'Α'), text('r2', 'c1', 'Χ'), text('r3', 'c1', 'Ψ')]);
    const next = transfer(model, insertDown({ firstRow: 0, lastRow: 0, firstCol: 0, lastCol: 0 }, ref('r2', 'c1')));

    expect(readGrid(next).map((row) => [row[0], row[1]])).toEqual([
      ['', ''],
      ['', ''],
      ['', 'Α'],
      ['', 'Χ'],
    ]);
    // Το «Ψ» έπεσε έξω από το πλέγμα — ο πίνακας δεν μεγαλώνει μόνος του.
  });

  it('αντιγραφή + ολίσθηση (`Ctrl+Shift`): η πηγή μένει, η ουρά κόβεται', () => {
    const model = persisted([text('r0', 'c0', 'Α'), text('r1', 'c0', 'Β'), text('r3', 'c0', 'Δ')]);
    const next = transfer(model, insertDown({ firstRow: 0, lastRow: 0, firstCol: 0, lastCol: 0 }, ref('r1', 'c0'), true));

    expect(readGrid(next).map((row) => row[0])).toEqual(['Α', 'Α', 'Β', '']);
  });
});

// ── Το κατηγόρημα της Φάσης 4 ─────────────────────────────────────────────────

describe('🔴 §36 tableRangeOverwrittenCells — «πόσα θα χαθούν;», ορισμένο ΔΟΜΙΚΑ', () => {
  it('στόχος με δεδομένα ⇒ ναι· στόχος κενός ⇒ όχι', () => {
    const model = persisted([text('r0', 'c0', 'Α'), text('r2', 'c0', 'ΠΑΛΙΟ')]);
    const onto = move({ firstRow: 0, lastRow: 0, firstCol: 0, lastCol: 0 }, ref('r2', 'c0'));
    const empty = move({ firstRow: 0, lastRow: 0, firstCol: 0, lastCol: 0 }, ref('r3', 'c3'));

    expect(tableRangeOverwrittenCells(model, planOf(model, onto))).toBe(1);
    expect(tableRangeOverwrittenCells(model, planOf(model, empty))).toBe(0);
  });

  it('🔑 ΦΑΣΗ 4 — μετρά ΠΟΣΑ, όχι «ναι/όχι»: ο διάλογος λέει αριθμό (NN/g «Delete 3 issues?»)', () => {
    const model = persisted([
      text('r0', 'c0', 'Α'), text('r0', 'c1', 'Β'),
      text('r2', 'c0', 'Χ'), text('r2', 'c1', 'Ψ'), text('r3', 'c0', 'Ω'),
    ]);
    // Περιοχή 2×2 (r0..r1 × c0..c1) πάνω σε προορισμό όπου κατοικούν **τρία** κελιά.
    const onto = move({ firstRow: 0, lastRow: 1, firstCol: 0, lastCol: 1 }, ref('r2', 'c0'));

    expect(tableRangeOverwrittenCells(model, planOf(model, onto))).toBe(3);
  });

  it('🔑 μορφοποίηση ΧΩΡΙΣ κείμενο ΔΕΝ είναι «δεδομένα» (Excel: «There is already data here»)', () => {
    const model = persisted([text('r0', 'c0', 'Α'), styled('r2', 'c0', '', { fillColorHex: '#eeeeee' })]);
    const onto = move({ firstRow: 0, lastRow: 0, firstCol: 0, lastCol: 0 }, ref('r2', 'c0'));

    expect(tableRangeOverwrittenCells(model, planOf(model, onto))).toBe(0);
  });

  it('🔑 η ΟΛΙΣΘΗΣΗ δεν σβήνει ό,τι απλώς σπρώχνει — αλλά ΤΟ ΛΕΕΙ όταν κόβεται η ουρά', () => {
    const roomy = persisted([text('r0', 'c0', 'Α'), text('r1', 'c0', 'Β')]);
    const packed = persisted([text('r0', 'c0', 'Α'), text('r3', 'c1', 'Δ')]);
    const request = { source: { firstRow: 0, lastRow: 0, firstCol: 0, lastCol: 0 }, to: ref('r2', 'c1'), intent: { copy: true, insert: true }, shiftAxis: 'down' } as const;

    expect(tableRangeOverwrittenCells(roomy, planOf(roomy, request))).toBe(0);
    expect(tableRangeOverwrittenCells(packed, planOf(packed, request))).toBe(1);
  });
});

// ── Ένα undo, και η εγγύηση ταυτότητας ────────────────────────────────────────

describe('🔴 §36 ΕΝΑ undo ανά χειρονομία — ΕΝΑ μοντέλο, καμία σύνθετη εντολή', () => {
  it('μεταφορά 6 κελιών ⇒ ΕΝΑ νέο μοντέλο (η ατομικότητα βγαίνει από την καθαρότητα)', () => {
    const cells = ['r0', 'r1'].flatMap((r) => ['c0', 'c1', 'c2'].map((c) => text(r, c, `${r}${c}`)));
    const model = persisted(cells);
    const next = transfer(model, move({ firstRow: 0, lastRow: 1, firstCol: 0, lastCol: 2 }, ref('r2', 'c1')));

    expect(next).not.toBe(model);
    expect(readGrid(next)).toEqual([
      ['', '', '', ''],
      ['', '', '', ''],
      ['', 'r0c0', 'r0c1', 'r0c2'],
      ['', 'r1c0', 'r1c1', 'r1c2'],
    ]);
  });

  it('🔑 κενή περιοχή σε κενό στόχο ⇒ ΤΟ ΙΔΙΟ μοντέλο by-reference (κανένα βήμα undo)', () => {
    const model = persisted([text('r0', 'c0', 'Α')]);
    const next = transfer(model, move({ firstRow: 2, lastRow: 2, firstCol: 2, lastCol: 2 }, ref('r3', 'c3')));

    expect(next).toBe(model);
  });
});

// ── ADR-753: η μορφοποίηση χαρακτήρων ταξιδεύει μαζί με το κείμενό της ─────────

/**
 * 🔴 ADR-753 Φ1 — **ο φύλακας της απαρίθμησης πεδίων.**
 *
 * Τρία σημεία αυτού του αρχείου απαριθμούν τα πεδία του `TableCell` με το χέρι
 * (`transferredCell`, `isBlankCell`, `sameTransferredCell`). Κανένας μεταγλωττιστής δεν
 * επιβάλλει την πληρότητά τους: ένα νέο πεδίο που ξεχνιέται εκεί δεν σπάει το build — **σβήνει
 * σιωπηλά δεδομένα του χρήστη**. Το `runs` ήταν ακριβώς τέτοιο πεδίο, και αυτά τα τρία tests
 * είναι ο λόγος που δεν έμεινε ξεχασμένο.
 */
describe('🔴 ADR-753 τα `runs` ταξιδεύουν αδιαίρετα με το `value`', () => {
  const withRuns = (rowId: string, colId: string, value: string): TableCellEntry => [
    rowId as TableRowId,
    colId as TableColumnId,
    { kind: 'text', value, runs: [{ start: 0, end: 2, style: { bold: true } }] },
  ];

  const runsAt = (model: PersistedTableModel, rowId: string, colId: string) =>
    model.cells.find(([r, c]) => r === rowId && c === colId)?.[2].runs;

  it('η μετακίνηση κουβαλά τη μορφοποίηση — αλλιώς η περιοχή ξεβάφεται σιωπηλά', () => {
    const model = persisted([withRuns('r0', 'c0', 'ΤΕΣΤ')]);
    const next = transfer(model, move({ firstRow: 0, lastRow: 0, firstCol: 0, lastCol: 0 }, ref('r1', 'c1')));

    expect(getPersistedCellText(next, 'r1' as TableRowId, 'c1' as TableColumnId)).toBe('ΤΕΣΤ');
    expect(runsAt(next, 'r1', 'c1')).toEqual([{ start: 0, end: 2, style: { bold: true } }]);
    // Η πηγή αδειάζει ΟΛΟΚΛΗΡΗ — κείμενο και μορφοποίηση μαζί.
    expect(runsAt(next, 'r0', 'c0')).toBeUndefined();
  });

  it('κελί με ΜΟΝΟ runs δεν κρίνεται κενό — δεν πετιέται η εγγραφή του', () => {
    // Κείμενο κενό, μορφοποίηση υπαρκτή: αν το `isBlankCell` δεν κοιτάξει τα `runs`, η
    // εγγραφή χάνεται και μαζί της ό,τι είχε δηλωθεί.
    const only: TableCellEntry = [
      'r0' as TableRowId, 'c0' as TableColumnId,
      { kind: 'text', value: '', runs: [{ start: 0, end: 1, style: { italic: true } }] },
    ];
    const next = transfer(persisted([only]), move({ firstRow: 0, lastRow: 0, firstCol: 0, lastCol: 0 }, ref('r2', 'c2')));
    expect(runsAt(next, 'r2', 'c2')).toBeDefined();
  });

  it('περιοχές που διαφέρουν ΜΟΝΟ στα runs δεν κρίνονται ίδιες', () => {
    // Ίδιο κείμενο εκατέρωθεν, άλλη μορφοποίηση: χωρίς το `runs` στη σύγκριση, η μεταφορά
    // θα θεωρούνταν «τίποτα δεν άλλαξε» και δεν θα γραφόταν ποτέ.
    const model = persisted([withRuns('r0', 'c0', 'ΤΕΣΤ'), text('r1', 'c0', 'ΤΕΣΤ')]);
    const next = transfer(model, move({ firstRow: 0, lastRow: 0, firstCol: 0, lastCol: 0 }, ref('r1', 'c0')));

    expect(next).not.toBe(model);
    expect(runsAt(next, 'r1', 'c0')).toEqual([{ start: 0, end: 2, style: { bold: true } }]);
  });
});
