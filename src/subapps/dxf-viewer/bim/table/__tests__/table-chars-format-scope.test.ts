/**
 * 🔴 ADR-753 Φ4 — **ο ΤΡΙΤΟΣ στόχος: τα γράμματα.**
 *
 * Το ερώτημα αυτής της ομάδας δεν είναι αν δουλεύουν οι πράξεις πάνω σε runs — αυτό το απαντά
 * το `table-cell-run-ops.test.ts`. Είναι τρία άλλα, και το καθένα αντιστοιχεί σε ένα σφάλμα
 * που **δεν** θα το έπιανε κανένα από τα δύο υπάρχοντα σκέλη:
 *
 *  1. **Το «Β» βάφει ΜΟΝΟ τα μαρκαρισμένα γράμματα** — το ελάττωμα που γέννησε τη Φ4.
 *  2. **Ό,τι δεν έχει νόημα ανά χαρακτήρα πέφτει στο ΚΕΛΙ**, και όχι στο πουθενά.
 *  3. **Η ανάγνωση λέει την αλήθεια για την οθόνη**: τα γράμματα κληρονομούν από το κελί, που
 *     κληρονομεί από γραμμή/στήλη/κλάση.
 *
 * @see bim/table/table-format-scope.ts
 * @see bim/table/table-chars-style-ops.ts
 */

import {
  canResetTableFormatScope,
  clearTableFormatScope,
  resolveTableFormatState,
  setTableFormatField,
  stepTableFormatTextHeight,
  tableCharsFormatScopeOf,
  tableFormatNumericRange,
  tableFormatScopeBounds,
  type TableFormatScope,
} from '../table-format-scope';
import { hierarchicalTableStyle } from './hierarchical-table-style-fixture';
import type { PersistedTableModel, TableCell, TableCellTextRun } from '../../../types/table';

const STYLE = hierarchicalTableStyle();
const AT = { rowId: 'r1', colId: 'c0' };

/** `ΝΕΣΤΩΡ` — έξι χαρακτήρες, ώστε τα `[2,4)` να είναι όντως «μεσαία». */
const TEXT = 'ΝΕΣΤΩΡ';

function model(cell?: Partial<TableCell>): PersistedTableModel {
  return {
    columns: [
      { id: 'c0', sizing: { kind: 'hug' }, valueType: 'text', align: 'left' },
      { id: 'c1', sizing: { kind: 'hug' }, valueType: 'text', align: 'left' },
    ],
    rows: [{ id: 'r0', rowClass: 'header' }, { id: 'r1', rowClass: 'data' }],
    cells: cell === undefined
      ? []
      : [['r1', 'c0', { kind: 'text', value: TEXT, ...cell } as TableCell]],
    merges: [],
  };
}

/**
 * Ο στόχος «τα γράμματα 2-3», δηλαδή το `ΣΤ` του `ΝΕΣΤΩΡ`.
 *
 * 🔴 ADR-753 §25 — το εύρος δηλώνει **πάνω σε ποιο κείμενο μετρήθηκε**. Δεν είναι τυπικότητα
 * του test: είναι η ίδια δήλωση που οφείλει να κάνει κάθε επιφάνεια, και ο γραφέας την
 * επαληθεύει (δες την ομάδα «η βάση των δεικτών»).
 */
function middle(m: PersistedTableModel = model({})): TableFormatScope {
  const scope = tableCharsFormatScopeOf(m, AT, { start: 2, end: 4, text: TEXT });
  if (scope === null) throw new Error('ο στόχος όφειλε να υπάρχει');
  return scope;
}

/** Το στυλ κάθε χαρακτήρα, ως συμβολοσειρά — `.` σημαίνει «τίποτα δηλωμένο». */
function readBack(runs: readonly TableCellTextRun[] | undefined, length: number): string[] {
  return Array.from({ length }, (_, i) => {
    const run = runs?.find((r) => r.start <= i && i < r.end);
    if (!run) return '.';
    return `${run.style.bold ? 'Β' : ''}${run.style.italic ? 'Ι' : ''}` || '?';
  });
}

const cellOf = (m: PersistedTableModel): TableCell | undefined => m.cells[0]?.[2];

describe('🔴 tableCharsFormatScopeOf — ο κατασκευαστής', () => {
  it('δίνει σκέλος `chars` με το κελί και το εύρος αυτούσια — **μαζί με τη βάση του**', () => {
    expect(middle())
      .toEqual({ kind: 'chars', cell: AT, range: { start: 2, end: 4, text: TEXT } });
  });

  it('🔴 κελί που δεν λύνεται ⇒ `null` — ο καλών σβήνει, δεν γράφει στο πουθενά', () => {
    expect(tableCharsFormatScopeOf(
      model({}), { rowId: 'χ', colId: 'ψ' }, { start: 0, end: 1, text: TEXT },
    )).toBeNull();
  });
});

/**
 * 🔴 ADR-753 §25 — **Η ΒΑΣΗ ΤΩΝ ΔΕΙΚΤΩΝ ΕΠΑΛΗΘΕΥΕΤΑΙ, ΔΕΝ ΥΠΟΤΙΘΕΤΑΙ.**
 *
 * Η ζωντανή βλάβη: οι δείκτες διαβάζονταν από το πεδίο του DOM ενώ το κείμενο που έφτανε στο
 * μοντέλο ερχόταν από το πρόχειρο του δρομέα. Όταν το δεύτερο ήταν **πρόθεμα** του πρώτου, το
 * `[2,4)` προσγειωνόταν σε κοντύτερο κείμενο και η επόμενη δέσμευση το άπλωνε ως τα άκρα
 * (`remapCellTextRuns`) — «τέσσερα έντονα αντί για δύο».
 *
 * ⚠️ Το `clampRange` **δεν** το πιάνει, και αυτό είναι το όλο νόημα αυτής της ομάδας: κόβει
 * δείκτες που **ξεφεύγουν**, όχι δείκτες που **χωράνε και δείχνουν αλλού**.
 */
describe('🔴 §25 — η βάση των δεικτών: γραφή πάνω σε ΑΛΛΟ κείμενο ⇒ ΑΡΝΗΣΗ', () => {
  /** Ο ίδιος στόχος, αλλά μετρημένος πάνω σε **πρόθεμα** του πραγματικού κειμένου. */
  const staleBase = (m: PersistedTableModel): TableFormatScope => {
    const scope = tableCharsFormatScopeOf(m, AT, { start: 2, end: 4, text: 'ΝΕΣΤ' });
    if (scope === null) throw new Error('ο στόχος όφειλε να υπάρχει');
    return scope;
  };

  it('🔴 «Β» με μπαγιάτικη βάση δεν γράφει ΤΙΠΟΤΑ — ίδιο μοντέλο by-reference', () => {
    const before = model({});
    expect(setTableFormatField(before, staleBase(before), 'bold', true)).toBe(before);
  });

  it('🔴 και η ΑΠΑΛΟΙΦΗ αρνείται — δεν σβήνει μορφοποίηση που δεν στόχευσε ο χρήστης', () => {
    const painted = model({ runs: [{ start: 0, end: 6, style: { bold: true } }] });
    expect(clearTableFormatScope(painted, staleBase(painted))).toBe(painted);
  });

  it('🔴 και το `A↑` — κάθε γραφέας περνά από τον ίδιο φρουρό, όχι ο καθένας τον δικό του', () => {
    const before = model({});
    expect(stepTableFormatTextHeight(before, STYLE, staleBase(before), 1)).toBe(before);
  });

  it('✅ ΙΔΙΑ βάση ⇒ γράφει κανονικά — ο φρουρός δεν είναι μπλόκο, είναι ερώτηση', () => {
    const next = setTableFormatField(model({}), middle(), 'bold', true);
    expect(readBack(cellOf(next)?.runs, TEXT.length)).toEqual(['.', '.', 'Β', 'Β', '.', '.']);
  });

  it('🔴 η ΑΝΑΓΝΩΣΗ ΔΕΝ αρνείται — αλλιώς ένας χαρακτήρας παραπάνω θα έσβηνε την ένδειξη', () => {
    // Δηλωμένη ασυμμετρία: το κουμπί οφείλει να δείχνει την κατάσταση των **ίδιων** γραμμάτων
    // όσο η απόκλιση δεν τα μετακινεί· η γραφή είναι που δεν επιτρέπεται να μαντέψει.
    const half = model({ runs: [{ start: 2, end: 4, style: { bold: true } }] });
    expect(resolveTableFormatState(half, STYLE, staleBase(half), 'bold')?.value).toBe(true);
  });
});

describe('🔴 Η ΚΑΡΔΙΑ ΤΗΣ Φ4 — βάφονται ΜΟΝΟ τα μαρκαρισμένα γράμματα', () => {
  it('«Β» σε `[2,4)` αφήνει τους υπόλοιπους τέσσερις άβαφους', () => {
    const next = setTableFormatField(model({}), middle(), 'bold', true);
    expect(readBack(cellOf(next)?.runs, TEXT.length)).toEqual(['.', '.', 'Β', 'Β', '.', '.']);
  });

  it('🔴 ΔΕΝ αγγίζει την παράκαμψη του κελιού — αλλιώς θα βάφονταν και τα έξι', () => {
    const next = setTableFormatField(model({}), middle(), 'bold', true);
    expect(cellOf(next)?.styleOverride).toBeUndefined();
  });

  it('δεύτερη εντολή σε ΙΔΙΑ γράμματα προστίθεται, δεν αντικαθιστά', () => {
    const bold = setTableFormatField(model({}), middle(), 'bold', true);
    const both = setTableFormatField(bold, middle(bold), 'italic', true);
    expect(readBack(cellOf(both)?.runs, TEXT.length)).toEqual(['.', '.', 'ΒΙ', 'ΒΙ', '.', '.']);
  });

  it('🔴 ταυτότητα by-reference στο no-op — κανένα βήμα undo για το τίποτα', () => {
    const bold = setTableFormatField(model({}), middle(), 'bold', true);
    expect(setTableFormatField(bold, middle(bold), 'bold', true)).toBe(bold);
  });

  it('🔴 κελί που ΔΕΝ υπάρχει δεν αποκτά εγγραφή — δεν έχει χαρακτήρες να βαφτούν', () => {
    const empty = model();
    const next = setTableFormatField(empty, middle(empty), 'bold', true);
    expect(next).toBe(empty);
  });
});

describe('🔴 ό,τι ΔΕΝ έχει νόημα ανά χαρακτήρα πέφτει στο ΚΕΛΙ — και είναι το Excel', () => {
  it('το γέμισμα βάφει το κελί, όχι τα γράμματα', () => {
    const next = setTableFormatField(model({}), middle(), 'fillColorHex', '#ff0000');
    expect(cellOf(next)?.styleOverride).toEqual({ fillColorHex: '#ff0000' });
    expect(cellOf(next)?.runs).toBeUndefined();
  });

  it('🔴 η στοίχιση επίσης — ένα γράμμα δεν έχει δική του στοίχιση', () => {
    const next = setTableFormatField(model({}), middle(), 'align', 'center');
    expect(cellOf(next)?.styleOverride).toEqual({ align: 'center' });
    expect(cellOf(next)?.runs).toBeUndefined();
  });

  it('το χρώμα ΚΕΙΜΕΝΟΥ όμως βάφει τα γράμματα — εκεί είναι η διαφορά', () => {
    const next = setTableFormatField(model({}), middle(), 'textColorHex', '#ff0000');
    expect(cellOf(next)?.styleOverride).toBeUndefined();
    expect(cellOf(next)?.runs).toEqual([{ start: 2, end: 4, style: { textColorHex: '#ff0000' } }]);
  });

  it('🔴 τα όρια του στόχου είναι ΤΟ ΚΕΛΙ — έτσι δουλεύουν περιγράμματα/συγχώνευση/ξεχείλισμα', () => {
    expect(tableFormatScopeBounds(model({}), middle()))
      .toEqual({ firstRow: 1, lastRow: 1, firstCol: 0, lastCol: 0 });
  });
});

describe('🔴 η ανάγνωση λέει την αλήθεια για την οθόνη', () => {
  it('άβαφα γράμματα δείχνουν την ΚΛΗΡΟΝΟΜΙΑ του κελιού, όχι «όχι έντονα»', () => {
    const bolded = { ...model({}), rows: [
      { id: 'r0', rowClass: 'header' as const },
      { id: 'r1', rowClass: 'data' as const, styleOverride: { bold: true } },
    ] };
    const state = resolveTableFormatState(bolded, STYLE, middle(bolded), 'bold');
    expect(state).toEqual({ value: true, mixed: false, overridden: false });
  });

  it('🔴 μισή επιλογή βαμμένη ⇒ `mixed` — Figma «Mixed», Revit «<varies>»', () => {
    const half = model({ runs: [{ start: 2, end: 3, style: { bold: true } }] });
    expect(resolveTableFormatState(half, STYLE, middle(half), 'bold'))
      .toEqual({ value: undefined, mixed: true, overridden: true });
  });

  it('πεδίο εκτός λεξιλογίου των runs απαντά ΓΙΑ ΤΟ ΚΕΛΙ', () => {
    const filled = model({ styleOverride: { fillColorHex: '#00ff00' } });
    expect(resolveTableFormatState(filled, STYLE, middle(filled), 'fillColorHex')?.value)
      .toBe('#00ff00');
  });
});

describe('🔴 μέγεθος, απαλοιφή, και «τι υπάρχει να επαναφερθεί»', () => {
  it('το `A↑` ανεβάζει ΜΟΝΟ τα μαρκαρισμένα γράμματα', () => {
    const next = stepTableFormatTextHeight(model({}), STYLE, middle(), 1);
    const runs = cellOf(next)?.runs;
    expect(runs).toHaveLength(1);
    expect(runs?.[0]).toMatchObject({ start: 2, end: 4 });
    expect(runs?.[0].style.textHeightMm).toBeGreaterThan(STYLE.rowClasses.data.textHeightMm);
  });

  it('🔴 η αφετηρία είναι το ΚΟΙΝΟ άκρο των γραμμάτων, όχι του κελιού', () => {
    const mixedHeights = model({
      runs: [{ start: 2, end: 3, style: { textHeightMm: 50 } }],
    });
    expect(tableFormatNumericRange(mixedHeights, STYLE, middle(mixedHeights), 'textHeightMm'))
      .toEqual({ min: STYLE.rowClasses.data.textHeightMm, max: 50 });
  });

  it('η απαλοιφή σβήνει ΜΟΝΟ τα δικά τους runs — το κελί μένει άθικτο', () => {
    const painted = model({
      styleOverride: { fillColorHex: '#ff0000' },
      runs: [{ start: 0, end: 6, style: { bold: true } }],
    });
    const cleared = clearTableFormatScope(painted, middle(painted));
    expect(readBack(cellOf(cleared)?.runs, TEXT.length)).toEqual(['Β', 'Β', '.', '.', 'Β', 'Β']);
    expect(cellOf(cleared)?.styleOverride).toEqual({ fillColorHex: '#ff0000' });
  });

  it('🔴 «υπάρχει τι να επαναφερθεί;» ρωτά ΤΑ ΓΡΑΜΜΑΤΑ, όχι το κελί', () => {
    const elsewhere = model({ runs: [{ start: 5, end: 6, style: { bold: true } }] });
    expect(canResetTableFormatScope(elsewhere, middle(elsewhere))).toBe(false);

    const here = model({ runs: [{ start: 3, end: 5, style: { bold: true } }] });
    expect(canResetTableFormatScope(here, middle(here))).toBe(true);
  });
});
