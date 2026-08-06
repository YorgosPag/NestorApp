/**
 * ADR-739 — **ο ΕΝΑΣ δρόμος** από «τι διάλεξε ο χρήστης» σε «πού γράφεται».
 *
 * Το ερώτημα αυτής της ομάδας δεν είναι αν δουλεύει ο κάθε γραφέας — αυτό το απαντούν τα δικά
 * τους tests. Είναι δύο άλλα:
 *  1. **η πρόθεση της επιλογής διαλέγει τον στόχο** (Excel: γράμμα στήλης ⇒ στήλη· μαρκάρισμα
 *     κελιών ⇒ κελιά), και η διαφορά είναι **ορατή στο μοντέλο**·
 *  2. **τα δύο σκέλη συμφωνούν** όπου η ερώτηση είναι όντως η ίδια — αλλιώς η κορδέλα και το
 *     mini toolbar θα έδειχναν άλλα πράγματα για την ίδια επιλογή, και κανένα test του ενός
 *     σκέλους δεν θα το έβλεπε.
 *
 * @see bim/table/table-format-scope.ts
 */

import {
  canResetTableFormatScope,
  clearTableFormatScope,
  resolveTableFormatState,
  setTableFormatField,
  stepTableFormatTextHeight,
  tableFormatNumericRange,
  tableFormatScopeBounds,
  tableFormatScopeOf,
  type TableFormatScope,
} from '../table-format-scope';
import { hierarchicalTableStyle } from './hierarchical-table-style-fixture';
import type { TableSelectionSpan } from '../table-cell-range';
import type { PersistedTableModel } from '../../../types/table';

const HIERARCHICAL = hierarchicalTableStyle();

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

const AT_R1C0 = { rowId: 'r1', colId: 'c0' };

const span = (
  kind: TableSelectionSpan['kind'],
  from: { rowId: string; colId: string },
  to: { rowId: string; colId: string },
): TableSelectionSpan => ({ from, to, kind });

describe('tableFormatScopeOf — η πρόθεση διαλέγει τον στόχο', () => {
  it('χωρίς μαρκάρισμα ⇒ ΚΕΛΙΑ, μόνο το ενεργό', () => {
    expect(tableFormatScopeOf(model(), AT_R1C0, null)).toEqual({
      kind: 'range',
      bounds: { firstRow: 1, lastRow: 1, firstCol: 0, lastCol: 0 },
    });
  });

  it('είδος `range` ⇒ ΚΕΛΙΑ', () => {
    const scope = tableFormatScopeOf(
      model(), AT_R1C0, span('range', AT_R1C0, { rowId: 'r2', colId: 'c1' }),
    );
    expect(scope).toEqual({
      kind: 'range',
      bounds: { firstRow: 1, lastRow: 2, firstCol: 0, lastCol: 1 },
    });
  });

  it('🔴 είδος `column` ⇒ ΑΞΟΝΑΣ, με τις ταυτότητες των στηλών', () => {
    const scope = tableFormatScopeOf(
      model(), AT_R1C0, span('column', { rowId: 'r0', colId: 'c0' }, { rowId: 'r2', colId: 'c0' }),
    );
    expect(scope).toEqual({ kind: 'axis', axis: 'column', ids: ['c0'] });
  });

  it('🔴 είδος `row` ⇒ ΑΞΟΝΑΣ, με τις ταυτότητες των γραμμών', () => {
    const scope = tableFormatScopeOf(
      model(), AT_R1C0, span('row', { rowId: 'r1', colId: 'c0' }, { rowId: 'r2', colId: 'c1' }),
    );
    expect(scope).toEqual({ kind: 'axis', axis: 'row', ids: ['r1', 'r2'] });
  });

  it('μπαγιάτικη επιλογή ⇒ `null` — ο καλών σβήνει, δεν μαντεύει', () => {
    expect(tableFormatScopeOf(model(), { rowId: 'χ', colId: 'ψ' }, null)).toBeNull();
    expect(tableFormatScopeOf(
      model(), AT_R1C0, span('range', AT_R1C0, { rowId: 'ΔΕΝ', colId: 'ΥΠΑΡΧΕΙ' }),
    )).toBeNull();
  });
});

describe('🔴 η διαφορά ΕΙΝΑΙ ορατή στο μοντέλο — δεν είναι λεπτομέρεια υλοποίησης', () => {
  const COLUMN = span('column', { rowId: 'r0', colId: 'c0' }, { rowId: 'r2', colId: 'c0' });
  const RANGE = span('range', { rowId: 'r0', colId: 'c0' }, { rowId: 'r2', colId: 'c0' });

  it('στήλη ⇒ γράφεται Η ΣΤΗΛΗ (νέα γραμμή θα κληρονομήσει)', () => {
    const scope = tableFormatScopeOf(model(), AT_R1C0, COLUMN) as TableFormatScope;
    const next = setTableFormatField(model(), scope, 'bold', true);
    expect(next.columns[0].styleOverride).toEqual({ bold: true });
    expect(next.cells).toHaveLength(0);
  });

  it('περιοχή ⇒ γράφονται ΤΑ ΚΕΛΙΑ (νέα γραμμή γεννιέται άβαφη)', () => {
    const scope = tableFormatScopeOf(model(), AT_R1C0, RANGE) as TableFormatScope;
    const next = setTableFormatField(model(), scope, 'bold', true);
    expect(next.columns[0].styleOverride).toBeUndefined();
    expect(next.cells).toHaveLength(3);
  });
});

describe('τα δύο σκέλη συμφωνούν όπου η ερώτηση είναι η ίδια', () => {
  const COLUMN = span('column', { rowId: 'r0', colId: 'c0' }, { rowId: 'r2', colId: 'c0' });
  const RANGE = span('range', { rowId: 'r0', colId: 'c0' }, { rowId: 'r2', colId: 'c0' });

  /** Και τα δύο καλύπτουν **ακριβώς** τα ίδια τρία κελιά της στήλης `c0`. */
  const scopeOf = (s: TableSelectionSpan): TableFormatScope =>
    tableFormatScopeOf(model(), AT_R1C0, s) as TableFormatScope;

  it('«τι βλέπω» είναι η ίδια απάντηση στα ίδια κελιά — μεικτό και στα δύο', () => {
    const asAxis = resolveTableFormatState(model(), HIERARCHICAL, scopeOf(COLUMN), 'bold');
    const asRange = resolveTableFormatState(model(), HIERARCHICAL, scopeOf(RANGE), 'bold');
    expect(asAxis?.value).toBe(asRange?.value);
    expect(asAxis?.mixed).toBe(asRange?.mixed);
    expect(asAxis?.mixed).toBe(true); // κεφαλίδα έντονη + δεδομένα όχι
  });

  it('τα άκρα του μεγέθους είναι τα ίδια στα ίδια κελιά', () => {
    expect(tableFormatNumericRange(model(), HIERARCHICAL, scopeOf(COLUMN), 'textHeightMm'))
      .toEqual(tableFormatNumericRange(model(), HIERARCHICAL, scopeOf(RANGE), 'textHeightMm'));
  });

  it('«υπάρχει τι να σβηστεί;» — όχι σε καθαρό πίνακα, ναι μετά από εγγραφή, και στα δύο', () => {
    for (const selection of [COLUMN, RANGE]) {
      const scope = scopeOf(selection);
      expect(canResetTableFormatScope(model(), scope)).toBe(false);
      const written = setTableFormatField(model(), scope, 'italic', true);
      expect(canResetTableFormatScope(written, scope)).toBe(true);
    }
  });
});

describe('εγγύηση by-reference και στα δύο σκέλη', () => {
  it('άξονας: ίδια τιμή ⇒ το ΙΔΙΟ μοντέλο, κανένα βήμα undo', () => {
    const scope: TableFormatScope = { kind: 'axis', axis: 'column', ids: ['c0', 'c1'] };
    const bold = setTableFormatField(model(), scope, 'bold', true);
    expect(setTableFormatField(bold, scope, 'bold', true)).toBe(bold);
  });

  it('περιοχή: ίδια τιμή ⇒ το ΙΔΙΟ μοντέλο', () => {
    const scope: TableFormatScope = {
      kind: 'range',
      bounds: { firstRow: 1, lastRow: 2, firstCol: 0, lastCol: 1 },
    };
    const bold = setTableFormatField(model(), scope, 'bold', true);
    expect(setTableFormatField(bold, scope, 'bold', true)).toBe(bold);
  });
});

describe('clearTableFormatScope — δύο σκέλη, σκόπιμα διαφορετικά', () => {
  it('άξονας: σβήνει τη δική του παράκαμψη', () => {
    const scope: TableFormatScope = { kind: 'axis', axis: 'column', ids: ['c0'] };
    const bold = setTableFormatField(model(), scope, 'bold', true);
    expect(clearTableFormatScope(bold, scope).columns[0].styleOverride).toBeUndefined();
  });

  it('🔴 περιοχή: σβήνει τα κελιά και ΑΦΗΝΕΙ τη στήλη — το κελί μπορεί να μείνει έντονο', () => {
    const axis: TableFormatScope = { kind: 'axis', axis: 'column', ids: ['c0'] };
    const range: TableFormatScope = {
      kind: 'range',
      bounds: { firstRow: 1, lastRow: 1, firstCol: 0, lastCol: 0 },
    };
    const boldColumn = setTableFormatField(model(), axis, 'bold', true);
    const alsoCell = setTableFormatField(boldColumn, range, 'italic', true);

    const cleared = clearTableFormatScope(alsoCell, range);
    expect(cleared.columns[0].styleOverride).toEqual({ bold: true });
    // Και η ειλικρινής ένδειξη: το βλέπεις έντονο, αλλά ΔΕΝ το ζήτησες εσύ.
    const state = resolveTableFormatState(cleared, HIERARCHICAL, range, 'bold');
    expect(state).toEqual({ value: true, mixed: false, overridden: false });
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// ADR-739 §52 Φ1β/Φ1γ — οι δύο εξαγωγές που γεννήθηκαν όταν ο στόχος απέκτησε **τρίτη**
// επιφάνεια (κορδέλα): το ορθογώνιο και το βήμα μεγέθους.
// ──────────────────────────────────────────────────────────────────────────────

describe('tableFormatScopeBounds — ο στόχος ως ΟΡΘΟΓΩΝΙΟ (περιγράμματα / συγχώνευση)', () => {
  it('περιοχή: τα ίδια τα όρια, χωρίς δεύτερο υπολογισμό', () => {
    const bounds = { firstRow: 1, lastRow: 2, firstCol: 0, lastCol: 1 };
    expect(tableFormatScopeBounds(model(), { kind: 'range', bounds })).toBe(bounds);
  });

  it('🔴 άξονας: ΟΛΟΚΛΗΡΗ η στήλη — ο ΕΝΑΣ ορισμός του §27.16 Ε2, όχι αριθμητική', () => {
    // Ο πειρασμός ήταν `{ firstRow: 0, lastRow: rows.length - 1 }`. Το test δεν θα τον έπιανε
    // σε αυτό το μοντέλο — αλλά θα τον έπιανε την ημέρα που οι κρυμμένες γραμμές αλλάξουν τον
    // ορισμό σε ΕΝΑ σημείο, και ο τέταρτος ορισμός μείνει πίσω.
    expect(tableFormatScopeBounds(model(), { kind: 'axis', axis: 'column', ids: ['c0'] }))
      .toEqual({ firstRow: 0, lastRow: 2, firstCol: 0, lastCol: 0 });
  });

  it('άξονας με ΠΟΛΛΕΣ ταυτότητες: το ορθογώνιο τις καλύπτει όλες (§27.17)', () => {
    expect(tableFormatScopeBounds(model(), { kind: 'axis', axis: 'column', ids: ['c0', 'c1'] }))
      .toEqual({ firstRow: 0, lastRow: 2, firstCol: 0, lastCol: 1 });
  });

  it('γραμμή: ολόκληρη η γραμμή, όλες οι στήλες', () => {
    expect(tableFormatScopeBounds(model(), { kind: 'axis', axis: 'row', ids: ['r1'] }))
      .toEqual({ firstRow: 1, lastRow: 1, firstCol: 0, lastCol: 1 });
  });

  it('μπαγιάτικη ταυτότητα (undo έσβησε τη στήλη) ⇒ `null`, ποτέ μαντεψιά', () => {
    expect(tableFormatScopeBounds(model(), { kind: 'axis', axis: 'column', ids: ['ghost'] }))
      .toBeNull();
  });

  it('κενός στόχος ⇒ `null`', () => {
    expect(tableFormatScopeBounds(model(), { kind: 'axis', axis: 'column', ids: [] })).toBeNull();
  });
});

describe('stepTableFormatTextHeight — δύο σκέλη, σκόπιμα ΔΙΑΦΟΡΕΤΙΚΟ εύρος', () => {
  /** Το επιλυμένο ύψος ενός κελιού, όπως το βλέπει ο ζωγράφος. */
  const heightAt = (m: PersistedTableModel, rowId: string, colId: string): number | undefined =>
    resolveTableFormatState(
      m, HIERARCHICAL, { kind: 'range', bounds: boundsOf(m, rowId, colId) }, 'textHeightMm',
    )?.value;

  function boundsOf(m: PersistedTableModel, rowId: string, colId: string) {
    const row = m.rows.findIndex((r) => r.id === rowId);
    const col = m.columns.findIndex((c) => c.id === colId);
    return { firstRow: row, lastRow: row, firstCol: col, lastCol: col };
  }

  it('🔴 άξονας: ΚΑΘΕ άξονας ξεκινά από ΤΟ ΔΙΚΟ ΤΟΥ μέγεθος (Excel parity)', () => {
    // Δύο στήλες με διαφορετικό ρητό ύψος. Ένα «μεγάλωσε» πρέπει να ανεβάσει **και τις δύο**
    // ένα σκαλί, διατηρώντας τη διαφορά — όχι να τις ισοπεδώσει στην ίδια τιμή.
    let m = setTableFormatField(model(), { kind: 'axis', axis: 'column', ids: ['c0'] }, 'textHeightMm', 2.5);
    m = setTableFormatField(m, { kind: 'axis', axis: 'column', ids: ['c1'] }, 'textHeightMm', 5);

    const stepped = stepTableFormatTextHeight(
      m, HIERARCHICAL, { kind: 'axis', axis: 'column', ids: ['c0', 'c1'] }, 1,
    );

    expect(stepped.columns[0].styleOverride?.textHeightMm).toBe(2.8);
    expect(stepped.columns[1].styleOverride?.textHeightMm).toBe(6);
  });

  it('περιοχή: **μία** τιμή για όλα τα κελιά — δεν υπάρχει ανά-κελί σκαλί να διατηρηθεί', () => {
    const scope: TableFormatScope = {
      kind: 'range',
      bounds: { firstRow: 1, lastRow: 2, firstCol: 0, lastCol: 0 },
    };
    const stepped = stepTableFormatTextHeight(model(), HIERARCHICAL, scope, 1);
    expect(heightAt(stepped, 'r1', 'c0')).toBe(heightAt(stepped, 'r2', 'c0'));
  });

  it('«μεγάλωσε» σε μεικτή περιοχή ξεκινά από το ΜΕΓΙΣΤΟ — κανένα κελί δεν μικραίνει', () => {
    // Η κεφαλίδα (r0) είναι ψηλότερη από τα δεδομένα (r1). Ένα βήμα προς τα πάνω δεν
    // επιτρέπεται να κατεβάσει την κεφαλίδα στο ύψος των δεδομένων.
    const scope: TableFormatScope = {
      kind: 'range',
      bounds: { firstRow: 0, lastRow: 1, firstCol: 0, lastCol: 0 },
    };
    const before = tableFormatNumericRange(model(), HIERARCHICAL, scope, 'textHeightMm');
    const stepped = stepTableFormatTextHeight(model(), HIERARCHICAL, scope, 1);
    const after = tableFormatNumericRange(stepped, HIERARCHICAL, scope, 'textHeightMm');
    expect(before).not.toBeNull();
    expect(after?.min).toBeGreaterThanOrEqual(before?.max ?? 0);
  });

  it('🔴 στο άκρο της σκάλας με ΟΜΟΙΟΜΟΡΦΗ σειρά ⇒ ΤΟ ΙΔΙΟ μοντέλο (κανένα βήμα undo)', () => {
    const scope: TableFormatScope = {
      kind: 'range',
      bounds: { firstRow: 1, lastRow: 1, firstCol: 0, lastCol: 0 },
    };
    // 10mm είναι το τελευταίο σκαλί του `TABLE_TEXT_HEIGHT_SCALE_MM`.
    const top = setTableFormatField(model(), scope, 'textHeightMm', 10);
    expect(stepTableFormatTextHeight(top, HIERARCHICAL, scope, 1)).toBe(top);
  });
});
