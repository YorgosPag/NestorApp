/**
 * 🔴 ADR-767 §11.2 #2 / Δ4 — **ΤΙ ΣΗΜΑΔΕΥΕΤΑΙ ΣΤΗΝ ΟΘΟΝΗ, ΚΑΙ ΠΟΣΟ.**
 *
 * ## Η απόφαση που φυλάει αυτό το αρχείο (Giorgio, 07/08)
 * Το «δεμένο» σημαδεύεται **ανά ΣΤΗΛΗ**, όχι ανά κελί. Δεν είναι αισθητική προτίμηση — είναι
 * το μοντέλο: το Δ8 ορίζει **ένα `sourceKey` ανά στήλη**, άρα η στήλη *είναι* η μονάδα του
 * δεσμού. Ένα σημάδι ανά κελί θα δήλωνε γεγονός που το σχήμα δεν έχει.
 *
 * Και έχει μετρήσιμη συνέπεια: σε τοπογραφικό 200 κορυφών × 4 δεμένες στήλες, το «ανά κελί»
 * βάφει **800** σημάδια για να πει κάτι που ισχύει παντού. Το Δ5 ονομάζει ρητά αυτή την
 * αστοχία — «η διαφορά ανάμεσα σε ένδειξη που **διαβάζεται** και σε θόρυβο που ο χρήστης
 * μαθαίνει να **αγνοεί**». Το «δεμένο» είναι ο **κανόνας** μέσα σε δεμένο πίνακα· οι
 * **εξαιρέσεις** (παράκαμψη, σύγκρουση) είναι αυτό που έχει πληροφορία, και μόνο αυτές
 * παίρνουν σημάδι κελιού.
 *
 * ## Οι δύο ιδιότητες που δεν επιτρέπεται να χαθούν
 * 1. **Ο ζωγράφος ΔΕΝ σαρώνει τον πίνακα** (ADR-735): δέχεται τα **ήδη κομμένα** ορατά κελιά
 *    και δεν ξαναρωτά το μοντέλο για γραμμές εκτός παραθύρου.
 * 2. **Καμία σιωπηλή ισοπέδωση**: `overridden` και `conflict` είναι **δύο** σημάδια, όχι ένα
 *    με σημαία. Η παράκαμψη λέει «διαφωνώ», η σύγκρουση λέει «η πηγή κουνήθηκε κάτω από τη
 *    διαφωνία σου» — μόνο η δεύτερη απαιτεί απόφαση (ADR-767 §12, τέταρτη κατάσταση).
 *
 * @see bim/table/binding/table-bound-marks.ts — ο κριτής
 * @see rendering/entities/table/stamp-table-bound-state.ts — ο ζωγράφος
 */

import {
  boundColumnStripsMm,
  boundExceptionMarks,
} from '../binding/table-bound-marks';
import type { TableCellLayout, TableColumnLayout } from '../table-layout-types';
import type {
  PersistedTableModel,
  TableBinding,
  TableCellEntry,
  TableColumn,
  TableRow,
} from '../../../types/table';
import type { TableCellStyle } from '../table-style';

// ─── Σκηνικό ──────────────────────────────────────────────────────────────────

const STYLE = {} as TableCellStyle;

/**
 * ADR-769 Δ7 — δεσμός στον **πίνακα συντεταγμένων**: εκεί το `index` είναι `ordinal`
 * (ποτέ γράψιμο) και το `x` είναι **γράψιμο**. Οι δύο δεμένες στήλες του σκηνικού πέφτουν
 * επίτηδες σε **διαφορετική** πλευρά, ώστε η λωρίδα να μην μπορεί να περάσει με σταθερά.
 */
const BINDING: TableBinding = {
  mode: 'bound',
  sourceRef: { kind: 'survey-coordinates' },
  revision: 'r0',
};

/** Στήλες: `cIdx`/`cX` δεμένες (έχουν `sourceKey`), `cNote` **ελεύθερη**. */
function model(cells: TableCellEntry[]): PersistedTableModel {
  const columns: TableColumn[] = [
    { id: 'cIdx', sizing: { kind: 'fixed', widthMm: 15 }, valueType: 'text', align: 'right', sourceKey: 'index' },
    { id: 'cX', sizing: { kind: 'fixed', widthMm: 25 }, valueType: 'text', align: 'right', sourceKey: 'x' },
    { id: 'cNote', sizing: { kind: 'fixed', widthMm: 30 }, valueType: 'text', align: 'left' },
  ];
  const rows: TableRow[] = [
    { id: 'rHead', rowClass: 'header', heightMm: 8 },
    { id: 'r1', rowClass: 'data', heightMm: 6 },
    { id: 'r2', rowClass: 'data', heightMm: 6 },
  ];
  return { columns, rows, cells, merges: [] };
}

const COLUMNS: readonly TableColumnLayout[] = [
  { id: 'cIdx', xMm: 0, widthMm: 15 },
  { id: 'cX', xMm: 15, widthMm: 25 },
  { id: 'cNote', xMm: 40, widthMm: 30 },
];

function cellLayout(rowId: string, colId: string, y: number): TableCellLayout {
  const column = COLUMNS.find((c) => c.id === colId);
  if (!column) throw new Error(`άγνωστη στήλη ${colId}`);
  return {
    rowId,
    colId,
    rect: { x: column.xMm, y, w: column.widthMm, h: 6 },
    style: STYLE,
    hAlign: 'left',
  } as TableCellLayout;
}

// ─── 1. Το «δεμένο» είναι ΣΤΗΛΗ ───────────────────────────────────────────────

describe('boundColumnStripsMm — το «δεμένο» σημαδεύεται ανά στήλη (Δ8)', () => {
  it('μία λωρίδα ανά στήλη ΜΕ sourceKey — η ελεύθερη στήλη δεν παίρνει καμία', () => {
    const strips = boundColumnStripsMm(model([]), BINDING, COLUMNS);

    expect(strips.map((s) => s.colId)).toEqual(['cIdx', 'cX']);
  });

  it('🔴 Η ΛΩΡΙΔΑ ΔΗΛΩΝΕΙ ΜΟΝΟ ΤΟ ΟΡΙΖΟΝΤΙΟ ΕΥΡΟΣ ΤΗΣ ΣΤΗΛΗΣ — το ΠΑΧΟΣ είναι οθόνη', () => {
    // Το πάχος ενός δείκτη διεπαφής είναι σταθερό σε **px** (όπως κάθε άλλος δείκτης του
    // πίνακα: δρομέας, ζώνες, μυρμήγκια). Αν γεννιόταν εδώ σε mm, θα χόντραινε με το zoom
    // και θα έπρεπε να μπει `pxPerMm` σε καθαρή συνάρτηση του μοντέλου — δηλαδή η γεωμετρία
    // θα μάθαινε την κλίμακα της οθόνης. Ο ζωγράφος κατέχει το πάχος, εδώ ζει το «ποιες».
    const [idx, x] = boundColumnStripsMm(model([]), BINDING, COLUMNS);

    // ADR-769 Δ7 — το `writable` ταξιδεύει δίπλα στο εύρος: είναι **κρίση**, όχι γεωμετρία,
    // και γι' αυτό ζει εδώ και όχι στον ζωγράφο (που δεν ξέρει τι είναι `sourceKey`).
    expect(idx).toEqual({ colId: 'cIdx', xMm: 0, widthMm: 15, writable: false });
    expect(x).toEqual({ colId: 'cX', xMm: 15, widthMm: 25, writable: true });
  });

  it('🔴 ΤΟ ΠΛΗΘΟΣ ΕΙΝΑΙ O(ΣΤΗΛΕΣ), ΟΧΙ O(ΚΕΛΙΑ) — 200 γραμμές δίνουν ΠΑΛΙ 2 σημάδια', () => {
    const many: TableCellEntry[] = [];
    for (let i = 0; i < 200; i++) {
      many.push([`r${i}`, 'cIdx', { kind: 'text', value: i, bound: { sourceValue: i } }]);
      many.push([`r${i}`, 'cX', { kind: 'text', value: i, bound: { sourceValue: i } }]);
    }

    expect(boundColumnStripsMm(model(many), BINDING, COLUMNS)).toHaveLength(2);
  });

  it('πίνακας ΧΩΡΙΣ καμία δεμένη στήλη δεν γεννά λωρίδα — τίποτα να ζωγραφιστεί', () => {
    const free: PersistedTableModel = {
      ...model([]),
      columns: model([]).columns.map(({ sourceKey: _drop, ...rest }) => rest),
    };

    expect(boundColumnStripsMm(free, BINDING, COLUMNS)).toEqual([]);
  });

  it('στήλη του μοντέλου που ΔΕΝ υπάρχει στη διάταξη αγνοείται αντί να μαντευτεί', () => {
    const missing = COLUMNS.filter((c) => c.id !== 'cX');

    expect(boundColumnStripsMm(model([]), BINDING, missing).map((s) => s.colId)).toEqual(['cIdx']);
  });
});

// ─── 2. Οι ΕΞΑΙΡΕΣΕΙΣ είναι κελιά ─────────────────────────────────────────────

describe('boundExceptionMarks — μόνο ό,τι αποκλίνει παίρνει σημάδι κελιού', () => {
  const visible = [
    cellLayout('r1', 'cIdx', 8),
    cellLayout('r1', 'cX', 8),
    cellLayout('r2', 'cIdx', 14),
    cellLayout('r2', 'cX', 14),
  ];

  it('🔴 ΔΕΜΕΝΟ ΚΕΛΙ ΧΩΡΙΣ ΑΠΟΚΛΙΣΗ ΔΕΝ ΣΗΜΑΔΕΥΕΤΑΙ — αλλιώς 800 σημάδια σε 200 κορυφές', () => {
    const m = model([
      ['r1', 'cIdx', { kind: 'text', value: 'Κ1', bound: { sourceValue: 'Κ1' } }],
      ['r1', 'cX', { kind: 'text', value: 1, bound: { sourceValue: 1 } }],
    ]);

    expect(boundExceptionMarks(m, visible)).toEqual([]);
  });

  it('η παράκαμψη σημαδεύεται ως «overridden»', () => {
    const m = model([
      ['r1', 'cX', { kind: 'text', value: 9, bound: { sourceValue: 1, overridden: true } }],
    ]);

    expect(boundExceptionMarks(m, visible)).toEqual([
      { rowId: 'r1', colId: 'cX', state: 'overridden', rect: { x: 15, y: 8, w: 25, h: 6 } },
    ]);
  });

  it('🔴 Η ΣΥΓΚΡΟΥΣΗ ΕΙΝΑΙ ΔΙΚΗ ΤΗΣ ΚΑΤΑΣΤΑΣΗ — ποτέ «παράκαμψη με σημαία»', () => {
    const m = model([
      ['r1', 'cX', { kind: 'text', value: 9, bound: { sourceValue: 2, overridden: true, conflict: true } }],
    ]);

    expect(boundExceptionMarks(m, visible).map((k) => k.state)).toEqual(['conflict']);
  });

  it('ελεύθερο κελί (χωρίς `bound`) δεν σημαδεύεται ποτέ', () => {
    const m = model([['r1', 'cNote', { kind: 'text', value: 'γωνία' }]]);

    expect(boundExceptionMarks(m, [...visible, cellLayout('r1', 'cNote', 8)])).toEqual([]);
  });

  it('🔴 ΚΕΛΙ ΕΚΤΟΣ ΤΟΥ ΟΡΑΤΟΥ ΠΑΡΑΘΥΡΟΥ ΔΕΝ ΓΕΝΝΑ ΣΗΜΑΔΙ (ADR-735)', () => {
    const m = model([
      ['r1', 'cX', { kind: 'text', value: 9, bound: { sourceValue: 1, overridden: true } }],
      ['r99', 'cX', { kind: 'text', value: 9, bound: { sourceValue: 1, conflict: true } }],
    ]);

    // Το `r99` υπάρχει στο μοντέλο αλλά ΟΧΙ στα ορατά κελιά που έδωσε ο ζωγράφος.
    expect(boundExceptionMarks(m, visible).map((k) => k.rowId)).toEqual(['r1']);
  });

  it('η σειρά ακολουθεί τα ΟΡΑΤΑ κελιά — ντετερμινιστική, ίδια με τη ζωγραφική', () => {
    const m = model([
      ['r2', 'cX', { kind: 'text', value: 9, bound: { sourceValue: 1, overridden: true } }],
      ['r1', 'cIdx', { kind: 'text', value: 9, bound: { sourceValue: 1, overridden: true } }],
    ]);

    expect(boundExceptionMarks(m, visible).map((k) => `${k.rowId}/${k.colId}`)).toEqual([
      'r1/cIdx',
      'r2/cX',
    ]);
  });
});
