/**
 * 🔴 ADR-739 §36 (ΦΑΣΗ 4) — **«ρώτα πριν σβήσεις»** ως εκτελέσιμη προδιαγραφή.
 *
 * Η **πρώτη** από τις τρεις αποφάσεις του ιδιοκτήτη (03/08) κλειδώνει εδώ, και μαζί της τα
 * τέσσερα ερωτήματα που γεννά ένας **ασύγχρονος** διάλογος πάνω σε **σύγχρονη** χειρονομία:
 *
 *  1. πότε **δεν** ρωτάμε (κενός προορισμός) — η σιωπηλή διαδρομή μένει σύγχρονη·
 *  2. τι κρατά ο χρήστης μπροστά του όσο απαντά (**το φάντασμα**, αυτούσιο)·
 *  3. τι γίνεται αν αλλάξει ο κόσμος όσο ρωτάμε (**τίποτα** — το σχέδιο ανήκει στη σκηνή του)·
 *  4. ότι μία απάντηση «ναι» = **ΕΝΑ** βήμα αναίρεσης, όχι ένα για τον διάλογο κι ένα για τη γραφή.
 *
 * Δοκιμάζεται **χωρίς DOM**: η γραφή είναι καθαρή, και ο διάλογος φτάνει ως χειραψία Promise. Ό,τι
 * χρειάζεται ποντίκι ζει στο `table-range-transfer-drag.test.ts`.
 */

import { completeTableRangeTransfer } from '../table-range-transfer-drop';
import {
  getTableRangeOverwriteState,
  resolveTableRangeOverwrite,
} from '../../../bim/table/table-range-overwrite-confirm-store';
import {
  __resetTableRangeTransferPreviewForTests,
  getTableRangeTransferPreview,
} from '../../../state/table-range-transfer-store';
import {
  __resetTableCellCursorStoreForTests,
  getTableCellCursor,
} from '../../../state/table-cell-cursor-store';
import { planTableRangeTransfer } from '../../../bim/table/table-range-transfer-plan';
import { PLAIN_TABLE_RANGE_DRAG } from '../../../bim/table/table-range-move-zone';
import {
  createTableModel,
  getPersistedCellText,
  toPersistedTableModel,
} from '../../../bim/table/table-model-helpers';
import { BUILTIN_TABLE_STYLE_IDS } from '../../../bim/table/table-style-presets';
import type { TableRangeTransferPlan } from '../../../bim/table/table-range-transfer-types';
import type { TableRangeTransferPreview } from '../../../state/table-range-transfer-store';
import type { TableEntity } from '../../../types/table-entity';
import type {
  PersistedTableModel,
  TableCellEntry,
  TableColumn,
  TableColumnId,
  TableRow,
  TableRowId,
} from '../../../types/table';

/** Ίδιο σκεπτικό με το `table-range-transfer-drag.test.ts`: ο scheduler δεν δοκιμάζεται εδώ. */
jest.mock('../../../rendering/core/frame-scheduler-api', () => ({
  markSystemsDirty: jest.fn(),
  registerRenderCallback: jest.fn(() => () => undefined),
  RENDER_PRIORITIES: { CRITICAL: 0, HIGH: 1, NORMAL: 2, LOW: 3 },
}));

const COLUMNS: TableColumn[] = ['c0', 'c1'].map((id) => ({
  id,
  sizing: { kind: 'fixed', widthMm: 20 },
  valueType: 'text',
  align: 'left',
}));
const ROWS: TableRow[] = ['r0', 'r1', 'r2', 'r3'].map((id) => ({
  id,
  rowClass: 'data',
  heightMm: 10,
}));

const text = (rowId: string, colId: string, value: string): TableCellEntry => [
  rowId as TableRowId,
  colId as TableColumnId,
  { kind: 'text', value },
];

function persisted(cells: TableCellEntry[]): PersistedTableModel {
  return toPersistedTableModel(createTableModel({ columns: COLUMNS, rows: ROWS, cells }));
}

function entityOf(model: PersistedTableModel): TableEntity {
  return {
    id: 'tbl_1',
    type: 'table',
    layerId: 'lyr_test',
    position: { x: 0, y: 0 },
    angleRad: 0,
    styleId: BUILTIN_TABLE_STYLE_IDS.STANDARD,
    model,
  };
}

/** Μετακίνηση της γραμμής `r0` (και τα δύο κελιά της) πάνω στη γραμμή `r2`. */
function planOnto(model: PersistedTableModel): TableRangeTransferPlan {
  const outcome = planTableRangeTransfer(model, {
    source: { firstRow: 0, lastRow: 0, firstCol: 0, lastCol: 1 },
    to: { rowId: 'r2' as TableRowId, colId: 'c0' as TableColumnId },
    intent: PLAIN_TABLE_RANGE_DRAG,
    shiftAxis: 'down',
  });
  if (!outcome.ok) throw new Error(`Το σχέδιο απορρίφθηκε: ${outcome.reason}`);
  return outcome.plan;
}

const LAST_FRAME: TableRangeTransferPreview = {
  entityId: 'tbl_1',
  destination: { firstRow: 2, lastRow: 2, firstCol: 0, lastCol: 1 },
  insertAxis: null,
  refused: false,
};

let commit: jest.Mock<void, [TableEntity, TableEntity['model']]>;

/** Δύο microtasks: το `resolve` αφήνει τον χειριστή του Promise στην ουρά, όχι στη στοίβα. */
async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(() => {
  commit = jest.fn();
});

afterEach(() => {
  resolveTableRangeOverwrite('cancel');
  __resetTableRangeTransferPreviewForTests();
  __resetTableCellCursorStoreForTests();
});

// ── 1. Πότε ΔΕΝ ρωτάμε ────────────────────────────────────────────────────────

describe('🔴 §36.22 ο κενός προορισμός δεν γεννά ερώτηση — η σιωπηλή διαδρομή μένει ΣΥΓΧΡΟΝΗ', () => {
  it('κανένα κελί με περιεχόμενο ⇒ γράφει ΑΜΕΣΩΣ, χωρίς διάλογο', () => {
    const model = persisted([text('r0', 'c0', 'Α')]);
    const entity = entityOf(model);

    completeTableRangeTransfer({ entity, commit, liveTable: () => entity }, planOnto(model), LAST_FRAME);

    expect(getTableRangeOverwriteState().open).toBe(false);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(getPersistedCellText(commit.mock.calls[0][1], 'r2' as TableRowId, 'c0' as TableColumnId)).toBe('Α');
  });

  it('🔑 βαμμένο αλλά ΚΕΝΟ κελί δεν είναι «δεδομένα» ⇒ καμία ερώτηση (Excel parity)', () => {
    // Το κατηγόρημα το κλειδώνει ήδη· εδώ ελέγχεται ότι ο **διάλογος** το σέβεται. Αν ρωτούσε
    // για μορφοποίηση, η ερώτηση θα εμφανιζόταν σχεδόν πάντα (οι κεφαλίδες είναι βαμμένες).
    const model = persisted([text('r0', 'c0', 'Α'), text('r2', 'c0', '')]);
    const entity = entityOf(model);

    completeTableRangeTransfer({ entity, commit, liveTable: () => entity }, planOnto(model), LAST_FRAME);

    expect(getTableRangeOverwriteState().open).toBe(false);
    expect(commit).toHaveBeenCalledTimes(1);
  });
});

// ── 2. Η ερώτηση ──────────────────────────────────────────────────────────────

describe('🔴 §36.22 «υπάρχουν ήδη δεδομένα εδώ» — η ερώτηση ΑΝΑΣΤΕΛΛΕΙ τη γραφή', () => {
  it('προορισμός με 2 κελιά ⇒ ο διάλογος λέει **2**, και ΤΙΠΟΤΑ δεν έχει γραφτεί ακόμη', () => {
    const model = persisted([text('r0', 'c0', 'Α'), text('r2', 'c0', 'Χ'), text('r2', 'c1', 'Ψ')]);
    const entity = entityOf(model);

    completeTableRangeTransfer({ entity, commit, liveTable: () => entity }, planOnto(model), LAST_FRAME);

    expect(getTableRangeOverwriteState()).toEqual({ open: true, cells: 2 });
    expect(commit).not.toHaveBeenCalled();
  });

  it('🔑 το ΦΑΝΤΑΣΜΑ μένει όσο ρωτάμε — η ερώτηση λέει «τι», η οθόνη «πού»', () => {
    const model = persisted([text('r0', 'c0', 'Α'), text('r2', 'c0', 'Χ')]);
    const entity = entityOf(model);

    completeTableRangeTransfer({ entity, commit, liveTable: () => entity }, planOnto(model), LAST_FRAME);

    // **Αυτούσιο** το τελευταίο καρέ της σύρσης, όχι νέο ορθογώνιο: η υπόσχεση που είδε ο
    // χρήστης και η εικόνα που κρατάμε δεν μπορούν να αποκλίνουν (§36.15).
    expect(getTableRangeTransferPreview()).toEqual(LAST_FRAME);
  });

  it('«Άκυρο» ⇒ καμία γραφή, κανένα βήμα undo, και το φάντασμα ΣΒΗΝΕΙ', async () => {
    const model = persisted([text('r0', 'c0', 'Α'), text('r2', 'c0', 'Χ')]);
    const entity = entityOf(model);

    completeTableRangeTransfer({ entity, commit, liveTable: () => entity }, planOnto(model), LAST_FRAME);
    resolveTableRangeOverwrite('cancel');
    await flush();

    expect(commit).not.toHaveBeenCalled();
    expect(getTableRangeTransferPreview()).toBeNull();
  });

  it('«Αντικατάσταση» ⇒ **ΕΝΑ** commit, το φάντασμα σβήνει, η επιλογή ακολουθεί', async () => {
    const model = persisted([text('r0', 'c0', 'Α'), text('r2', 'c0', 'Χ')]);
    const entity = entityOf(model);

    completeTableRangeTransfer({ entity, commit, liveTable: () => entity }, planOnto(model), LAST_FRAME);
    resolveTableRangeOverwrite('replace');
    await flush();

    // ΕΝΑ βήμα undo: ο διάλογος δεν προσθέτει δικό του — η ερώτηση δεν γράφει τίποτα.
    expect(commit).toHaveBeenCalledTimes(1);
    expect(getPersistedCellText(commit.mock.calls[0][1], 'r2' as TableRowId, 'c0' as TableColumnId)).toBe('Α');
    expect(getTableRangeTransferPreview()).toBeNull();
    // Η επιλογή ακολουθεί την περιοχή: ενεργό κελί στην πάνω-αριστερή γωνία της προσγείωσης
    // (`anchorColId` = η **νέα** στήλη αγκύρωσης — ένα drop ξεκινά καινούρια σειρά καταχώρισης).
    expect(getTableCellCursor()?.position).toEqual({ rowId: 'r2', colId: 'c0', anchorColId: 'c0' });
  });
});

// ── 3. 🔴 Ο φύλακας του χρόνου ────────────────────────────────────────────────

describe('🔴 §36.22 το σχέδιο ανήκει στη ΣΚΗΝΗ ΠΟΥ ΤΟ ΓΕΝΝΗΣΕ', () => {
  it('🔴 `Ctrl+Z` όσο ο διάλογος είναι ανοιχτός ⇒ το «ναι» ΔΕΝ γράφει τίποτα', async () => {
    // Το σχέδιο κουβαλά **δείκτες** γραμμών/στηλών· σε άλλο μοντέλο σημαίνουν **άλλα κελιά**.
    // Χωρίς αυτόν τον φύλακα, ένα «Αντικατάσταση» μετά από αναίρεση θα έγραφε πάνω σε σκηνή
    // που κανείς δεν σχεδίασε — δηλαδή ακριβώς η καταστροφή που η φάση αποτρέπει.
    const model = persisted([text('r0', 'c0', 'Α'), text('r2', 'c0', 'Χ')]);
    const entity = entityOf(model);
    let live: TableEntity | null = entity;

    completeTableRangeTransfer({ entity, commit, liveTable: () => live }, planOnto(model), LAST_FRAME);
    live = entityOf(persisted([text('r0', 'c0', 'ΑΛΛΟ')])); // ο κόσμος άλλαξε όσο ρωτούσαμε
    resolveTableRangeOverwrite('replace');
    await flush();

    expect(commit).not.toHaveBeenCalled();
    expect(getTableRangeTransferPreview()).toBeNull();
  });

  it('🔴 ο πίνακας σβήστηκε όσο ρωτούσαμε ⇒ το «ναι» ΔΕΝ γράφει τίποτα', async () => {
    const model = persisted([text('r0', 'c0', 'Α'), text('r2', 'c0', 'Χ')]);
    const entity = entityOf(model);
    let live: TableEntity | null = entity;

    completeTableRangeTransfer({ entity, commit, liveTable: () => live }, planOnto(model), LAST_FRAME);
    live = null;
    resolveTableRangeOverwrite('replace');
    await flush();

    expect(commit).not.toHaveBeenCalled();
  });

  it('η σκηνή ΔΕΝ άλλαξε ⇒ ο φύλακας δεν εμποδίζει (ο έλεγχος είναι ταυτότητας, όχι τιμής)', async () => {
    const model = persisted([text('r0', 'c0', 'Α'), text('r2', 'c0', 'Χ')]);
    const entity = entityOf(model);
    // **Άλλο** αντικείμενο οντότητας, **ίδιο** μοντέλο by-reference: αυτό ακριβώς παράγει κάθε
    // αβλαβής επανα-απόδοση της σκηνής, και δεν επιτρέπεται να ακυρώσει τη μεταφορά.
    let live: TableEntity | null = entity;

    completeTableRangeTransfer({ entity, commit, liveTable: () => live }, planOnto(model), LAST_FRAME);
    live = { ...entity };
    resolveTableRangeOverwrite('replace');
    await flush();

    expect(commit).toHaveBeenCalledTimes(1);
  });
});
