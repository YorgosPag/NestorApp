/**
 * 🔴 ADR-833 Φάση 2 — **Ο ΦΥΛΑΚΑΣ ΤΟΥ ΔΡΟΜΕΑ**: «ποιος πίνακας **και ποιο φύλλο**».
 *
 * ## Το σφάλμα που φυλά — και γιατί δεν πιάνεται με τίποτα άλλο
 * Κάθε φύλλο ενός πίνακα ξεκινά από τον **ίδιο** κατασκευαστή, άρα οι ταυτότητες γραμμών και
 * στηλών **συμπίπτουν** (`r0`, `c0`, …). Ένας δρομέας που έμεινε από το φύλλο Α περνά άνετα τον
 * παλιό έλεγχο `cursor.entityId === entity.id` όσο ενεργό είναι το Β — ο πίνακας είναι όντως ο
 * ίδιος. Και το επόμενο γράψιμο **δεν αποτυγχάνει**: προσγειώνεται στο **ομώνυμο κελί του
 * λάθους φύλλου**. Σφάλμα τιμής, χωρίς εξαίρεση, χωρίς μήνυμα, χωρίς ίχνος.
 *
 * ⚠️ Με **ένα** φύλλο (η κατάσταση κάθε πίνακα σήμερα) οι δύο ερωτήσεις δίνουν την **ίδια**
 * απάντηση. Γι' αυτό ο έλεγχος εδώ φτιάχνει ρητά **δύο** φύλλα: αλλιώς θα ήταν μονίμως πράσινος
 * χωρίς να ρωτά τίποτα — η ακριβής κατάληξη που ο ADR-587 §6.1 ονομάζει «σχόλιο, όχι άγκυρα».
 *
 * @see ../table-cell-cursor-scope.ts
 */

import {
  __resetTableCellCursorStoreForTests,
  getTableCellCursor,
  setTableCellCursor,
} from '../table-cell-cursor-store';
import { tableCursorFor, tableForCursor } from '../table-cell-cursor-scope';
import { createTableModel, toPersistedTableModel } from '../../bim/table/table-model-helpers';
import {
  makeTableEntity,
  tableWorksheetsFields,
} from '../../bim/table/__tests__/make-table-entity';
import { tableCursorAt } from '../../bim/table/table-cell-navigation';
import type { PersistedTableModel } from '../../types/table';
import type { TableEntity } from '../../types/table-entity';

/**
 * 🔴 Δύο φύλλα με **ταυτόσημες** ταυτότητες γραμμής/στήλης — ακριβώς όπως τα παράγει ο
 * πραγματικός κατασκευαστής. Αν τα δείγματα είχαν διαφορετικά `rowId`, το σφάλμα θα
 * εκδηλωνόταν ως «κελί δεν βρέθηκε» και ο έλεγχος θα φύλαγε κάτι πολύ πιο εύκολο από την
 * πραγματικότητα.
 */
function sheetModel(value: string): PersistedTableModel {
  return toPersistedTableModel(createTableModel({
    columns: [{ id: 'c0', sizing: { kind: 'fixed', widthMm: 40 }, valueType: 'text', align: 'left' }],
    rows: [{ id: 'r0', rowClass: 'data', heightMm: 8 }],
    cells: [['r0', 'c0', { kind: 'text', value }]],
  }));
}

function twoSheetTable(activeIndex: number): TableEntity {
  return {
    ...makeTableEntity({ id: 'tbl_two' }),
    ...tableWorksheetsFields([sheetModel('Α'), sheetModel('Β')], activeIndex),
  };
}

beforeEach(() => {
  __resetTableCellCursorStoreForTests();
});

describe('🔴 ο δρομέας γεννιέται ΔΕΜΕΝΟΣ στο φύλλο του', () => {
  it('το `setTableCellCursor` γράφει το ενεργό `worksheetId` — δεν μπορεί να παραλειφθεί', () => {
    const onA = twoSheetTable(0);
    setTableCellCursor(onA, tableCursorAt('r0', 'c0'), 'nav');
    expect(getTableCellCursor()?.worksheetId).toBe(onA.worksheets[0].id);
  });

  it('…και σε δεύτερο φύλλο γράφει ΤΟ ΔΙΚΟ ΤΟΥ, όχι πάντα το πρώτο', () => {
    const onB = twoSheetTable(1);
    setTableCellCursor(onB, tableCursorAt('r0', 'c0'), 'nav');
    expect(getTableCellCursor()?.worksheetId).toBe(onB.worksheets[1].id);
  });
});

describe('🔴 ΣΙΩΠΗΛΗ ΔΙΑΦΘΟΡΑ — δρομέας του φύλλου Α ενώ ενεργό είναι το Β', () => {
  it('`tableCursorFor` απορρίπτει τον δρομέα του Α όταν ενεργό είναι το Β', () => {
    const onA = twoSheetTable(0);
    setTableCellCursor(onA, tableCursorAt('r0', 'c0'), 'nav');

    // Ο χρήστης άλλαξε καρτέλα: **ίδια** οντότητα, **ίδια** ταυτότητα κελιού, άλλο φύλλο.
    const onB = twoSheetTable(1);
    expect(getTableCellCursor()?.entityId).toBe(onB.id);
    expect(getTableCellCursor()?.position.rowId).toBe('r0');
    // 🔴 Ο παλιός έλεγχος (`entityId === id`) θα έλεγε «δικός μου» και η επόμενη γραφή θα
    // προσγειωνόταν στο ομώνυμο κελί του **λάθους** φύλλου.
    expect(tableCursorFor(onB)).toBeNull();
  });

  it('`tableForCursor` δεν δίνει οντότητα για δρομέα άλλου φύλλου', () => {
    const onA = twoSheetTable(0);
    setTableCellCursor(onA, tableCursorAt('r0', 'c0'), 'nav');
    const cursor = getTableCellCursor();
    expect(tableForCursor(twoSheetTable(1), cursor)).toBeNull();
  });

  it('στο ΙΔΙΟ φύλλο, ο δρομέας εξακολουθεί να ισχύει (ο φύλακας δεν είναι υπερβολικός)', () => {
    const onA = twoSheetTable(0);
    setTableCellCursor(onA, tableCursorAt('r0', 'c0'), 'nav');
    expect(tableCursorFor(onA)).not.toBeNull();
    expect(tableForCursor(onA, getTableCellCursor())).toBe(onA);
  });

  it('επιστροφή στην καρτέλα Α ⇒ ο δρομέας ΞΑΝΑΪΣΧΥΕΙ (κρίθηκε άκυρος, δεν σβήστηκε)', () => {
    const onA = twoSheetTable(0);
    setTableCellCursor(onA, tableCursorAt('r0', 'c0'), 'nav');
    expect(tableCursorFor(twoSheetTable(1))).toBeNull();
    expect(tableCursorFor(twoSheetTable(0))).not.toBeNull();
  });

  it('άλλος πίνακας ⇒ `null` (ο παλιός έλεγχος διατηρείται ακέραιος)', () => {
    const onA = twoSheetTable(0);
    setTableCellCursor(onA, tableCursorAt('r0', 'c0'), 'nav');
    const other = { ...twoSheetTable(0), id: 'tbl_other' };
    expect(tableCursorFor(other)).toBeNull();
  });

  it('χωρίς δρομέα ⇒ `null`, χωρίς εξαίρεση', () => {
    expect(tableCursorFor(twoSheetTable(0))).toBeNull();
    expect(tableForCursor(null, null)).toBeNull();
  });
});

describe('🔴 Η ΙΣΟΔΥΝΑΜΙΑ ΤΟΥ STORE ΞΕΡΕΙ ΓΙΑ ΤΑ ΦΥΛΛΑ', () => {
  it('ίδιο κελί σε ΑΛΛΟ φύλλο ΔΕΝ είναι «ισοδύναμη εγγραφή»', () => {
    const onA = twoSheetTable(0);
    const onB = twoSheetTable(1);
    setTableCellCursor(onA, tableCursorAt('r0', 'c0'), 'nav');
    setTableCellCursor(onB, tableCursorAt('r0', 'c0'), 'nav');
    // Χωρίς το `worksheetId` στο `equals`, το store θα απέρριπτε τη δεύτερη γραφή ως ισοδύναμη
    // και ο δρομέας θα έμενε δηλωμένος στο φύλλο που ο χρήστης μόλις εγκατέλειψε.
    expect(getTableCellCursor()?.worksheetId).toBe(onB.worksheets[1].id);
  });
});
