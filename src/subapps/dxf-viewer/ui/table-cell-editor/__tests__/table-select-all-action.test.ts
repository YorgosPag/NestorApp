/**
 * 🔴 ADR-739 §43 — **Ο ΕΝΑΣ ΓΡΑΦΕΑΣ ΤΟΥ «ΕΠΙΛΕΞΕ ΤΑ ΠΑΝΤΑ»**, δοκιμασμένος μία φορά για τις
 * τρεις πόρτες που τον καλούν (`Ctrl+A`, αριστερό κλικ στη γωνία, δεξί κλικ στη γωνία).
 *
 * Αυτό είναι όλο το νόημα της εξαγωγής: αν το σώμα είχε μείνει μέσα στο `useCallback`, κάθε
 * πόρτα θα χρειαζόταν **δικό της** στημένο React για να αποδείξει το ίδιο πράγμα — και η τρίτη
 * θα το αντέγραφε.
 *
 * @see ui/table-cell-editor/table-select-all-action.ts — η κεφαλίδα με το σκεπτικό
 */

import { selectWholeTable } from '../table-select-all-action';
import {
  __resetTableCellCursorStoreForTests,
  getTableCellCursor,
  setTableCellCursor,
} from '../../../state/table-cell-cursor-store';
import { tableCursorAt } from '../../../bim/table/table-cell-navigation';
import { resolveTableModel } from '../../../bim/table/table-model-helpers';
import {
  isTableWholeGridRange,
  resolveTableSelectionBounds,
} from '../../../bim/table/table-cell-range';
import type { PersistedTableModel, TableColumn, TableRow } from '../../../types/table';

function buildModel(rowCount: number, colCount: number) {
  const columns: TableColumn[] = Array.from({ length: colCount }, (_, c) => ({
    id: `c${c + 1}`,
    sizing: { kind: 'fixed', widthMm: 10 },
    valueType: 'text',
    align: 'left',
  }));
  const rows: TableRow[] = Array.from({ length: rowCount }, (_, r) => ({
    id: `r${r + 1}`,
    rowClass: 'data',
    heightMm: 6,
  }));
  const persisted: PersistedTableModel = { columns, rows, cells: [], merges: [] };
  return resolveTableModel(persisted);
}

beforeEach(() => {
  __resetTableCellCursorStoreForTests();
});

describe('selectWholeTable', () => {
  it('🔴 γράφει επιλογή που καλύπτει ΟΛΟΚΛΗΡΟ το πλέγμα', () => {
    const model = buildModel(4, 3);
    setTableCellCursor('tbl-1', tableCursorAt('r3', 'c2'), 'nav');

    const written = selectWholeTable(model);

    expect(written).toEqual({ firstRow: 0, lastRow: 3, firstCol: 0, lastCol: 2 });
    const selection = getTableCellCursor()?.selection;
    expect(selection).toBeTruthy();
    expect(isTableWholeGridRange(model, resolveTableSelectionBounds(model, selection!)!)).toBe(true);
  });

  /**
   * 🔴 Μετρημένο στο Excel (04/08): με ενεργό το `A9`, μετά την «επιλογή όλων» το πλαίσιο
   * ονόματος γράφει ακόμα **`A9`**. Το `Ctrl+A` επιλέγει, δεν πλοηγεί.
   */
  it('🔴 ΔΕΝ μετακινεί το ενεργό κελί', () => {
    setTableCellCursor('tbl-1', tableCursorAt('r3', 'c2'), 'nav');
    const before = getTableCellCursor()?.position;

    selectWholeTable(buildModel(4, 3));

    expect(getTableCellCursor()?.position).toEqual(before);
  });

  it('το είδος είναι `range` — κανένα τέταρτο είδος «όλα»', () => {
    setTableCellCursor('tbl-1', tableCursorAt('r1', 'c1'), 'nav');
    selectWholeTable(buildModel(2, 2));
    expect(getTableCellCursor()?.selection?.kind).toBe('range');
  });

  it('είναι ιδεμποτής — δεύτερη κλήση δίνει την ίδια επιλογή', () => {
    const model = buildModel(3, 3);
    setTableCellCursor('tbl-1', tableCursorAt('r1', 'c1'), 'nav');
    selectWholeTable(model);
    const first = getTableCellCursor()?.selection;
    selectWholeTable(model);
    expect(getTableCellCursor()?.selection).toEqual(first);
  });

  /**
   * Εκφυλισμένο μοντέλο: **καμία** γραφή και ρητό `null`. Μια «επιλογή» πάνω σε μηδέν γραμμές
   * θα ήταν μπαγιάτικη αναφορά που ο ζωγράφος θα προσπαθούσε να λύσει σε κάθε καρέ.
   */
  it('χωρίς γραμμές ή χωρίς στήλες ⇒ `null` και ΚΑΜΙΑ επιλογή', () => {
    setTableCellCursor('tbl-1', tableCursorAt('r1', 'c1'), 'nav');
    expect(selectWholeTable(buildModel(0, 3))).toBeNull();
    expect(selectWholeTable(buildModel(3, 0))).toBeNull();
    expect(getTableCellCursor()?.selection).toBeFalsy();
  });
});
