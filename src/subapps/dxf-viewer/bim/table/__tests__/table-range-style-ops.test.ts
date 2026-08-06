/**
 * ADR-739 — μορφοποίηση σε **περιοχή κελιών**.
 *
 * Πέντε πράγματα αποδεικνύονται εδώ, και κανένα δεν φαίνεται διαβάζοντας τον κώδικα:
 *  1. **καμία εγγραφή-φάντασμα** — η αφαίρεση σε καθαρή περιοχή δεν γεννά κελιά (μετρημένο
 *     πλήθος, όχι «μοιάζει σωστό»)·
 *  2. **ίδιο μοντέλο by-reference** στο no-op ⇒ κανένα βήμα undo·
 *  3. τα **runs ισοπεδώνονται κατά πεδίο** — αλλιώς το «Β» δεν φαίνεται ποτέ σε βαμμένο κελί·
 *  4. η «Επαναφορά» σβήνει runs **και** παράκαμψη, αλλά **ποτέ** άξονα·
 *  5. `overridden` = `every`, `canReset` = `some` — δύο ερωτήσεις, δύο απαντήσεις.
 *
 * @see bim/table/table-range-style-ops.ts
 */

import {
  clearRangeStyleOverride,
  hasAnyRangeStyleOverride,
  resolveRangeFormat,
  setRangeStyleField,
} from '../table-range-style-ops';
import { hierarchicalTableStyle } from './hierarchical-table-style-fixture';
import type { TableCellRangeBounds } from '../table-cell-range';
import type { PersistedTableModel, TableCellTextRun } from '../../../types/table';

const HIERARCHICAL = hierarchicalTableStyle();

/** Κεφαλίδα + δύο γραμμές δεδομένων × δύο στήλες, χωρίς κανένα κελί (ο χάρτης είναι αραιός). */
function model(): PersistedTableModel {
  return {
    columns: [
      { id: 'c0', sizing: { kind: 'hug' }, valueType: 'text', align: 'left' },
      { id: 'c1', sizing: { kind: 'hug' }, valueType: 'text', align: 'left' },
    ],
    rows: [
      { id: 'r0', rowClass: 'header' },
      { id: 'r1', rowClass: 'data' },
      { id: 'r2', rowClass: 'data' },
    ],
    cells: [],
    merges: [],
  };
}

/** Οι δύο γραμμές δεδομένων × δύο στήλες = 4 κελιά. */
const DATA: TableCellRangeBounds = { firstRow: 1, lastRow: 2, firstCol: 0, lastCol: 1 };
/** Ένα κελί. */
const ONE: TableCellRangeBounds = { firstRow: 1, lastRow: 1, firstCol: 0, lastCol: 0 };

describe('setRangeStyleField — εγγραφή', () => {
  it('γράφει την παράκαμψη σε ΚΑΘΕ κελί της περιοχής και μόνο εκεί', () => {
    const next = setRangeStyleField(model(), DATA, 'bold', true);
    expect(next.cells).toHaveLength(4);
    expect(next.cells.every(([, , cell]) => cell.styleOverride?.bold === true)).toBe(true);
    // Η γραμμή κεφαλίδας (r0) έμεινε έξω.
    expect(next.cells.some(([rowId]) => rowId === 'r0')).toBe(false);
  });

  it('🔴 ΚΑΜΙΑ εγγραφή-φάντασμα: η αφαίρεση σε καθαρή περιοχή δεν γεννά κελιά', () => {
    const start = model();
    const next = setRangeStyleField(start, DATA, 'bold', undefined);
    expect(next.cells).toHaveLength(0);
    expect(next).toBe(start); // και άρα κανένα βήμα undo
  });

  it('🔴 no-op by-reference: ίδια τιμή σε ήδη γραμμένα κελιά ⇒ το ΙΔΙΟ μοντέλο', () => {
    const bold = setRangeStyleField(model(), DATA, 'bold', true);
    expect(setRangeStyleField(bold, DATA, 'bold', true)).toBe(bold);
  });

  it('`null` μένει ως ρητό ΚΑΝΕΝΑ, δεν εξαφανίζεται', () => {
    const next = setRangeStyleField(model(), ONE, 'fillColorHex', null);
    expect(next.cells[0][2].styleOverride).toEqual({ fillColorHex: null });
  });

  it('η αφαίρεση του τελευταίου πεδίου δεν αφήνει κενό αντικείμενο πίσω της', () => {
    const bold = setRangeStyleField(model(), ONE, 'bold', true);
    const none = setRangeStyleField(bold, ONE, 'bold', undefined);
    expect(none.cells[0][2].styleOverride).toBeUndefined();
  });

  it('διατηρεί το περιεχόμενο του κελιού — μορφοποιεί, δεν ξαναγράφει', () => {
    const withText: PersistedTableModel = {
      ...model(),
      cells: [['r1', 'c0', { kind: 'text', value: 'Εμβαδόν' }]],
    };
    const next = setRangeStyleField(withText, ONE, 'bold', true);
    expect(next.cells[0][2].value).toBe('Εμβαδόν');
    expect(next.cells[0][2].styleOverride?.bold).toBe(true);
  });
});

describe('🔴 runs — η ισοπέδωση κατά πεδίο (ADR-753)', () => {
  /** «ΑΒΓΔΕ» με τα τρία πρώτα γράμματα ρητά ΟΧΙ έντονα και κόκκινα. */
  function withRuns(): PersistedTableModel {
    const runs: readonly TableCellTextRun[] = [
      { start: 0, end: 3, style: { bold: false, textColorHex: '#FF0000' } },
    ];
    return {
      ...model(),
      cells: [['r1', 'c0', { kind: 'text', value: 'ΑΒΓΔΕ', runs }]],
    };
  }

  it('«Β» σε κελί με run που λέει ΟΧΙ-έντονο: το run χάνει ΤΟ ΠΕΔΙΟ, όχι τον εαυτό του', () => {
    const next = setRangeStyleField(withRuns(), ONE, 'bold', true);
    const cell = next.cells[0][2];
    expect(cell.styleOverride?.bold).toBe(true);
    // Το `bold` έφυγε από το run (αλλιώς θα νικούσε το κελί και το κουμπί θα έλεγε ψέματα)…
    expect(cell.runs?.[0].style.bold).toBeUndefined();
    // …αλλά το κόκκινο ΕΠΙΒΙΩΣΕ: κόκκινο γράμμα μένει κόκκινο όταν το κελί γίνεται έντονο.
    expect(cell.runs?.[0].style.textColorHex).toBe('#FF0000');
  });

  it('πεδίο ΕΚΤΟΣ της τομής (`align`) αφήνει τα runs ανέγγιχτα by-reference', () => {
    const start = withRuns();
    const next = setRangeStyleField(start, ONE, 'align', 'MC');
    expect(next.cells[0][2].runs).toBe(start.cells[0][2].runs);
  });

  it('κελί χωρίς runs δεν αποκτά runs από τη μορφοποίηση', () => {
    const next = setRangeStyleField(model(), ONE, 'bold', true);
    expect(next.cells[0][2].runs).toBeUndefined();
  });
});

describe('clearRangeStyleOverride — «Απαλοιφή μορφοποίησης»', () => {
  it('σβήνει την παράκαμψη ΚΑΙ τα runs', () => {
    const runs: readonly TableCellTextRun[] = [{ start: 0, end: 2, style: { bold: true } }];
    const start: PersistedTableModel = {
      ...model(),
      cells: [['r1', 'c0', { kind: 'text', value: 'ΑΒΓ', styleOverride: { italic: true }, runs }]],
    };
    const next = clearRangeStyleOverride(start, ONE);
    expect(next.cells[0][2].styleOverride).toBeUndefined();
    expect(next.cells[0][2].runs).toBeUndefined();
    expect(next.cells[0][2].value).toBe('ΑΒΓ'); // το περιεχόμενο μένει
  });

  it('🔴 ΔΕΝ αγγίζει ποτέ άξονα — η γραμμή και η στήλη επιβιώνουν αυτούσιες', () => {
    const m = model();
    const start: PersistedTableModel = {
      ...m,
      columns: [{ ...m.columns[0], styleOverride: { bold: true } }, m.columns[1]],
      rows: [m.rows[0], { ...m.rows[1], styleOverride: { italic: true } }, m.rows[2]],
      cells: [['r1', 'c0', { kind: 'text', value: '', styleOverride: { underline: true } }]],
    };
    const next = clearRangeStyleOverride(start, ONE);
    expect(next.columns[0].styleOverride).toEqual({ bold: true });
    expect(next.rows[1].styleOverride).toEqual({ italic: true });
    expect(next.cells[0][2].styleOverride).toBeUndefined();
  });

  it('καθαρή περιοχή ⇒ το ίδιο μοντέλο, κανένα φάντασμα, κανένα βήμα undo', () => {
    const start = model();
    expect(clearRangeStyleOverride(start, DATA)).toBe(start);
  });
});

describe('οι δύο διαφορετικές ερωτήσεις', () => {
  /** Ένα από τα τέσσερα κελιά δηλώνει κάτι ρητά. */
  function partly(): PersistedTableModel {
    return setRangeStyleField(model(), ONE, 'bold', true);
  }

  it('`hasAnyRangeStyleOverride` = SOME — «υπάρχει τι να σβηστεί;»', () => {
    expect(hasAnyRangeStyleOverride(partly(), DATA)).toBe(true);
    expect(hasAnyRangeStyleOverride(model(), DATA)).toBe(false);
  });

  it('🔴 `overridden` = EVERY — «το βλέπεις επειδή το ζήτησες εσύ»', () => {
    expect(resolveRangeFormat(partly(), HIERARCHICAL, DATA, 'bold')?.overridden).toBe(false);
    const all = setRangeStyleField(model(), DATA, 'bold', true);
    expect(resolveRangeFormat(all, HIERARCHICAL, DATA, 'bold')?.overridden).toBe(true);
  });

  it('ένα κελί ρητά έντονο ανάμεσα σε τρία μη-έντονα ⇒ μεικτό', () => {
    expect(resolveRangeFormat(partly(), HIERARCHICAL, DATA, 'bold'))
      .toEqual({ value: undefined, mixed: true, overridden: false });
  });

  it('τα runs ΔΕΝ επηρεάζουν την ανάγνωση — ο σαρωτής ρωτά για το κελί', () => {
    const runs: readonly TableCellTextRun[] = [{ start: 0, end: 2, style: { bold: true } }];
    const start: PersistedTableModel = {
      ...model(),
      cells: [['r1', 'c0', { kind: 'text', value: 'ΑΒΓ', runs }]],
    };
    expect(resolveRangeFormat(start, HIERARCHICAL, DATA, 'bold'))
      .toEqual({ value: false, mixed: false, overridden: false });
  });

  it('μπαγιάτικα όρια ⇒ `null`, ο καλών σβήνει', () => {
    const stale: TableCellRangeBounds = { firstRow: 9, lastRow: 9, firstCol: 9, lastCol: 9 };
    expect(resolveRangeFormat(model(), HIERARCHICAL, stale, 'bold')).toBeNull();
  });
});
