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

import { selectWholeTable, selectWholeTableFromCorner } from '../table-select-all-action';
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
import type { CellSpan, PersistedTableModel, TableColumn, TableRow } from '../../../types/table';
import type { TableEntity } from '../../../types/table-entity';
import { setTableCellCursorById } from '../../../bim/table/__tests__/make-table-entity';

function buildModel(rowCount: number, colCount: number, merges: readonly CellSpan[] = []) {
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
  const persisted: PersistedTableModel = { columns, rows, cells: [], merges };
  return resolveTableModel(persisted);
}

/**
 * Το ελάχιστο δοχείο που ζητά ο γραφέας **χειρονομίας**: ταυτότητα + μοντέλο. Ό,τι άλλο κουβαλά
 * μια `TableEntity` (γεωμετρία, στυλ, επίπεδο) δεν το ρωτά ποτέ — και ένα πλήρες στήσιμο θα
 * έκρυβε ακριβώς αυτό.
 */
function buildEntity(rowCount: number, colCount: number, merges: readonly CellSpan[] = []) {
  return { id: 'tbl-1', model: buildModel(rowCount, colCount, merges) } as unknown as TableEntity;
}

beforeEach(() => {
  __resetTableCellCursorStoreForTests();
});

describe('selectWholeTable', () => {
  it('🔴 γράφει επιλογή που καλύπτει ΟΛΟΚΛΗΡΟ το πλέγμα', () => {
    const model = buildModel(4, 3);
    setTableCellCursorById('tbl-1', tableCursorAt('r3', 'c2'), 'nav');

    const written = selectWholeTable(model);

    expect(written).toEqual({ firstRow: 0, lastRow: 3, firstCol: 0, lastCol: 2 });
    const selection = getTableCellCursor()?.selection;
    expect(selection).toBeTruthy();
    expect(isTableWholeGridRange(model, resolveTableSelectionBounds(model, selection!)!)).toBe(true);
  });

  /**
   * 🔴 Μετρημένο στο Excel (04/08): με ενεργό το `A9`, μετά την «επιλογή όλων» το πλαίσιο
   * ονόματος γράφει ακόμα **`A9`**. Το `Ctrl+A` επιλέγει, δεν πλοηγεί.
   *
   * ⚠️ **§68.9 — αυτή η άγκυρα ΔΕΝ ακυρώθηκε, οριοθετήθηκε.** Ισχύει για την **εντολή**· η
   * **χειρονομία** (πάτημα στη γωνία) κάνει το αντίθετο, και το φυλάει το describe από κάτω.
   * Οι δύο μαζί είναι ο λόγος που οι γραφείς είναι δύο: μια «απλοποίηση» σε έναν θα έσπαγε
   * **σιωπηλά** τη μία από τις δύο συμπεριφορές.
   */
  it('🔴 ΔΕΝ μετακινεί το ενεργό κελί (η ΕΝΤΟΛΗ — `Ctrl+A`)', () => {
    setTableCellCursorById('tbl-1', tableCursorAt('r3', 'c2'), 'nav');
    const before = getTableCellCursor()?.position;

    selectWholeTable(buildModel(4, 3));

    expect(getTableCellCursor()?.position).toEqual(before);
  });

  it('το είδος είναι `range` — κανένα τέταρτο είδος «όλα»', () => {
    setTableCellCursorById('tbl-1', tableCursorAt('r1', 'c1'), 'nav');
    selectWholeTable(buildModel(2, 2));
    expect(getTableCellCursor()?.selection?.kind).toBe('range');
  });

  it('είναι ιδεμποτής — δεύτερη κλήση δίνει την ίδια επιλογή', () => {
    const model = buildModel(3, 3);
    setTableCellCursorById('tbl-1', tableCursorAt('r1', 'c1'), 'nav');
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
    setTableCellCursorById('tbl-1', tableCursorAt('r1', 'c1'), 'nav');
    expect(selectWholeTable(buildModel(0, 3))).toBeNull();
    expect(selectWholeTable(buildModel(3, 0))).toBeNull();
    expect(getTableCellCursor()?.selection).toBeFalsy();
  });
});

/**
 * 🔴 ADR-739 §68.9 — **Ο ΓΡΑΦΕΑΣ ΤΗΣ ΧΕΙΡΟΝΟΜΙΑΣ**: όλα τα κελιά **και** ενεργό κελί στο `A1`.
 *
 * Ο ιδιοκτήτης το μέτρησε στο Excel (20/08, δύο στιγμιότυπα). Η μέτρηση του §43 («το ενεργό
 * κελί δεν μετακινείται») ήταν σωστή **για το `Ctrl+A`** και γενικεύτηκε στο πάτημα επειδή οι
 * πόρτες μοιράζονταν γραφέα — δες την κεφαλίδα του module.
 */
describe('🔴 §68.9 selectWholeTableFromCorner — η ΧΕΙΡΟΝΟΜΙΑ', () => {
  it('🔴 μετακινεί το ενεργό κελί στο A1 (Excel: το Name Box γράφει A1)', () => {
    setTableCellCursorById('tbl-1', tableCursorAt('r3', 'c2'), 'nav');

    selectWholeTableFromCorner(buildEntity(4, 3));

    const position = getTableCellCursor()?.position;
    expect(position?.rowId).toBe('r1');
    expect(position?.colId).toBe('c1');
  });

  /**
   * 🔴 **Η ΣΕΙΡΑ ΕΙΝΑΙ ΤΟ ΣΥΜΒΟΛΑΙΟ.** Το `setTableCellCursor` **διαλύει** κάθε επιλογή
   * (τεκμηριωμένο στο store), άρα η επιλογή γράφεται **μετά**. Ανάποδα, θα έσβηνε τη στιγμή που
   * γεννιέται — και το test θα έβλεπε ενεργό κελί σωστό με **καμία** επιλογή, δηλαδή ένα κουμπί
   * «επιλογή όλων» που δεν επιλέγει τίποτα.
   */
  it('🔴 η επιλογή ΕΠΙΒΙΩΝΕΙ της μετακίνησης του δρομέα (σειρά: δρομέας → επιλογή)', () => {
    setTableCellCursorById('tbl-1', tableCursorAt('r3', 'c2'), 'nav');
    const model = buildModel(4, 3);

    const written = selectWholeTableFromCorner(buildEntity(4, 3));

    expect(written).toEqual({ firstRow: 0, lastRow: 3, firstCol: 0, lastCol: 2 });
    const selection = getTableCellCursor()?.selection;
    expect(selection).toBeTruthy();
    expect(isTableWholeGridRange(model, resolveTableSelectionBounds(model, selection!)!)).toBe(true);
  });

  /**
   * 🔴 **§29.15 σε μικρογραφία, και γιατί ΔΕΝ ξανασυμβαίνει εδώ.**
   *
   * Εκείνο πλήρωσε ότι το `selectWholeAxis` έβαλε δρομέα στο `B1`, **καλυμμένο** από συγχωνευμένο
   * τίτλο ⇒ `overlay` → `null` ⇒ ο φύλακας του κλειδώματος αποπροσαρτήθηκε μέσα στο ίδιο commit.
   * Το `A1` **δεν μπορεί** να είναι καλυμμένο: καμία συγχώνευση δεν ξεκινά πριν από το
   * πάνω-αριστερό κελί. Εδώ ο τίτλος απλώνεται σε **όλες** τις στήλες — ακριβώς το σχήμα του
   * §29.15 — και ο δρομέας προσγειώνεται στην **άγκυρα**, όχι σε καλυμμένο κελί.
   */
  it('🔴 συγχωνευμένος τίτλος A1:C1 ⇒ ο δρομέας πάει στην ΑΓΚΥΡΑ, ποτέ σε καλυμμένο κελί', () => {
    setTableCellCursorById('tbl-1', tableCursorAt('r3', 'c2'), 'nav');
    const merges: readonly CellSpan[] = [
      { anchorRowId: 'r1', anchorColId: 'c1', rowSpan: 1, colSpan: 3 },
    ];

    selectWholeTableFromCorner(buildEntity(4, 3, merges));

    expect(getTableCellCursor()?.position).toMatchObject({ rowId: 'r1', colId: 'c1' });
  });

  it('εκφυλισμένο μοντέλο ⇒ `null`, ΚΑΜΙΑ επιλογή και ΚΑΜΙΑ μετακίνηση', () => {
    setTableCellCursorById('tbl-1', tableCursorAt('r1', 'c1'), 'nav');
    const before = getTableCellCursor()?.position;

    expect(selectWholeTableFromCorner(buildEntity(0, 3))).toBeNull();

    expect(getTableCellCursor()?.selection).toBeFalsy();
    expect(getTableCellCursor()?.position).toEqual(before);
  });
});
