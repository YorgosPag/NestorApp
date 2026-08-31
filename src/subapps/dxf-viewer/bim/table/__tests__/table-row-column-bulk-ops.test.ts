/**
 * ADR-739 §27.17 — **η ίδια πράξη σε πολλούς άξονες**: όλα ή τίποτα, ένα βήμα undo.
 *
 * Δύο πράγματα καρφώνονται εδώ και κανένα δεν προκύπτει από τον κώδικα:
 *  1. Η αναδίπλωση πάνω στη μία υλοποίηση **διατηρεί** τις τέσσερις εγγυήσεις της (κελιά,
 *     εύρη, ακμές, ταυτότητα by-reference) — αλλιώς θα ήταν δεύτερη υλοποίηση με άλλο όνομα.
 *  2. Το φράγμα απαντιέται **μία φορά για όλο το πλήθος**: η μερική διαγραφή είναι το σφάλμα
 *     που ένας απλοϊκός βρόχος θα έκανε σιωπηλά.
 */

import {
  deleteTableColumns,
  deleteTableRows,
  insertTableColumns,
  insertTableRows,
} from '../table-row-column-bulk-ops';
import { MAX_TABLE_GRID_CELLS } from '../table-capacity';
import { getPersistedCellText } from '../table-model-helpers';
import type { PersistedTableModel, TableCellEntry } from '../../../types/table';

/** Ο πίνακας της οθόνης: τίτλος πλήρους πλάτους + κεφαλίδα + 3 γραμμές δεδομένων. */
function model(): PersistedTableModel {
  return {
    columns: ['c0', 'c1', 'c2', 'c3'].map((id) => ({
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
      { id: 'r4', rowClass: 'data' },
    ],
    cells: [
      ['r0', 'c0', { kind: 'text', value: 'ΠΙΝΑΚΑΣ' }],
      ['r1', 'c1', { kind: 'text', value: 'Περιγραφή' }],
      ['r1', 'c2', { kind: 'text', value: 'Ποσότητα' }],
      ['r3', 'c1', { kind: 'text', value: 'ΖΦ' }],
    ],
    merges: [{ anchorRowId: 'r0', anchorColId: 'c0', rowSpan: 1, colSpan: 4 }],
  };
}

const ids = (entries: readonly { readonly id: string }[]): string[] => entries.map((e) => e.id);

describe('deleteTableColumns', () => {
  it('🔴 σβήνει ΟΛΕΣ τις επιλεγμένες — το ελάττωμα που ζήτησε ο ιδιοκτήτης (04/08)', () => {
    const next = deleteTableColumns(model(), ['c1', 'c2']);
    expect(ids(next.columns)).toEqual(['c0', 'c3']);
    expect(next.cells.some(([, c]: TableCellEntry) => c === 'c1' || c === 'c2')).toBe(false);
  });

  it('οι εγγυήσεις της μίας υλοποίησης επιβιώνουν: ο τίτλος μικραίνει ΟΣΟ πρέπει', () => {
    expect(deleteTableColumns(model(), ['c1', 'c2']).merges[0].colSpan).toBe(2);
  });

  it('🔴 διαγραφή που περιλαμβάνει την ΑΓΚΥΡΑ κουβαλά το περιεχόμενο στην πρώτη επιζώσα', () => {
    const next = deleteTableColumns(model(), ['c0', 'c1']);
    expect(ids(next.columns)).toEqual(['c2', 'c3']);
    expect(next.merges[0].anchorColId).toBe('c2');
    expect(getPersistedCellText(next, 'r0', 'c2')).toBe('ΠΙΝΑΚΑΣ');
  });

  it('🔴 ΟΛΑ Ή ΤΙΠΟΤΑ: 4 από 4 στήλες ⇒ ΚΑΜΙΑ διαγραφή, ίδιο μοντέλο by-reference', () => {
    const before = model();
    expect(deleteTableColumns(before, ['c0', 'c1', 'c2', 'c3'])).toBe(before);
  });

  it('3 από 4 επιτρέπονται — ο πίνακας μένει με μία στήλη', () => {
    expect(ids(deleteTableColumns(model(), ['c0', 'c1', 'c2']).columns)).toEqual(['c3']);
  });

  it('κενή λίστα ⇒ το ίδιο μοντέλο by-reference (κανένα βήμα undo για το τίποτα)', () => {
    const before = model();
    expect(deleteTableColumns(before, [])).toBe(before);
  });

  it('η σειρά των ταυτοτήτων δεν αλλάζει το αποτέλεσμα — id, όχι index', () => {
    expect(ids(deleteTableColumns(model(), ['c2', 'c0']).columns))
      .toEqual(ids(deleteTableColumns(model(), ['c0', 'c2']).columns));
  });
});

describe('deleteTableRows', () => {
  it('σβήνει όλες τις γραμμές και τα κελιά τους', () => {
    const next = deleteTableRows(model(), ['r1', 'r3']);
    expect(ids(next.rows)).toEqual(['r0', 'r2', 'r4']);
    expect(next.cells.some(([r]: TableCellEntry) => r === 'r1' || r === 'r3')).toBe(false);
  });

  it('🔴 ΟΛΑ Ή ΤΙΠΟΤΑ: 5 από 5 γραμμές ⇒ καμία (πίνακας χωρίς ύψος = αόρατη οντότητα)', () => {
    const before = model();
    expect(deleteTableRows(before, ['r0', 'r1', 'r2', 'r3', 'r4'])).toBe(before);
  });
});

describe('insertTableColumns / insertTableRows', () => {
  it('🔴 με 3 μαρκαρισμένες βάζει 3 — ο κανόνας του Excel', () => {
    const next = insertTableColumns(model(), 1, 3);
    expect(next.columns).toHaveLength(7);
    // Οι τρεις νέες κάθονται **μαζί** στη θέση 1· ποια από αυτές πήρε ποιο `c#` είναι
    // αδιάφορο (είναι κενές και πανομοιότυπες), αλλά η **μοναδικότητα** δεν είναι.
    expect(ids(next.columns)).toEqual(['c0', 'c6', 'c5', 'c4', 'c1', 'c2', 'c3']);
    expect(new Set(ids(next.columns)).size).toBe(7);
  });

  it('οι νέες στήλες μπαίνουν ΟΛΕΣ στη ζητούμενη θέση, όχι διάσπαρτα', () => {
    const next = insertTableColumns(model(), 2, 2);
    expect(ids(next.columns)).toEqual(['c0', 'c1', 'c5', 'c4', 'c2', 'c3']);
  });

  it('ο τίτλος πλήρους πλάτους μεγαλώνει ΚΑΤΑ ΤΟ ΠΛΗΘΟΣ', () => {
    expect(insertTableColumns(model(), 4, 3).merges[0].colSpan).toBe(7);
  });

  it('🔴 ΟΛΑ Ή ΤΙΠΟΤΑ στο φράγμα: πλήθος που δεν χωρά ⇒ ΚΑΜΙΑ εισαγωγή', () => {
    // ADR-833 Φ5Β — το φράγμα είναι πλέον το **πυκνό γινόμενο**. Η ερώτηση που φυλάει αυτή η
    // άγκυρα μένει η ίδια και είναι η σημαντική: με τρεις στήλες μαρκαρισμένες, η πράξη
    // ρωτά «χωρούν **και οι τρεις**;» — μια εισαγωγή που σταματά στη μέση αφήνει βήμα undo
    // που δεν αναιρεί αυτό που ζήτησε ο χρήστης.
    const base = model();
    const columnCount = MAX_TABLE_GRID_CELLS / base.rows.length - 1;
    const nearFull: PersistedTableModel = {
      ...base,
      columns: Array.from({ length: columnCount }, (_, i) => ({ ...base.columns[0], id: `c${i}` })),
      merges: [],
    };
    expect(insertTableColumns(nearFull, 0, 3)).toBe(nearFull);
    expect(insertTableColumns(nearFull, 0, 1).columns).toHaveLength(columnCount + 1);
  });

  it('πλήθος 0 ή αρνητικό ⇒ το ίδιο μοντέλο by-reference', () => {
    const before = model();
    expect(insertTableColumns(before, 1, 0)).toBe(before);
    expect(insertTableRows(before, 1, -2)).toBe(before);
  });

  it('γραμμές: 2 μαρκαρισμένες ⇒ 2 νέες, όλες `data`', () => {
    const next = insertTableRows(model(), 2, 2);
    expect(next.rows).toHaveLength(7);
    expect(next.rows.slice(2, 4).every((row) => row.rowClass === 'data')).toBe(true);
    expect(next.rows.filter((row) => row.rowClass === 'title')).toHaveLength(1);
  });
});
