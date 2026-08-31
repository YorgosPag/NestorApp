/**
 * ADR-739 Φ.Δ βήμα 9 — **εισαγωγή/διαγραφή γραμμής & στήλης**, καθαρά.
 *
 * Οι τέσσερις αποφάσεις της κεφαλίδας του module είναι ακριβώς όσα δεν προκύπτουν από τον
 * κώδικα, άρα ακριβώς όσα πρέπει να καρφωθούν εδώ: μοναδικότητα ταυτότητας, ακεραιότητα
 * συγχωνεύσεων, μετακόμιση περιεχομένου άγκυρας, ταυτότητα by-reference στο no-op.
 */

import {
  canDeleteTableColumn,
  canDeleteTableRow,
  canInsertTableColumn,
  canInsertTableRow,
  deleteTableColumn,
  deleteTableRow,
  insertTableColumn,
  insertTableRow,
} from '../table-row-column-ops';
import { MAX_TABLE_GRID_CELLS } from '../table-capacity';
import { getPersistedCellText } from '../table-model-helpers';
import type { PersistedTableModel, TableCellEntry } from '../../../types/table';

/** Ο πίνακας της οθόνης: τίτλος πλήρους πλάτους + κεφαλίδα + 3 γραμμές δεδομένων. */
function model(): PersistedTableModel {
  return {
    columns: [
      { id: 'c0', sizing: { kind: 'fixed', widthMm: 40 }, valueType: 'text', align: 'left' },
      { id: 'c1', sizing: { kind: 'fixed', widthMm: 40 }, valueType: 'text', align: 'left' },
      { id: 'c2', sizing: { kind: 'fixed', widthMm: 40 }, valueType: 'text', align: 'left' },
    ],
    rows: [
      { id: 'r0', rowClass: 'title' },
      { id: 'r1', rowClass: 'header' },
      { id: 'r2', rowClass: 'data' },
      { id: 'r3', rowClass: 'data' },
      { id: 'r4', rowClass: 'data' },
    ],
    cells: [
      ['r0', 'c0', { kind: 'text', value: 'ΠΙΝΑΚΑΣ' }],
      ['r1', 'c0', { kind: 'text', value: 'Α/Α' }],
      ['r1', 'c1', { kind: 'text', value: 'Περιγραφή' }],
      ['r1', 'c2', { kind: 'text', value: 'Ποσότητα' }],
      ['r3', 'c1', { kind: 'text', value: 'ΖΦ' }],
    ],
    merges: [{ anchorRowId: 'r0', anchorColId: 'c0', rowSpan: 1, colSpan: 3 }],
  };
}

const ids = (entries: readonly { readonly id: string }[]): string[] => entries.map((e) => e.id);
const titleSpan = (m: PersistedTableModel) => m.merges[0];

describe('insertTableRow', () => {
  it('βάζει γραμμή δεδομένων στη ζητούμενη θέση', () => {
    const next = insertTableRow(model(), 3);
    expect(ids(next.rows)).toEqual(['r0', 'r1', 'r2', 'r5', 'r3', 'r4']);
    expect(next.rows[3].rowClass).toBe('data');
    expect(next.rows[3].heightMm).toBeUndefined();
  });

  it('🔴 η νέα ταυτότητα ΔΕΝ συγκρούεται — `r${θέση}` θα γεννούσε δεύτερο `r3`', () => {
    const next = insertTableRow(model(), 3);
    expect(new Set(ids(next.rows)).size).toBe(next.rows.length);
  });

  it('η νέα γραμμή είναι ΠΑΝΤΑ `data`, ακόμα και πάνω από τον τίτλο', () => {
    const next = insertTableRow(model(), 0);
    expect(next.rows[0].rowClass).toBe('data');
    expect(next.rows.filter((r) => r.rowClass === 'title')).toHaveLength(1);
  });

  it('δεν αγγίζει κανένα κελί — ο αραιός χάρτης δείχνει σε ταυτότητες', () => {
    const before = model();
    const next = insertTableRow(before, 2);
    expect(next.cells).toEqual(before.cells);
  });

  it('μεγαλώνει συγχώνευση που τη διαπερνά, αφήνει ήσυχη όποια είναι εκτός', () => {
    const base: PersistedTableModel = {
      ...model(),
      merges: [{ anchorRowId: 'r2', anchorColId: 'c0', rowSpan: 2, colSpan: 1 }],
    };
    expect(insertTableRow(base, 3).merges[0].rowSpan).toBe(3); // μέσα στο [r2..r3]
    expect(insertTableRow(base, 1).merges[0].rowSpan).toBe(2); // πάνω από αυτό
    expect(insertTableRow(base, 4).merges[0].rowSpan).toBe(2); // ακριβώς μετά — Excel: όχι
  });

  it('🔴 ADR-833 Φ5Β — στο πλήρες ΓΙΝΟΜΕΝΟ επιστρέφει το ΙΔΙΟ μοντέλο by-reference', () => {
    // Το φράγμα δεν είναι πια «≤ N γραμμές δεδομένων» αλλά «γραμμές × στήλες ≤ όριο»: το
    // κόστος που πληρώνεται είναι το **πυκνό** πέρασμα του `placeCells`, όχι το πλήθος
    // γραμμών (ADR-833 §5.8.1).
    const base = model();
    const rowCount = MAX_TABLE_GRID_CELLS / base.columns.length;
    const full: PersistedTableModel = {
      ...base,
      rows: Array.from({ length: rowCount }, (_, i) => ({ id: `r${i}`, rowClass: 'data' as const })),
    };
    expect(canInsertTableRow(full)).toBe(false);
    expect(insertTableRow(full, 0)).toBe(full);
  });

  it('🔑 …και ΜΙΑ γραμμή λιγότερο επιτρέπεται — το όριο δεν είναι «περίπου»', () => {
    const base = model();
    const rowCount = MAX_TABLE_GRID_CELLS / base.columns.length - 1;
    const nearFull: PersistedTableModel = {
      ...base,
      rows: Array.from({ length: rowCount }, (_, i) => ({ id: `r${i}`, rowClass: 'data' as const })),
    };
    expect(canInsertTableRow(nearFull)).toBe(true);
  });

  it('🔴 μετρά ΟΛΕΣ τις γραμμές, όχι μόνο τις `data`: ο τίτλος και η κεφαλίδα ζωγραφίζονται', () => {
    // Ο παλιός φύλακας ρωτούσε `dataRowCount`. Ο τίτλος και η κεφαλίδα όμως περνούν κι
    // εκείνοι από τον βρόχο της διάταξης, άρα κοστίζουν — και ένα φράγμα που τους αγνοεί
    // αφήνει το πλέγμα να ξεπεράσει τον προϋπολογισμό κατά όσο ακριβώς κοστίζουν.
    const base = model();
    const rowCount = MAX_TABLE_GRID_CELLS / base.columns.length;
    const withFixedRows: PersistedTableModel = {
      ...base,
      rows: Array.from({ length: rowCount }, (_, i) => ({
        id: `r${i}`,
        rowClass: (i === 0 ? 'title' : i === 1 ? 'header' : 'data') as 'title' | 'header' | 'data',
      })),
    };
    // Με μέτρηση μόνο των `data` θα έμεναν «δύο θέσεις ελεύθερες» και ο φύλακας θα έλεγε ναι.
    expect(canInsertTableRow(withFixedRows)).toBe(false);
  });
});

describe('insertTableColumn', () => {
  it('βάζει στήλη και κληρονομεί το σχήμα της στήλης αναφοράς', () => {
    const base = model();
    const wide: PersistedTableModel = {
      ...base,
      columns: [
        { ...base.columns[0], sizing: { kind: 'fixed', widthMm: 75 }, align: 'right', valueType: 'number' },
        ...base.columns.slice(1),
      ],
    };
    const next = insertTableColumn(wide, 0);
    expect(next.columns[0].sizing).toEqual({ kind: 'fixed', widthMm: 75 });
    expect(next.columns[0].align).toBe('right');
    expect(next.columns[0].valueType).toBe('number');
  });

  it('🔴 ΠΟΤΕ δεν αντιγράφει `sourceKey` — δύο στήλες στην ίδια πηγή είναι σφάλμα δεσμού', () => {
    const base = model();
    const bound: PersistedTableModel = {
      ...base,
      columns: [{ ...base.columns[0], sourceKey: 'quantity' }, ...base.columns.slice(1)],
    };
    expect(insertTableColumn(bound, 1).columns[1].sourceKey).toBeUndefined();
  });

  it('🔴 ο τίτλος πλήρους πλάτους ΜΕΝΕΙ πλήρους πλάτους σε εισαγωγή δεξιά', () => {
    const next = insertTableColumn(model(), 3);
    expect(next.columns).toHaveLength(4);
    expect(titleSpan(next).colSpan).toBe(4);
  });

  it('εισαγωγή στη μέση μεγαλώνει επίσης τον τίτλο', () => {
    expect(titleSpan(insertTableColumn(model(), 1)).colSpan).toBe(4);
  });

  it('συγχώνευση που ΔΕΝ καλύπτει όλο τον άξονα δεν μεγαλώνει από δίπλα (κανόνας Excel)', () => {
    const base: PersistedTableModel = {
      ...model(),
      merges: [{ anchorRowId: 'r0', anchorColId: 'c0', rowSpan: 1, colSpan: 2 }],
    };
    expect(insertTableColumn(base, 2).merges[0].colSpan).toBe(2);
    expect(insertTableColumn(base, 1).merges[0].colSpan).toBe(3);
  });

  it('🔴 ADR-833 Φ5Β — στο πλήρες ΓΙΝΟΜΕΝΟ επιστρέφει το ΙΔΙΟ μοντέλο by-reference', () => {
    const base = model();
    const columnCount = MAX_TABLE_GRID_CELLS / base.rows.length;
    const full: PersistedTableModel = {
      ...base,
      columns: Array.from({ length: columnCount }, (_, i) => ({ ...base.columns[0], id: `c${i}` })),
    };
    expect(canInsertTableColumn(full)).toBe(false);
    expect(insertTableColumn(full, 0)).toBe(full);
  });

  it('🔑 …και ΜΙΑ στήλη λιγότερο επιτρέπεται', () => {
    const base = model();
    const columnCount = MAX_TABLE_GRID_CELLS / base.rows.length - 1;
    const nearFull: PersistedTableModel = {
      ...base,
      columns: Array.from({ length: columnCount }, (_, i) => ({ ...base.columns[0], id: `c${i}` })),
    };
    expect(canInsertTableColumn(nearFull)).toBe(true);
  });
});

describe('deleteTableRow', () => {
  it('σβήνει τη γραμμή ΚΑΙ τα κελιά της', () => {
    const next = deleteTableRow(model(), 'r3');
    expect(ids(next.rows)).toEqual(['r0', 'r1', 'r2', 'r4']);
    expect(next.cells.some(([r]: TableCellEntry) => r === 'r3')).toBe(false);
  });

  it('άγνωστη ταυτότητα ⇒ το ΙΔΙΟ μοντέλο by-reference (κανένα βήμα undo για το τίποτα)', () => {
    const before = model();
    expect(deleteTableRow(before, 'r99')).toBe(before);
  });

  it('η τελευταία γραμμή δεν διαγράφεται — πίνακας χωρίς ύψος είναι αόρατη οντότητα', () => {
    const single: PersistedTableModel = { ...model(), rows: [{ id: 'r0', rowClass: 'data' }] };
    expect(canDeleteTableRow(single)).toBe(false);
    expect(deleteTableRow(single, 'r0')).toBe(single);
  });

  it('μικραίνει συγχώνευση που περνά από τη σβησμένη γραμμή', () => {
    const base: PersistedTableModel = {
      ...model(),
      merges: [{ anchorRowId: 'r2', anchorColId: 'c0', rowSpan: 3, colSpan: 1 }],
    };
    expect(deleteTableRow(base, 'r3').merges[0].rowSpan).toBe(2);
  });
});

describe('deleteTableColumn', () => {
  it('σβήνει τη στήλη, τα κελιά της, και μικραίνει τον τίτλο', () => {
    const next = deleteTableColumn(model(), 'c1');
    expect(ids(next.columns)).toEqual(['c0', 'c2']);
    expect(next.cells.some(([, c]: TableCellEntry) => c === 'c1')).toBe(false);
    expect(titleSpan(next).colSpan).toBe(2);
  });

  it('🔴 διαγραφή της ΑΓΚΥΡΑΣ ξανα-αγκυρώνει τη συγχώνευση ΚΑΙ κουβαλά το περιεχόμενο', () => {
    const next = deleteTableColumn(model(), 'c0');
    expect(titleSpan(next).anchorColId).toBe('c1');
    expect(titleSpan(next).colSpan).toBe(2);
    // Ο χρήστης έβλεπε ΕΝΑ κελί «ΠΙΝΑΚΑΣ» — δεν επιτρέπεται να εξαφανιστεί σιωπηλά.
    expect(getPersistedCellText(next, 'r0', 'c1')).toBe('ΠΙΝΑΚΑΣ');
  });

  it('η μετακόμιση κρατά τη σειρά γραμμή × στήλη ακέραιη', () => {
    const next = deleteTableColumn(model(), 'c0');
    expect(next.cells.map(([r, c]: TableCellEntry) => `${r}:${c}`)).toEqual([
      'r0:c1', 'r1:c1', 'r1:c2', 'r3:c1',
    ]);
  });

  it('συγχώνευση που εκφυλίζεται σε 1×1 παύει να υπάρχει', () => {
    const base: PersistedTableModel = {
      ...model(),
      merges: [{ anchorRowId: 'r0', anchorColId: 'c0', rowSpan: 1, colSpan: 2 }],
    };
    expect(deleteTableColumn(base, 'c0').merges).toHaveLength(0);
  });

  it('η τελευταία στήλη δεν διαγράφεται', () => {
    const base = model();
    const single: PersistedTableModel = { ...base, columns: [base.columns[0]] };
    expect(canDeleteTableColumn(single)).toBe(false);
    expect(deleteTableColumn(single, 'c0')).toBe(single);
  });
});
