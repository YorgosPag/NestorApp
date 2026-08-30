/**
 * ADR-833 Φάση 3 — **η αλλαγή ενεργού φύλλου**: το μπάλωμα, η μνήμη δρομέα, οι φύλακες no-op.
 *
 * Τρεις άγκυρες που δεν είναι προφανείς:
 *
 *  1. **Ενεργοποίηση ≠ ιστορικό.** Το σχέδιο είναι σκέτο `Partial<TableEntity>` — **καμία**
 *     εντολή, άρα καμία στοίβα αναίρεσης. Και το `activeWorksheetId` επιβιώνει JSON round-trip.
 *  2. **Ταυτότητα.** Κλικ στην ήδη ενεργή καρτέλα ⇒ `null`, όχι «μπάλωμα που δεν αλλάζει
 *     τίποτα»: το δεύτερο θα γεννούσε νέα οντότητα ⇒ ακύρωση κάθε απομνημόνευσης διάταξης.
 *  3. **Η μνήμη επικυρώνεται.** Θέση που δεν υπάρχει πια στο φύλλο-προορισμό δεν επιστρέφεται
 *     ποτέ: θα έδινε δρομέα που το `moveTableCursor` απορρίπτει, δηλαδή πλαίσιο στην οθόνη και
 *     **κανένα βέλος να μη δουλεύει** — σφάλμα χωρίς εξαίρεση και χωρίς ίχνος.
 */

import { planWorksheetActivation } from '../table-worksheet-activate';
import { buildTableEntity } from '../build-table-entity';
import { activeTableModel, activeWorksheet, resolveWorksheets } from '../table-worksheet-resolve';
import { resolveTableModel } from '../table-model-helpers';
import { tableCursorAt } from '../table-cell-navigation';
import { FIRST_TABLE_WORKSHEET_ID, tableWorksheetId } from '../../../types/table-worksheet';
import type { TableEntity } from '../../../types/table-entity';
import type { TableWorksheet } from '../../../types/table-worksheet';

const WS1 = tableWorksheetId('ws1');

/** Πίνακας δύο φύλλων: και τα δύο από τον ίδιο κατασκευαστή, άρα ίδιες ταυτότητες κελιών. */
function twoSheetTable(): TableEntity {
  const base = buildTableEntity({ x: 0, y: 0 }, {}, 'tbl_ws', 'lyr_test');
  const second: TableWorksheet = { id: WS1, model: base.worksheets[0].model };
  return { ...base, worksheets: [base.worksheets[0], second] };
}

/** Οι ταυτότητες του πρώτου κελιού και ενός δεύτερου, από το ζωντανό μοντέλο. */
function cells(entity: TableEntity) {
  const model = resolveTableModel(activeTableModel(entity));
  return {
    first: { rowId: model.rows[0].id, colId: model.columns[0].id },
    other: { rowId: model.rows[1].id, colId: model.columns[1].id },
  };
}

describe('ADR-833 Φ3 — το μπάλωμα της ενεργοποίησης', () => {
  it('αλλάζει το `activeWorksheetId` και τίποτα άλλο, όταν δεν υπάρχει δρομέας', () => {
    const entity = twoSheetTable();
    const plan = planWorksheetActivation(entity, WS1, null);
    expect(plan).not.toBeNull();
    expect(plan!.patch.activeWorksheetId).toBe(WS1);
    // Τα φύλλα περνούν **αυτούσια**: κανένα δεν άλλαξε.
    expect(plan!.patch.worksheets).toBe(resolveWorksheets(entity));
    expect(plan!.restoreCursor).toBeNull();
  });

  it('🔴 ΚΑΜΙΑ ΕΝΤΟΛΗ: το σχέδιο είναι σκέτο μπάλωμα — τίποτα να μπει σε στοίβα αναίρεσης', () => {
    const plan = planWorksheetActivation(twoSheetTable(), WS1, null)!;
    // Ένα `ICommand` θα είχε `execute`/`undo`. Εδώ υπάρχουν μόνο πεδία οντότητας.
    expect(Object.keys(plan.patch).sort()).toEqual(['activeWorksheetId', 'worksheets']);
  });

  it('🔴 το `activeWorksheetId` ΕΠΙΒΙΩΝΕΙ JSON round-trip (ζει στην οντότητα, όχι σε store)', () => {
    const entity = twoSheetTable();
    const plan = planWorksheetActivation(entity, WS1, null)!;
    const patched = { ...entity, ...plan.patch };
    const revived = JSON.parse(JSON.stringify(patched)) as TableEntity;
    expect(revived.activeWorksheetId).toBe(WS1);
    expect(activeWorksheet(revived).id).toBe(WS1);
  });

  it('🔑 ΚΛΙΚ ΣΤΗΝ ΗΔΗ ΕΝΕΡΓΗ ΚΑΡΤΕΛΑ ⇒ `null` (καμία νέα οντότητα, καμία ακύρωση διάταξης)', () => {
    const entity = twoSheetTable();
    expect(planWorksheetActivation(entity, FIRST_TABLE_WORKSHEET_ID, null)).toBeNull();
    expect(planWorksheetActivation(entity, FIRST_TABLE_WORKSHEET_ID, cellCursor(entity))).toBeNull();
  });

  it('άγνωστος στόχος ⇒ `null` — ΠΟΤΕ πτώση στο πρώτο φύλλο', () => {
    const entity = twoSheetTable();
    expect(planWorksheetActivation(entity, tableWorksheetId('wsX'), null)).toBeNull();
  });
});

describe('🔴 ADR-833 Φ3 — Η ΜΝΗΜΗ ΕΝΕΡΓΟΥ ΚΕΛΙΟΥ ΑΝΑ ΦΥΛΛΟ (Excel / OOXML parity)', () => {
  it('το φύλλο που ΕΓΚΑΤΑΛΕΙΠΕΤΑΙ κρατά τη θέση του δρομέα — μόνο rowId/colId', () => {
    const entity = twoSheetTable();
    const { other } = cells(entity);
    const plan = planWorksheetActivation(entity, WS1, tableCursorAt(other.rowId, other.colId))!;
    const leaving = plan.patch.worksheets.find((s) => s.id === FIRST_TABLE_WORKSHEET_ID)!;
    expect(leaving.cursor).toEqual({ rowId: other.rowId, colId: other.colId });
    // ⚠️ Χωρίς `anchorColId`: κατάσταση χειρονομίας, όχι θέσης.
    expect(Object.keys(leaving.cursor!).sort()).toEqual(['colId', 'rowId']);
  });

  it('🔑 ΕΠΙΣΤΡΟΦΗ: το φύλλο ξαναδίνει το κελί που θυμάται', () => {
    const entity = twoSheetTable();
    const { other } = cells(entity);
    // Πάμε στο ws1 αφήνοντας μνήμη στο ws0…
    const away = planWorksheetActivation(entity, WS1, tableCursorAt(other.rowId, other.colId))!;
    const atWs1 = { ...entity, ...away.patch };
    // …και γυρίζουμε.
    const back = planWorksheetActivation(atWs1, FIRST_TABLE_WORKSHEET_ID, cellCursor(atWs1))!;
    expect(back.restoreCursor).toEqual(tableCursorAt(other.rowId, other.colId));
  });

  it('φύλλο χωρίς μνήμη ⇒ πρώτο κελί (κανείς δεν το έχει επισκεφθεί)', () => {
    const entity = twoSheetTable();
    const { first } = cells(entity);
    const plan = planWorksheetActivation(entity, WS1, cellCursor(entity))!;
    expect(plan.restoreCursor).toEqual(tableCursorAt(first.rowId, first.colId));
  });

  it('🔴 ΜΠΑΓΙΑΤΙΚΗ ΜΝΗΜΗ ΕΠΙΚΥΡΩΝΕΤΑΙ: ανύπαρκτη γραμμή ⇒ πρώτο κελί, ποτέ νεκρός δρομέας', () => {
    const entity = twoSheetTable();
    const { first } = cells(entity);
    const poisoned: TableEntity = {
      ...entity,
      worksheets: entity.worksheets.map((s) =>
        s.id === WS1
          ? { ...s, cursor: { rowId: first.rowId, colId: 'c_deleted' as typeof first.colId } }
          : s,
      ),
    };
    const plan = planWorksheetActivation(poisoned, WS1, cellCursor(poisoned))!;
    expect(plan.restoreCursor).toEqual(tableCursorAt(first.rowId, first.colId));
  });

  it('🔴 ΧΩΡΙΣ ΔΡΟΜΕΑ (απλή επιλογή) η μνήμη ΔΕΝ γράφεται και ΔΕΝ επαναφέρεται δρομέας', () => {
    const entity = twoSheetTable();
    const plan = planWorksheetActivation(entity, WS1, null)!;
    expect(plan.patch.worksheets.every((s) => s.cursor === undefined)).toBe(true);
    expect(plan.restoreCursor).toBeNull();
  });

  it('🔑 ΙΔΙΑ ΜΝΗΜΗ ⇒ ΙΔΙΑ ΑΝΑΦΟΡΑ φύλλου (η αλυσίδα WeakMap του ανενεργού μένει ζωντανή)', () => {
    const entity = twoSheetTable();
    const { other } = cells(entity);
    const cursor = tableCursorAt(other.rowId, other.colId);
    const first = planWorksheetActivation(entity, WS1, cursor)!;
    const atWs1 = { ...entity, ...first.patch };
    // Γύρνα πίσω, ξαναφύγε από το ίδιο κελί: η μνήμη είναι ήδη αυτή.
    const back = planWorksheetActivation(atWs1, FIRST_TABLE_WORKSHEET_ID, cellCursor(atWs1))!;
    const atWs0 = { ...atWs1, ...back.patch };
    const again = planWorksheetActivation(atWs0, WS1, cursor)!;
    const before = resolveWorksheets(atWs0).find((s) => s.id === FIRST_TABLE_WORKSHEET_ID);
    const after = again.patch.worksheets.find((s) => s.id === FIRST_TABLE_WORKSHEET_ID);
    expect(after).toBe(before);
    expect(again.patch.worksheets).toBe(resolveWorksheets(atWs0));
  });

  it('τα ΑΛΛΑ φύλλα περνούν αυτούσια — η μνήμη αγγίζει μόνο εκείνο που εγκαταλείπεται', () => {
    const entity = twoSheetTable();
    const { other } = cells(entity);
    const plan = planWorksheetActivation(entity, WS1, tableCursorAt(other.rowId, other.colId))!;
    const target = plan.patch.worksheets.find((s) => s.id === WS1);
    expect(target).toBe(entity.worksheets[1]);
  });
});

/** Ο δρομέας στο πρώτο κελί του **ενεργού** φύλλου — ό,τι θα έδινε το `tableCursorFor`. */
function cellCursor(entity: TableEntity) {
  const model = resolveTableModel(activeTableModel(entity));
  return tableCursorAt(model.rows[0].id, model.columns[0].id);
}
