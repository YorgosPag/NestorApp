/**
 * 🔴 ADR-739 §57 — **ΤΙ ΥΠΟΣΧΕΤΑΙ ΤΟ ΕΣΩΤΕΡΙΚΟ ΠΡΟΧΕΙΡΟ**, και η απόδειξη ότι το τηρεί.
 *
 * Οι άγκυρες δεν ελέγχουν «τρέχει χωρίς σφάλμα». Ελέγχουν τις υποσχέσεις που κάνει η ομάδα
 * «Πρόχειρο» της κορδέλας, και καθεμία μπορεί να σπάσει **μόνη της**:
 *
 * 1. **Τιμές ≠ Τύποι** — η διάκριση που ΔΕΝ υπήρχε πριν το §57 (το `cellText` ενός τύπου
 *    επιστρέφει το αποτέλεσμα, οπότε η παλιά αντιγραφή έδινε **πάντα** τιμές).
 * 2. **Οι σχετικές αναφορές ακολουθούν, οι απόλυτες όχι** — η σημασιολογία του `$`.
 * 3. **Οι όψεις είναι ορθογώνιες στο περιεχόμενο** — «μόνο μορφή» δεν αγγίζει κείμενο, και
 *    αντίστροφα.
 * 4. **Ένα μοντέλο, ένα undo· τίποτα δεν άλλαξε ⇒ ίδια αναφορά.**
 *
 * ⚠️ Ο έλεγχος των τύπων γίνεται μέσω της **υπολογισμένης τιμής**, ποτέ με επιθεώρηση του
 * δέντρου: το δέντρο είναι υλοποίηση, η τιμή είναι η υπόσχεση. Μια άγκυρα πάνω στο σχήμα του
 * δέντρου θα έσπαγε σε κάθε αθώα αναδιάρθρωση του αναλυτή και δεν θα έπιανε ποτέ έναν
 * μετατοπιστή που δείχνει στο λάθος κελί.
 *
 * @see ../table-clipboard-payload.ts
 * @see ../table-clipboard-paste.ts
 */

import { captureTableClipboard } from '../table-clipboard-payload';
import { pasteTableClipboard, type TablePasteRequest } from '../table-clipboard-paste';
import { ALL_TABLE_FORMAT_FACETS } from '../table-format-payload';
import { commitCellWrites, writeCellInput } from '../formula/table-formula-engine';
import { getPersistedCellText } from '../table-model-helpers';
import { hierarchicalTableStyle } from './hierarchical-table-style-fixture';
import type { TableCellRangeBounds } from '../table-cell-range';
import type { TableFormatFacetSet } from '../table-format-payload';
import type {
  PersistedTableModel,
  TableCellEntry,
  TableCellStyleOverride,
  TableCellTextRun,
  TableColumnId,
  TableFormatFacet,
  TableRowId,
} from '../../../types/table';

const STYLE = hierarchicalTableStyle();

/** r0 = κεφαλίδα · r1…r6 = δεδομένα · στήλες A (`c0`) και B (`c1`). */
function model(): PersistedTableModel {
  return {
    columns: [
      { id: 'c0', sizing: { kind: 'hug' }, valueType: 'text', align: 'left' },
      { id: 'c1', sizing: { kind: 'hug' }, valueType: 'text', align: 'left' },
    ],
    rows: [
      { id: 'r0', rowClass: 'header' },
      ...Array.from({ length: 6 }, (_, i) => ({ id: `r${i + 1}`, rowClass: 'data' as const })),
    ],
    cells: [],
    merges: [],
  };
}

const at = (row: number, col: number): TableCellRangeBounds => ({
  firstRow: row,
  lastRow: row,
  firstCol: col,
  lastCol: col,
});

const ref = (row: number, col: number) => ({
  rowId: `r${row}` as TableRowId,
  colId: `c${col}` as TableColumnId,
});

const facets = (...names: readonly TableFormatFacet[]): TableFormatFacetSet => new Set(names);

const FULL: TablePasteRequest = { content: 'formulas', facets: ALL_TABLE_FORMAT_FACETS };
const VALUES: TablePasteRequest = { content: 'values', facets: new Set() };
const FORMULAS: TablePasteRequest = { content: 'formulas', facets: new Set() };
const FORMATS: TablePasteRequest = { content: 'none', facets: ALL_TABLE_FORMAT_FACETS };

/** Πληκτρολόγηση χρήστη — η ΜΙΑ διαδρομή που καταλαβαίνει το `=`. */
function type(m: PersistedTableModel, row: number, col: number, input: string): PersistedTableModel {
  return commitCellWrites(writeCellInput(m, `r${row}` as TableRowId, `c${col}` as TableColumnId, input));
}

const read = (m: PersistedTableModel, row: number, col: number): string =>
  getPersistedCellText(m, `r${row}` as TableRowId, `c${col}` as TableColumnId);

const cellAt = (m: PersistedTableModel, row: number, col: number) =>
  m.cells.find(([r, c]) => r === `r${row}` && c === `c${col}`)?.[2];

const overrideAt = (
  m: PersistedTableModel,
  row: number,
  col: number,
): TableCellStyleOverride | undefined => cellAt(m, row, col)?.styleOverride;

/** Αντιγραφή + επικόλληση σε ένα βήμα — η χειρονομία του χρήστη, όχι δύο κλήσεις. */
function roundTrip(
  m: PersistedTableModel,
  source: TableCellRangeBounds,
  target: { row: number; col: number },
  request: TablePasteRequest,
): PersistedTableModel {
  const payload = captureTableClipboard(m, STYLE, source);
  if (!payload) throw new Error('το πρόχειρο δεν φόρτωσε');
  return pasteTableClipboard(m, STYLE, payload, ref(target.row, target.col), request).model;
}

// ──────────────────────────────────────────────────────────────────────────────

describe('ΥΠΟΣΧΕΣΗ 1 — Τιμές ≠ Τύποι (η διάκριση που δεν υπήρχε πριν το §57)', () => {
  /** A2 = 10, A3 = 20· B2 = `=A2` ⇒ δείχνει 10. */
  function withFormula(): PersistedTableModel {
    let m = model();
    m = type(m, 1, 0, '10');
    m = type(m, 2, 0, '20');
    m = type(m, 1, 1, '=A2');
    return m;
  }

  it('βάση: ο τύπος υπολογίζεται', () => {
    expect(read(withFormula(), 1, 1)).toBe('10');
  });

  it('🔴 «Τύποι»: η σχετική αναφορά ΑΚΟΛΟΥΘΕΙ — B2 (=A2) → B3 γίνεται =A3 ⇒ 20', () => {
    const after = roundTrip(withFormula(), at(1, 1), { row: 2, col: 1 }, FORMULAS);
    expect(read(after, 2, 1)).toBe('20');
    expect(cellAt(after, 2, 1)?.kind).toBe('formula');
  });

  it('🔴 «Τιμές»: προσγειώνεται ο ΑΡΙΘΜΟΣ, όχι ο τύπος — και μένει 10 στη γραμμή του 20', () => {
    const after = roundTrip(withFormula(), at(1, 1), { row: 2, col: 1 }, VALUES);
    expect(read(after, 2, 1)).toBe('10');
    expect(cellAt(after, 2, 1)?.kind).toBe('text');
    expect(cellAt(after, 2, 1)?.formula).toBeUndefined();
  });

  it('🔴 «Τιμές»: αλλαγή της πηγής ΔΕΝ αγγίζει το επικολλημένο — δεν είναι τύπος πια', () => {
    let after = roundTrip(withFormula(), at(1, 1), { row: 2, col: 1 }, VALUES);
    after = type(after, 1, 0, '999');
    expect(read(after, 2, 1)).toBe('10');
  });
});

describe('ΥΠΟΣΧΕΣΗ 2 — το `$` αποφασίζει ποια αναφορά κουνιέται', () => {
  function withAbsolute(): PersistedTableModel {
    let m = model();
    m = type(m, 1, 0, '10');
    m = type(m, 2, 0, '20');
    m = type(m, 1, 1, '=$A$2');
    return m;
  }

  it('🔴 απόλυτη αναφορά ΜΕΝΕΙ: B2 (=$A$2) → B3 δείχνει ακόμη 10', () => {
    const after = roundTrip(withAbsolute(), at(1, 1), { row: 2, col: 1 }, FORMULAS);
    expect(read(after, 2, 1)).toBe('10');
  });

  it('🔴 αναφορά που πέφτει ΕΞΩ από το πλέγμα δεν στραβώνει σιωπηλά σε γειτονικό κελί', () => {
    let m = model();
    m = type(m, 1, 0, 'πάνω');
    // B2 = =A1 (δείχνει στην κεφαλίδα)· επικολλημένο ΜΙΑ γραμμή πάνω θα ζητούσε τη «γραμμή 0».
    m = type(m, 1, 1, '=A1');
    const after = roundTrip(m, at(1, 1), { row: 0, col: 1 }, FORMULAS);
    // Ρητό σφάλμα, ΟΧΙ η τιμή ενός υπαρκτού γειτονικού κελιού: το δεύτερο είναι ο «αθόρυβα
    // λάθος αριθμός σε παραδοτέο» (ADR-720), που κοστίζει περισσότερο από κάθε ορατό `#REF!`.
    expect(read(after, 0, 1)).toBe('#REF!');
  });
});

describe('ΥΠΟΣΧΕΣΗ 3 — οι δύο άξονες είναι ορθογώνιοι', () => {
  it('🔴 «Μορφές»: το κείμενο του στόχου ΔΕΝ αγγίζεται', () => {
    let m = model();
    m = type(m, 3, 0, 'δικό μου');
    const after = roundTrip(m, at(0, 0), { row: 3, col: 0 }, FORMATS);
    expect(read(after, 3, 0)).toBe('δικό μου');
  });

  it('🔴 «Μορφές» κεφαλίδα → δεδομένα: κάτι ΚΑΡΦΩΝΕΤΑΙ (αλλιώς το κουμπί είναι νεκρό)', () => {
    const after = roundTrip(model(), at(0, 0), { row: 3, col: 0 }, FORMATS);
    expect(overrideAt(after, 3, 0)).toBeDefined();
  });

  it('🔴 «Τύποι» (χωρίς όψεις): η μορφή του στόχου ΔΕΝ αγγίζεται', () => {
    let m = model();
    m = type(m, 1, 0, 'πηγή');
    const after = roundTrip(m, at(0, 0), { row: 3, col: 0 }, FORMULAS);
    expect(overrideAt(after, 3, 0)).toBeUndefined();
  });

  it('🔴 υποσύνολο όψεων: μόνο η ζητούμενη ταξιδεύει — το Excel ΔΕΝ μπορεί να το εκφράσει', () => {
    const onlyFill = roundTrip(model(), at(0, 0), { row: 3, col: 0 }, {
      content: 'none',
      facets: facets('fill'),
    });
    const override = overrideAt(onlyFill, 3, 0);
    expect(override).toBeDefined();
    // Η κεφαλίδα του fixture είναι **έντονη** και **γεμισμένη**. Ζητήθηκε μόνο το γέμισμα.
    expect(override?.bold).toBeUndefined();
  });
});

describe('ΥΠΟΣΧΕΣΗ 4 — ένα μοντέλο, ένα undo· το τίποτα δεν γεννά βήμα', () => {
  it('🔴 επικόλληση κενού πάνω σε κενό ⇒ ΙΔΙΑ αναφορά μοντέλου', () => {
    const before = model();
    const after = roundTrip(before, at(1, 0), { row: 2, col: 0 }, FORMULAS);
    expect(after).toBe(before);
  });

  it('🔴 «καμία τιμή, καμία όψη» ⇒ ΙΔΙΑ αναφορά, όχι άδεια εντολή', () => {
    let before = model();
    before = type(before, 1, 0, 'κάτι');
    const after = roundTrip(before, at(1, 0), { row: 2, col: 0 }, {
      content: 'none',
      facets: new Set(),
    });
    expect(after).toBe(before);
  });

  it('περιοχή 2×1 επικολλάται ολόκληρη με ΜΙΑ γραφή μοντέλου', () => {
    let m = model();
    m = type(m, 1, 0, 'ένα');
    m = type(m, 2, 0, 'δύο');
    const after = roundTrip(m, { firstRow: 1, lastRow: 2, firstCol: 0, lastCol: 0 }, { row: 3, col: 0 }, FULL);
    expect([read(after, 3, 0), read(after, 4, 0)]).toEqual(['ένα', 'δύο']);
  });
});

describe('Το αποτύπωμα — ο σύνδεσμος με το πρόχειρο του συστήματος', () => {
  it('🔴 το `text` είναι ΑΚΡΙΒΩΣ το TSV της περιοχής (αλλιώς η ταυτοποίηση δεν δουλεύει ποτέ)', () => {
    let m = model();
    m = type(m, 1, 0, 'Α');
    m = type(m, 1, 1, 'Β');
    const payload = captureTableClipboard(m, STYLE, { firstRow: 1, lastRow: 1, firstCol: 0, lastCol: 1 });
    expect(payload?.text).toBe('Α\tΒ');
  });

  it('το σχήμα και η αφετηρία καταγράφονται για τη μετατόπιση των τύπων', () => {
    const payload = captureTableClipboard(model(), STYLE, { firstRow: 2, lastRow: 3, firstCol: 0, lastCol: 1 });
    expect(payload).toMatchObject({ rows: 2, columns: 2, origin: { row: 2, col: 0 } });
  });
});

describe('Ο πίνακας ΔΕΝ μεγαλώνει μόνος του', () => {
  it('🔴 ό,τι δεν χωράει κόβεται, και η αναφορά το λέει', () => {
    let m = model();
    m = type(m, 1, 0, 'ένα');
    m = type(m, 2, 0, 'δύο');
    const payload = captureTableClipboard(m, STYLE, { firstRow: 1, lastRow: 2, firstCol: 0, lastCol: 0 });
    if (!payload) throw new Error('το πρόχειρο δεν φόρτωσε');
    // Τελευταία γραμμή (r6): χωρά μόνο η πρώτη από τις δύο.
    const result = pasteTableClipboard(m, STYLE, payload, ref(6, 0), FULL);
    expect(result).toMatchObject({ offeredRows: 2, fittedRows: 1 });
  });
});

/**
 * 🔴 ADR-739 §60 — **Η ΑΓΚΥΡΑ ΠΟΥ ΕΛΕΙΠΕ ΑΠΟ ΤΟ §59** (απολογισμός §8.3).
 *
 * Η «Επικόλληση Μορφών» και το **πινέλο μορφοποίησης** καλούν τον **ίδιο** `paintTableFormat`
 * με τις ίδιες όψεις — άρα τα δύο νέα πεδία του §59 (εσοχή, γωνία) καλύπτονταν **δομικά** από
 * τις άγκυρες του πινέλου. Δομικά, όχι **ρητά**: κανένα test αυτού του αρχείου δεν ανέφερε τη
 * λέξη, και το §59 το δήλωσε ειλικρινά ως ημιτελές.
 *
 * ⚠️ Το επικίνδυνο δεν είναι να σπάσει η κοινή μηχανή — είναι να **αποκτήσει δικό της χάρτη
 * όψεων** η μία διαδρομή. Ο χάρτης `FACET_BY_STYLE_KEY` είναι ένας· τη μέρα που κάποιος
 * προσθέσει «γρήγορη» απαρίθμηση πεδίων στο πρόχειρο, αυτά τα δύο είναι ακριβώς όσα θα
 * ξεχαστούν — είναι τα τελευταία που μπήκαν και τα μόνα που δεν έχουν ορατό κουμπί ΟΝ/ΟFF.
 */
describe('§60 — η εσοχή και η γωνία ΤΑΞΙΔΕΥΟΥΝ με τις «Μορφές»', () => {
  /** Πηγή: το κελί A1 δηλώνει **ρητά** εσοχή 3 σκαλιά και γωνία 37°. */
  function withIndentAndRotation(): PersistedTableModel {
    const base = model();
    return {
      ...base,
      cells: [
        ['r1' as TableRowId, 'c0' as TableColumnId, {
          kind: 'text',
          value: 'πηγή',
          styleOverride: { indentLevel: 3, textRotationDeg: 37 },
        }],
      ],
    };
  }

  it('🔴 «Μορφές» μεταφέρει ΚΑΙ την εσοχή ΚΑΙ τη γωνία', () => {
    const after = roundTrip(withIndentAndRotation(), at(1, 0), { row: 4, col: 0 }, FORMATS);
    const override = overrideAt(after, 4, 0);
    expect(override?.indentLevel).toBe(3);
    expect(override?.textRotationDeg).toBe(37);
  });

  it('🔑 ανήκουν στην όψη «Στοίχιση» — ζητώντας ΜΟΝΟ το γέμισμα ΔΕΝ ταξιδεύουν', () => {
    // Είναι η απόδειξη ότι ο χάρτης όψεων είναι πραγματικά ένας: αν κάποιο από τα δύο έπεφτε
    // σε λάθος όψη (ή σε καμία), το «μόνο γέμισμα» θα το κουβαλούσε λαθραία και η επιλογή
    // όψεων — το πράγμα που το Excel δεν μπορεί να εκφράσει — θα ήταν ψέμα.
    const after = roundTrip(withIndentAndRotation(), at(1, 0), { row: 4, col: 0 }, {
      content: 'none',
      facets: facets('fill'),
    });
    expect(overrideAt(after, 4, 0)?.indentLevel).toBeUndefined();
    expect(overrideAt(after, 4, 0)?.textRotationDeg).toBeUndefined();
  });

  it('🔴 ζητώντας ΜΟΝΟ τη «Στοίχιση» ταξιδεύουν — και τίποτα άλλο δεν κρύβεται μαζί τους', () => {
    const after = roundTrip(withIndentAndRotation(), at(1, 0), { row: 4, col: 0 }, {
      content: 'none',
      facets: facets('alignment'),
    });
    const override = overrideAt(after, 4, 0);
    expect(override?.indentLevel).toBe(3);
    expect(override?.textRotationDeg).toBe(37);
    expect(override?.fillColorHex).toBeUndefined();
  });
});

// ──────────────────────────────────────────────────────────────────────────────

/**
 * 🔴 **ΥΠΟΣΧΕΣΗ 5 — ADR-753 §29: η μορφοποίηση ΑΝΑ ΧΑΡΑΚΤΗΡΑ ταξιδεύει με το κείμενό της.**
 *
 * Μέχρι το §29 **καμία** άγκυρα αυτού του αρχείου δεν ανέφερε τη λέξη `runs` — δηλαδή το
 * ερώτημα «επιβιώνει η μορφοποίηση γραμμάτων μιας επικόλλησης;» δεν είχε τεθεί ποτέ. Το
 * σύμπτωμα το ανέφερε ο **ιδιοκτήτης** από την οθόνη, με όλη τη σουίτα πράσινη: το κλασικό
 * «0 = κανείς δεν κοίταξε».
 *
 * ## 🔑 ΤΡΙΑ ΣΚΕΛΗ, ΚΑΙ ΤΟ ΤΡΙΤΟ ΕΙΝΑΙ ΤΟ ΔΙΑΓΝΩΣΤΙΚΟ
 * Χωρίζονται επίτηδες σε «φορτώνει;» · «επιβιώνει με ΠΛΗΡΗ επικόλληση;» · «επιβιώνει ΧΩΡΙΣ
 * μορφή;». Ένα ενιαίο test θα έλεγε μόνο «χάλασε»· τα τρία μαζί **ονομάζουν τον ένοχο**, γιατί
 * η μόνη διαφορά μεταξύ του δεύτερου και του τρίτου είναι το αν κλήθηκε ο **ζωγράφος**.
 */
describe('ΥΠΟΣΧΕΣΗ 5 — ADR-753 §29: η μορφοποίηση ΑΝΑ ΧΑΡΑΚΤΗΡΑ επιβιώνει της επικόλλησης', () => {
  const RED = '#ff0000';

  /** A2 = «ΝΕΣΤΩΡ», με τους **τρεις πρώτους** χαρακτήρες κόκκινους και έντονους. */
  function withRuns(): PersistedTableModel {
    const m = type(model(), 1, 0, 'ΝΕΣΤΩΡ');
    const runs: readonly TableCellTextRun[] = [
      { start: 0, end: 3, style: { textColorHex: RED, bold: true } },
    ];
    return {
      ...m,
      cells: m.cells.map(([rowId, colId, cell]): TableCellEntry =>
        rowId === 'r1' && colId === 'c0' ? [rowId, colId, { ...cell, runs }] : [rowId, colId, cell],
      ),
    };
  }

  it('βάση: το πρόχειρο ΦΟΡΤΩΝΕΙ τη μορφοποίηση χαρακτήρων', () => {
    const payload = captureTableClipboard(withRuns(), STYLE, at(1, 0));
    expect(payload?.cells[0]?.runs?.[0]?.style.textColorHex).toBe(RED);
  });

  it('🔴 ΠΛΗΡΗΣ επικόλληση: τα κόκκινα γράμματα προσγειώνονται κόκκινα', () => {
    const after = roundTrip(withRuns(), at(1, 0), { row: 3, col: 0 }, FULL);
    expect(read(after, 3, 0)).toBe('ΝΕΣΤΩΡ');
    expect(cellAt(after, 3, 0)?.runs?.[0]?.style.textColorHex).toBe(RED);
    expect(cellAt(after, 3, 0)?.runs?.[0]?.style.bold).toBe(true);
  });

  it('🔑 ΔΙΑΓΝΩΣΤΙΚΟ: χωρίς όψεις μορφής τα ίδια runs επιβιώνουν ⇒ ένοχος ο ζωγράφος', () => {
    const after = roundTrip(withRuns(), at(1, 0), { row: 3, col: 0 }, FORMULAS);
    expect(cellAt(after, 3, 0)?.runs?.[0]?.style.textColorHex).toBe(RED);
  });
});
