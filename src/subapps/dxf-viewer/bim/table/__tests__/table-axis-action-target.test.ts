/**
 * ADR-739 §27.17 — **ποιους άξονες αφορά το δεξί κλικ**.
 *
 * Το ελάττωμα που καρφώνεται εδώ είναι ορατό με στιγμιότυπο (Giorgio, 2026-08-04): τρεις
 * στήλες φωτισμένες, «Διαγραφή στήλης», **μία** έσβηνε. Άρα τα tests δεν ρωτούν «τι κάνει η
 * συνάρτηση» αλλά **«ποια είναι η πρόθεση του χρήστη»** — και τα τέσσερα σχήματα του κανόνα
 * (μέσα / έξω / καμία / άλλος άξονας) είναι ακριβώς όσα δεν προκύπτουν από τον κώδικα.
 */

import { resolveTableAxisActionTarget } from '../table-axis-action-target';
import { resolveTableModel } from '../table-model-helpers';
import type { PersistedTableModel } from '../../../types/table';
import type { TableSelectionSpan } from '../table-cell-range';

function persisted(): PersistedTableModel {
  return {
    columns: ['c0', 'c1', 'c2', 'c3', 'c4'].map((id) => ({
      id,
      sizing: { kind: 'fixed', widthMm: 40 } as const,
      valueType: 'text' as const,
      align: 'left' as const,
    })),
    rows: [
      { id: 'r0', rowClass: 'title' },
      { id: 'r1', rowClass: 'header' },
      { id: 'r2', rowClass: 'data' },
      { id: 'r3', rowClass: 'data' },
    ],
    cells: [],
    // Ο τίτλος πλήρους πλάτους: το κούμπωμα σε συγχωνεύσεις ΔΕΝ επιτρέπεται να τρέξει σε
    // επιλογή άξονα (§27.15) — αν έτρεχε, κάθε επιλογή στήλης θα γινόταν όλος ο πίνακας.
    merges: [{ anchorRowId: 'r0', anchorColId: 'c0', rowSpan: 1, colSpan: 5 }],
  };
}

const model = () => resolveTableModel(persisted());

const columnSelection = (from: string, to: string): TableSelectionSpan => ({
  from: { rowId: 'r0', colId: from },
  to: { rowId: 'r3', colId: to },
  kind: 'column',
});

describe('resolveTableAxisActionTarget — ο κανόνας Α22 στον άξονα', () => {
  it('🔴 κλικ ΜΕΣΑ σε επιλογή στηλών ⇒ ΟΛΕΣ οι επιλεγμένες (το ελάττωμα της 04/08)', () => {
    const target = resolveTableAxisActionTarget(
      model(),
      { axis: 'column', colId: 'c2' },
      columnSelection('c1', 'c3'),
    );
    expect(target).toEqual({
      axis: 'column',
      ids: ['c1', 'c2', 'c3'],
      firstIndex: 1,
      lastIndex: 3,
      count: 3,
    });
  });

  it('κλικ ΕΞΩ από την επιλογή ⇒ μόνο η στήλη που πατήθηκε (ποτέ μακριά από τον δείκτη)', () => {
    const target = resolveTableAxisActionTarget(
      model(),
      { axis: 'column', colId: 'c4' },
      columnSelection('c1', 'c3'),
    );
    expect(target).toMatchObject({ ids: ['c4'], firstIndex: 4, lastIndex: 4, count: 1 });
  });

  it('καμία επιλογή ⇒ μόνο η στήλη που πατήθηκε', () => {
    const target = resolveTableAxisActionTarget(model(), { axis: 'column', colId: 'c1' }, null);
    expect(target).toMatchObject({ ids: ['c1'], count: 1 });
  });

  it('🔴 επιλογή ΠΕΡΙΟΧΗΣ που τυχαίνει να πιάνει όλες τις γραμμές ΔΕΝ είναι επιλογή στηλών', () => {
    const range: TableSelectionSpan = {
      from: { rowId: 'r0', colId: 'c1' },
      to: { rowId: 'r3', colId: 'c3' },
      kind: 'range',
    };
    const target = resolveTableAxisActionTarget(model(), { axis: 'column', colId: 'c2' }, range);
    expect(target).toMatchObject({ ids: ['c2'], count: 1 });
  });

  it('επιλογή ΓΡΑΜΜΩΝ + δεξί κλικ σε ΣΤΗΛΗ ⇒ δεν αφορά· μόνο η στήλη', () => {
    const rows: TableSelectionSpan = {
      from: { rowId: 'r1', colId: 'c0' },
      to: { rowId: 'r3', colId: 'c4' },
      kind: 'row',
    };
    const target = resolveTableAxisActionTarget(model(), { axis: 'column', colId: 'c2' }, rows);
    expect(target).toMatchObject({ ids: ['c2'], count: 1 });
  });

  it('η επιλογή γράφεται σε αυθαίρετη σειρά — σύρση από δεξιά προς αριστερά δίνει το ίδιο', () => {
    const target = resolveTableAxisActionTarget(
      model(),
      { axis: 'column', colId: 'c2' },
      columnSelection('c3', 'c1'),
    );
    expect(target).toMatchObject({ ids: ['c1', 'c2', 'c3'], firstIndex: 1, lastIndex: 3 });
  });

  it('🔴 επιλογή ΓΡΑΜΜΩΝ + κλικ μέσα της ⇒ όλες οι γραμμές (ο ίδιος κανόνας, άλλος άξονας)', () => {
    const rows: TableSelectionSpan = {
      from: { rowId: 'r1', colId: 'c0' },
      to: { rowId: 'r3', colId: 'c4' },
      kind: 'row',
    };
    const target = resolveTableAxisActionTarget(model(), { axis: 'row', rowId: 'r2' }, rows);
    expect(target).toEqual({
      axis: 'row',
      ids: ['r1', 'r2', 'r3'],
      firstIndex: 1,
      lastIndex: 3,
      count: 3,
    });
  });

  it('μπαγιάτικη ταυτότητα (undo ενόσω το μενού ήταν ανοιχτό) ⇒ `null`, ποτέ μαντεψιά', () => {
    expect(resolveTableAxisActionTarget(model(), { axis: 'column', colId: 'c9' }, null)).toBeNull();
  });

  it('μπαγιάτικη ΕΠΙΛΟΓΗ ⇒ πέφτει στη στήλη που πατήθηκε αντί να παραιτηθεί', () => {
    const stale = columnSelection('c1', 'c9');
    const target = resolveTableAxisActionTarget(model(), { axis: 'column', colId: 'c2' }, stale);
    expect(target).toMatchObject({ ids: ['c2'], count: 1 });
  });
});
