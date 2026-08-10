/**
 * 🔴 ADR-753 Φ4 — **ΤΟ ΠΡΟΧΕΙΡΟ ΠΡΩΤΑ**, και γιατί χωρίς αυτό το κουμπί «Β» δεν κάνει τίποτα.
 *
 * Το σενάριο που ζητά αυτή η ομάδα είναι το πιο συνηθισμένο που υπάρχει: **γράφω σε άδειο κελί,
 * μαρκάρω δύο γράμματα, πατάω Β**. Χωρίς τον συγχρονισμό, το μοντέλο βλέπει `value: ''`, οι
 * δείκτες κόβονται στο μηδέν και **δεν γράφεται κανένα run** — σιωπηλά, χωρίς σφάλμα πουθενά.
 *
 * @see ui/table-cell-editor/table-text-draft-sync.ts
 */

import { tableModelWithPendingDraft } from '../table-text-draft-sync';
import { getPersistedCellText } from '../../../bim/table/table-cell-content';
import type { PersistedTableModel, TableCell } from '../../../types/table';

const AT = { rowId: 'r1', colId: 'c0' };

function model(cell?: TableCell): PersistedTableModel {
  return {
    columns: [{ id: 'c0', sizing: { kind: 'hug' }, valueType: 'text', align: 'left' }],
    rows: [{ id: 'r1', rowClass: 'data' }],
    cells: cell === undefined ? [] : [['r1', 'c0', cell]],
    merges: [],
  };
}

const textOf = (m: PersistedTableModel): string => getPersistedCellText(m, 'r1', 'c0');

describe('🔴 το πρόχειρο φτάνει στο μοντέλο ΠΡΙΝ γραφτούν οι δείκτες', () => {
  it('🔴 άδειο κελί + πληκτρολογημένο κείμενο ⇒ το κείμενο μπαίνει', () => {
    const next = tableModelWithPendingDraft(model(), {
      cell: AT, draft: 'ΝΕΣΤΩΡ', binding: undefined,
    });
    expect(textOf(next)).toBe('ΝΕΣΤΩΡ');
  });

  it('🔴 ΙΔΙΟ κείμενο ⇒ ΤΟ ΙΔΙΟ μοντέλο by-reference — κανένα βήμα undo για το τίποτα', () => {
    const before = model({ kind: 'text', value: 'ΝΕΣΤΩΡ' });
    expect(tableModelWithPendingDraft(before, {
      cell: AT, draft: 'ΝΕΣΤΩΡ', binding: undefined,
    })).toBe(before);
  });

  it('🔴 τα υπάρχοντα runs ΑΚΟΛΟΥΘΟΥΝ το κείμενο — δεν μένουν ακίνητα', () => {
    // `ΝΕΣΤΩΡ` με έντονα τα δύο πρώτα· ένα `Χ` μπροστά τα σπρώχνει κατά ένα. Runs που έμεναν
    // ακίνητα θα έβαφαν σιωπηλά **άλλα** γράμματα — και μόνο μετά την επόμενη αλλαγή.
    const before = model({
      kind: 'text',
      value: 'ΝΕΣΤΩΡ',
      runs: [{ start: 0, end: 2, style: { bold: true } }],
    });
    const next = tableModelWithPendingDraft(before, {
      cell: AT, draft: 'ΧΝΕΣΤΩΡ', binding: undefined,
    });
    expect(next.cells[0][2].runs).toEqual([{ start: 1, end: 3, style: { bold: true } }]);
  });

  it('🔴 πρόχειρο που είναι ΤΥΠΟΣ περνά από τον ΕΝΑ δρόμο — γίνεται κελί τύπου', () => {
    const next = tableModelWithPendingDraft(model(), {
      cell: AT, draft: '=1+1', binding: undefined,
    });
    expect(next.cells[0][2].kind).toBe('formula');
  });
});

describe('🔴 ο φρουρός: κελί που ΔΕΝ γράφεται στο μοντέλο μένει άθικτο', () => {
  it('δεμένο κελί ⇒ καμία εγγραφή, το ίδιο μοντέλο', () => {
    // Ο ίδιος φρουρός με το `buildTableCellEditCommand`: η τιμή ανήκει στην **οντότητα-πηγή**,
    // και ένα αντίγραφό της στον πίνακα θα έσπαγε το «ΕΝΑΣ ιδιοκτήτης» του ADR-769.
    const before = model({ kind: 'text', value: '12.50', bound: { field: 'area' } } as TableCell);
    const next = tableModelWithPendingDraft(before, {
      cell: AT,
      draft: '99',
      binding: {
        sourceRef: { kind: 'topo-survey', id: 'srv-1' },
        revision: 1,
      } as never,
    });
    expect(next).toBe(before);
  });
});
