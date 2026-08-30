/**
 * 🔴 ADR-767 §11.2 #4 / Δ1 — **ΤΟ ΔΕΜΕΝΟ ΚΕΛΙ ΔΕΝ ΓΡΑΦΕΤΑΙ, ΚΑΙ ΤΩΡΑ ΚΑΠΟΙΟΣ ΡΩΤΑΕΙ.**
 *
 * ## Το κενό που κλείνει
 * Το `isBoundCellWritable` απαντούσε σωστά από τις 07/08 — και **κανείς δεν το ρωτούσε**:
 * ο `table-cell-edit-session.ts` έγραφε σε κάθε κελί. Δηλαδή ακριβώς το σχήμα «η κρίση
 * υπάρχει, ο καταναλωτής λείπει» που το ADR-767 §8 #7 απαγορεύει ρητά — απλώς μετατοπισμένο
 * μία θέση: εδώ δεν έλειπε ο **συγκριτής**, έλειπε ο **φρουρός**.
 *
 * ## Γιατί η επιβολή είναι ΔΥΟ φορές (belt-and-suspenders, N.7.2 #4)
 * 1. Ο **στόχος** δηλώνει `readOnly` ⇒ ο επεξεργαστής ανοίγει read-only, δεν σε αφήνει να
 *    πληκτρολογήσεις κάτι που θα εξαφανιζόταν στο επόμενο refresh.
 * 2. Ο **γραφέας** αρνείται ούτως ή άλλως ⇒ κάθε άλλο μονοπάτι εγγραφής (πληκτρολόγιο,
 *    επικόλληση προγραμματιστικά, μελλοντική επιφάνεια) πέφτει στον ίδιο τοίχο.
 *
 * ## 🔴 ΑΡΝΗΣΗ, ΟΧΙ ΕΞΑΙΡΕΣΗ (ADR-767 handoff §5 #7)
 * Δεμένο κελί που δεν γράφεται είναι **φυσιολογική κατάσταση**, όχι σφάλμα. Η άρνηση
 * εκφράζεται με το ίδιο `null` που σημαίνει ήδη «τίποτα δεν άλλαξε» — δηλαδή **καμία νέα
 * σημασιολογία** και, το κρίσιμο, **κανένα βήμα undo**.
 *
 * ## Και η παράκαμψη ΓΡΑΦΕΤΑΙ (Δ2)
 * Μόλις ο άνθρωπος ξεκλειδώσει ρητά, το κελί ξαναγίνεται γράψιμο — ο δεσμός επιβιώνει, δεν
 * ξανακλειδώνει. Αν αυτό το test πέσει, ο φρουρός έγινε φυλακή.
 *
 * @see bim/table/binding/table-binding-state.ts — `isBoundCellWritable`, η κρίση
 * @see bim/table/table-cell-edit-session.ts — ο φρουρός
 */

import {
  buildTableCellEditCommand,
  resolveTableCellEditTargetById,
} from '../table-cell-edit-session';
import { createTableModel, toPersistedTableModel } from '../table-model-helpers';
import { BUILTIN_TABLE_STYLE_IDS } from '../table-style-presets';
import { useDrawingScaleStore } from '../../../state/drawing-scale-store';
import { createMockSceneManager } from '../../../core/commands/__tests__/mock-scene-manager';
import type { TableCell, TableColumn, TableRow } from '../../../types/table';
import type { TableEntity } from '../../../types/table-entity';
import { tableWorksheetFields } from './make-table-entity';
import { activeTableModel } from '../table-worksheet-resolve';

beforeEach(() => {
  useDrawingScaleStore.setState({ drawingScale: 1 });
});

const COLUMNS: TableColumn[] = [
  { id: 'c1', sizing: { kind: 'fixed', widthMm: 40 }, valueType: 'text', align: 'left', sourceKey: 'index' },
  { id: 'c2', sizing: { kind: 'fixed', widthMm: 20 }, valueType: 'text', align: 'left' },
];
const ROWS: TableRow[] = [
  { id: 'r1', rowClass: 'header', heightMm: 8 },
  { id: 'r2', rowClass: 'data', heightMm: 8 },
];

/** Δεμένο κελί **χωρίς** παράκαμψη: read-only εξ ορισμού. */
const BOUND: TableCell = { kind: 'text', value: 'Κ1', bound: { sourceValue: 'Κ1' } };
/** Ο άνθρωπος ξεκλείδωσε ρητά και έγραψε — ο δεσμός επιβιώνει, το κελί γράφεται. */
const OVERRIDDEN: TableCell = { kind: 'text', value: 'Κ9', bound: { sourceValue: 'Κ1', overridden: true } };
/** Η πηγή κουνήθηκε κάτω από τη διαφωνία: ο άνθρωπος **οφείλει** να μπορεί να απαντήσει. */
const CONFLICT: TableCell = {
  kind: 'text',
  value: 'Κ9',
  bound: { sourceValue: 'Κ2', overridden: true, conflict: true },
};
const FREE: TableCell = { kind: 'text', value: 'γωνία' };

function entityWith(cells: [string, string, TableCell][]): TableEntity {
  return {
    id: 'tbl_1',
    type: 'table',
    layerId: 'lyr_test',
    position: { x: 100, y: 200 },
    angleRad: 0,
    styleId: BUILTIN_TABLE_STYLE_IDS.STANDARD,
    ...tableWorksheetFields(toPersistedTableModel(createTableModel({ columns: COLUMNS, rows: ROWS, cells }))),
  };
}

// ─── 1. Ο στόχος το ΔΗΛΩΝΕΙ ───────────────────────────────────────────────────

describe('resolveTableCellEditTargetById — ο στόχος κουβαλά το read-only', () => {
  it('🔴 ΔΕΜΕΝΟ ΚΕΛΙ ⇒ `readOnly: true` — ο επεξεργαστής ανοίγει κλειδωμένος', () => {
    const target = resolveTableCellEditTargetById(entityWith([['r2', 'c1', BOUND]]), 'r2', 'c1');

    expect(target?.readOnly).toBe(true);
  });

  it('παρακαμμένο κελί ⇒ `readOnly: false` — το ξεκλείδωμα ΔΕΝ ξανακλειδώνει (Δ2)', () => {
    const target = resolveTableCellEditTargetById(entityWith([['r2', 'c1', OVERRIDDEN]]), 'r2', 'c1');

    expect(target?.readOnly).toBe(false);
  });

  it('κελί σε σύγκρουση ⇒ γράψιμο: ο άνθρωπος πρέπει να μπορεί να αποφασίσει', () => {
    const target = resolveTableCellEditTargetById(entityWith([['r2', 'c1', CONFLICT]]), 'r2', 'c1');

    expect(target?.readOnly).toBe(false);
  });

  it('ελεύθερο κελί ⇒ `readOnly: false`, όπως πάντα', () => {
    const target = resolveTableCellEditTargetById(entityWith([['r2', 'c2', FREE]]), 'r2', 'c2');

    expect(target?.readOnly).toBe(false);
  });

  it('🔴 ΚΕΝΟ ΚΕΛΙ ΣΕ ΔΕΜΕΝΗ ΣΤΗΛΗ ΓΡΑΦΕΤΑΙ — ο δεσμός ζει στο ΚΕΛΙ, όχι στη στήλη', () => {
    // Η στήλη `c1` έχει `sourceKey`, αλλά αυτό το κελί δεν έχει ακόμη επιλυθεί ποτέ
    // (`bound === undefined`). Κλειδώνοντάς το, ένας δεμένος πίνακας που δεν ανανεώθηκε
    // ποτέ θα ήταν ολόκληρος **άγραφος** — δηλαδή ο δεσμός θα κλείδωνε κελιά που δεν
    // τρέφει κανείς.
    const target = resolveTableCellEditTargetById(entityWith([]), 'r2', 'c1');

    expect(target?.readOnly).toBe(false);
  });
});

// ─── 2. Ο γραφέας το ΕΠΙΒΑΛΛΕΙ ────────────────────────────────────────────────

describe('buildTableCellEditCommand — ο φρουρός, ανεξάρτητα από το ποιος καλεί', () => {
  it('🔴 ΓΡΑΦΗ ΣΕ ΔΕΜΕΝΟ ΚΕΛΙ ⇒ `null`: καμία εντολή, κανένα βήμα undo', () => {
    const entity = entityWith([['r2', 'c1', BOUND]]);

    const command = buildTableCellEditCommand(entity, 'r2', 'c1', 'ΧΕΙΡΟΚΙΝΗΤΟ', createMockSceneManager());

    expect(command).toBeNull();
  });

  it('🔴 ΑΡΝΗΣΗ, ΟΧΙ ΕΞΑΙΡΕΣΗ — read-only είναι κατάσταση, όχι σφάλμα', () => {
    const entity = entityWith([['r2', 'c1', BOUND]]);

    expect(() =>
      buildTableCellEditCommand(entity, 'r2', 'c1', 'ΧΕΙΡΟΚΙΝΗΤΟ', createMockSceneManager()),
    ).not.toThrow();
  });

  it('🔴 ΤΟ ΜΟΝΤΕΛΟ ΔΕΝ ΑΓΓΙΖΕΤΑΙ ΚΑΝ — η άρνηση προηγείται της γραφής', () => {
    const entity = entityWith([['r2', 'c1', BOUND]]);
    const before = activeTableModel(entity);

    buildTableCellEditCommand(entity, 'r2', 'c1', 'ΧΕΙΡΟΚΙΝΗΤΟ', createMockSceneManager());

    expect(activeTableModel(entity)).toBe(before);
  });

  it('παρακαμμένο κελί γράφεται κανονικά — ο δεσμός δεν είναι φυλακή (Δ2)', () => {
    const entity = entityWith([['r2', 'c1', OVERRIDDEN]]);

    const command = buildTableCellEditCommand(entity, 'r2', 'c1', 'Κ42', createMockSceneManager());

    expect(command).not.toBeNull();
  });

  it('κελί σε σύγκρουση γράφεται — αλλιώς η σύγκρουση δεν λύνεται ποτέ', () => {
    const entity = entityWith([['r2', 'c1', CONFLICT]]);

    const command = buildTableCellEditCommand(entity, 'r2', 'c1', 'Κ42', createMockSceneManager());

    expect(command).not.toBeNull();
  });

  it('ελεύθερο κελί γράφεται όπως πάντα — καμία παλινδρόμηση στη συνηθισμένη διαδρομή', () => {
    const entity = entityWith([['r2', 'c2', FREE]]);

    const command = buildTableCellEditCommand(entity, 'r2', 'c2', 'άλλο', createMockSceneManager());

    expect(command).not.toBeNull();
  });

  it('η ΥΠΑΡΧΟΥΣΑ εγγύηση «ίδιο κείμενο ⇒ null» επιβιώνει άθικτη', () => {
    const entity = entityWith([['r2', 'c2', FREE]]);

    expect(
      buildTableCellEditCommand(entity, 'r2', 'c2', 'γωνία', createMockSceneManager()),
    ).toBeNull();
  });
});
