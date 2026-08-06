/**
 * ADR-739 — ο **κοινός σαρωτής** επιλυμένων στυλ κελιού.
 *
 * Τέσσερα πράγματα αποδεικνύονται εδώ, και κανένα δεν φαίνεται διαβάζοντας τον κώδικα:
 *  1. η απάντηση βγαίνει από την **πραγματική επίλυση** κάθε κελιού, όχι από τις παρακάμψεις —
 *     γι' αυτό ένα σύνολο που πατά σε κεφαλίδα **και** δεδομένα είναι μεικτό·
 *  2. μπαγιάτικες ταυτότητες **προσπερνιούνται**, δεν μηδενίζουν την απάντηση·
 *  3. ο σαρωτής **δεν** απαντά `overridden` — είναι η μόνη ερώτηση που εξαρτάται από τον στόχο·
 *  4. τα `overrides`/`column` ταξιδεύουν μαζί με κάθε κελί, ώστε η μορφή αριθμού (ADR-760) να
 *     μη χρειαστεί ποτέ **δεύτερο** βρόχο πάνω στα ίδια κελιά.
 *
 * @see bim/table/table-cell-style-scan.ts
 */

import {
  forEachResolvedCellStyle,
  nextBooleanFormat,
  resolveCellsFormat,
  resolveCellsNumericRange,
  type TableResolvedCell,
} from '../table-cell-style-scan';
import { hierarchicalTableStyle } from './hierarchical-table-style-fixture';
import type { TableCellRef } from '../table-cell-range';
import type { PersistedTableModel } from '../../../types/table';

/**
 * Το ιστορικό στυλ με ιεραρχία γραμμών (τίτλος/κεφαλίδα έντονα, δεδομένα όχι). Με ουδέτερο
 * preset κάθε ερώτηση «μεικτό;» θα απαντούσε «όχι» χωρίς να ρωτήσει τίποτα.
 */
const HIERARCHICAL = hierarchicalTableStyle();

/** Κεφαλίδα (έντονη από το στυλ) + δύο γραμμές δεδομένων (όχι έντονες) × δύο στήλες. */
function model(): PersistedTableModel {
  return {
    columns: [
      { id: 'c0', sizing: { kind: 'hug' }, valueType: 'text', align: 'left' },
      { id: 'c1', sizing: { kind: 'hug' }, valueType: 'number', align: 'right' },
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

const ref = (rowId: string, colId: string): TableCellRef => ({ rowId, colId });

/** Τα δύο κελιά δεδομένων της πρώτης στήλης — ομοιογενές σύνολο. */
const DATA_C0 = [ref('r1', 'c0'), ref('r2', 'c0')];
/** Κεφαλίδα + δεδομένα — το σύνολο που **οφείλει** να βγει μεικτό στο `bold`. */
const MIXED_C0 = [ref('r0', 'c0'), ref('r1', 'c0')];

function collect(m: PersistedTableModel, refs: readonly TableCellRef[]): TableResolvedCell[] {
  const seen: TableResolvedCell[] = [];
  forEachResolvedCellStyle(m, HIERARCHICAL, refs, (cell) => seen.push(cell));
  return seen;
}

describe('forEachResolvedCellStyle — ποια κελιά επισκέπτεται', () => {
  it('επισκέπτεται κάθε υπαρκτό κελί, με τη σειρά που δόθηκε', () => {
    const seen = collect(model(), DATA_C0);
    expect(seen.map((c) => c.ref)).toEqual(DATA_C0);
  });

  it('προσπερνά μπαγιάτικες ταυτότητες αντί να μηδενίσει την απάντηση', () => {
    const seen = collect(model(), [ref('ΔΕΝ_ΥΠΑΡΧΕΙ', 'c0'), ref('r1', 'c0'), ref('r1', 'ΟΥΤΕ')]);
    expect(seen).toHaveLength(1);
    expect(seen[0].ref).toEqual(ref('r1', 'c0'));
  });

  it('`false` μόνο όταν ΚΑΝΕΝΑ κελί δεν επιβίωσε — αλλιώς `true`', () => {
    expect(forEachResolvedCellStyle(model(), HIERARCHICAL, [], () => {})).toBe(false);
    expect(
      forEachResolvedCellStyle(model(), HIERARCHICAL, [ref('χ', 'ψ')], () => {}),
    ).toBe(false);
    expect(forEachResolvedCellStyle(model(), HIERARCHICAL, DATA_C0, () => {})).toBe(true);
  });

  it('το στυλ είναι το ΕΠΙΛΥΜΕΝΟ: η κεφαλίδα βγαίνει έντονη χωρίς καμία παράκαμψη', () => {
    const seen = collect(model(), [ref('r0', 'c0'), ref('r1', 'c0')]);
    expect(seen[0].style.bold).toBe(true);
    expect(seen[1].style.bold).toBe(false);
  });

  it('η παράκαμψη του κελιού νικά τη γραμμή και τη στήλη', () => {
    const m = model();
    const withOverrides: PersistedTableModel = {
      ...m,
      columns: [{ ...m.columns[0], styleOverride: { bold: true } }, m.columns[1]],
      cells: [['r1', 'c0', { kind: 'text', value: '', styleOverride: { bold: false } }]],
    };
    const seen = collect(withOverrides, [ref('r1', 'c0'), ref('r2', 'c0')]);
    expect(seen[0].style.bold).toBe(false); // το κελί το είπε ρητά
    expect(seen[1].style.bold).toBe(true);  // κληρονομιά από τη στήλη
  });

  it('🔴 κουβαλά τις ΤΡΕΙΣ παρακάμψεις και τη στήλη — η Φ3 δεν θα χρειαστεί δεύτερο βρόχο', () => {
    const m = model();
    const withOverrides: PersistedTableModel = {
      ...m,
      columns: [m.columns[0], { ...m.columns[1], styleOverride: { italic: true } }],
      rows: [m.rows[0], { ...m.rows[1], styleOverride: { underline: true } }, m.rows[2]],
      cells: [['r1', 'c1', { kind: 'text', value: '', styleOverride: { bold: true } }]],
    };
    const [cell] = collect(withOverrides, [ref('r1', 'c1')]);
    expect(cell.overrides).toEqual({
      column: { italic: true },
      row: { underline: true },
      cell: { bold: true },
    });
    // `valueType` — η αλυσίδα κληρονομιάς της μορφής αριθμού τελειώνει εδώ, όχι στο στυλ.
    expect(cell.column.valueType).toBe('number');
  });
});

describe('resolveCellsFormat — συμφωνούν τα κελιά;', () => {
  it('ομοιογενές σύνολο ⇒ η κοινή τιμή, χωρίς μεικτό', () => {
    expect(resolveCellsFormat(model(), HIERARCHICAL, DATA_C0, 'bold'))
      .toEqual({ value: false, mixed: false });
  });

  it('🔴 κεφαλίδα + δεδομένα ⇒ ΜΕΙΚΤΟ, παρότι καμία παράκαμψη δεν υπάρχει', () => {
    expect(resolveCellsFormat(model(), HIERARCHICAL, MIXED_C0, 'bold'))
      .toEqual({ value: undefined, mixed: true });
  });

  it('κανένα υπαρκτό κελί ⇒ `null` (ο καλών το μεταφράζει, δεν μαντεύει)', () => {
    expect(resolveCellsFormat(model(), HIERARCHICAL, [ref('χ', 'ψ')], 'bold')).toBeNull();
  });

  it('🔴 ΔΕΝ απαντά `overridden` — είναι η ερώτηση που εξαρτάται από τον στόχο', () => {
    const state = resolveCellsFormat(model(), HIERARCHICAL, DATA_C0, 'bold');
    expect(state).not.toBeNull();
    expect(Object.keys(state as object).sort()).toEqual(['mixed', 'value']);
  });
});

describe('resolveCellsNumericRange — τα άκρα', () => {
  it('δίνει min/max από την πραγματική επίλυση, όχι από τις παρακάμψεις', () => {
    const range = resolveCellsNumericRange(model(), HIERARCHICAL, MIXED_C0, 'textHeightMm');
    expect(range).not.toBeNull();
    // Κεφαλίδα ψηλότερη από δεδομένα — δύο διαφορετικά ύψη, άρα πραγματικό εύρος.
    expect((range as { min: number; max: number }).min)
      .toBeLessThan((range as { min: number; max: number }).max);
  });

  it('ένα μόνο ύψος ⇒ min === max (εύρος, όχι σφάλμα)', () => {
    const range = resolveCellsNumericRange(model(), HIERARCHICAL, DATA_C0, 'textHeightMm');
    expect(range).not.toBeNull();
    expect((range as { min: number; max: number }).min)
      .toBe((range as { min: number; max: number }).max);
  });

  it('κανένα υπαρκτό κελί ⇒ `null`', () => {
    expect(resolveCellsNumericRange(model(), HIERARCHICAL, [], 'textHeightMm')).toBeNull();
  });
});

describe('nextBooleanFormat — μεικτό ⇒ όλα ναι', () => {
  it('όλα ναι ⇒ σβήνει', () => {
    expect(nextBooleanFormat({ value: true, mixed: false, overridden: true })).toBe(false);
  });

  it('όλα όχι ⇒ ανάβει', () => {
    expect(nextBooleanFormat({ value: false, mixed: false, overridden: false })).toBe(true);
  });

  it('🔴 μεικτό ⇒ ανάβει (μόνη επιλογή με ορατή αλλαγή σε ΚΑΘΕ διαφωνούν κελί)', () => {
    expect(nextBooleanFormat({ value: undefined, mixed: true, overridden: false })).toBe(true);
  });

  it('καμία κατάσταση ⇒ ανάβει', () => {
    expect(nextBooleanFormat(null)).toBe(true);
  });
});
