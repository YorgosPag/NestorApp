/**
 * ADR-739 Φ.Δ βήμα 4 — οι είσοδοι **χωρίς σημείο**: `Enter` / `F2` / εντολή `TABLEDIT`.
 *
 * 🔴 Το κρίσιμο test εδώ είναι το «`F2` ΔΕΝ σβήνει το κελί». Βρέθηκε **ζωντανά, στον
 * browser** και όχι σε test: με `F2` πάνω στο κελί τίτλου «ΠΙΝΑΚΑΣ» ο επεξεργαστής άνοιγε
 * **κενός**, οπότε το επόμενο `Tab`/`Enter` θα έκανε `commit('')` — **απώλεια δεδομένων από
 * πάτημα πλοήγησης**. Καμία μονάδα δεν το έβλεπε, γιατί κάθε συστατικό ήταν σωστό μόνο του:
 * ο δρομέας δέχεται πρόχειρο, ο επεξεργαστής δεσμεύει το πρόχειρο, και το `F2` **μέσα** στον
 * πίνακα το σπέρνει σωστά. Έλειπε μόνο ο σπόρος στην **είσοδο**.
 *
 * Γι' αυτό το test δεν ελέγχει «άνοιξε ο επεξεργαστής» — ελέγχει **τι κείμενο κρατά**.
 */

import { renderHook, act } from '@testing-library/react';
import { useTableModeEntry } from '../use-table-mode-entry';
import {
  getTableCellCursor,
  setTableCellCursor,
  __resetTableCellCursorStoreForTests,
} from '../../../state/table-cell-cursor-store';
import { tableCursorAt } from '../../../bim/table/table-cell-navigation';
import { createTableModel, toPersistedTableModel } from '../../../bim/table/table-model-helpers';
import { BUILTIN_TABLE_STYLE_IDS } from '../../../bim/table/table-style-presets';
import {
  resolveCommandAction,
  runCommandAction,
  __resetCommandActionRunnersForTests,
} from '../../../systems/command-line/CommandActionRegistry';
import { useDrawingScaleStore } from '../../../state/drawing-scale-store';
import type { TableCell, TableColumn, TableRow } from '../../../types/table';
import type { TableEntity } from '../../../types/table-entity';

const COLUMNS: TableColumn[] = [
  { id: 'c1', sizing: { kind: 'fixed', widthMm: 40 }, valueType: 'text', align: 'left' },
  { id: 'c2', sizing: { kind: 'fixed', widthMm: 20 }, valueType: 'text', align: 'left' },
];
const ROWS: TableRow[] = [
  { id: 'r1', rowClass: 'header', heightMm: 8 },
  { id: 'r2', rowClass: 'data', heightMm: 8 },
];

const text = (value: string): TableCell => ({ kind: 'text', value });

/** Το πρώτο κελί κρατά «ΠΙΝΑΚΑΣ» — ακριβώς το ζωντανό σενάριο που αποκάλυψε το σφάλμα. */
const ENTITY: TableEntity = {
  id: 'tbl_1',
  type: 'table',
  layerId: 'lyr_test',
  position: { x: 0, y: 0 },
  angleRad: 0,
  styleId: BUILTIN_TABLE_STYLE_IDS.STANDARD,
  model: toPersistedTableModel(
    createTableModel({
      columns: COLUMNS,
      rows: ROWS,
      cells: [['r1', 'c1', text('ΠΙΝΑΚΑΣ')], ['r2', 'c1', text('γραμμή')]],
    }),
  ),
};

function render(selected: readonly string[] = [ENTITY.id], entities: readonly TableEntity[] = [ENTITY]) {
  return renderHook(() =>
    useTableModeEntry({
      getSelectedEntityIds: () => selected,
      levelManager: {
        currentLevelId: 'lvl_1',
        getLevelScene: () => ({ entities }),
        setLevelScene: () => undefined,
      } as never,
    }),
  );
}

beforeEach(() => {
  useDrawingScaleStore.setState({ drawingScale: 1 });
  __resetTableCellCursorStoreForTests();
  __resetCommandActionRunnersForTests();
});

describe('είσοδος στη λειτουργία πίνακα χωρίς σημείο', () => {
  it('`Enter` ⇒ πλοήγηση στο πρώτο κελί, ΧΩΡΙΣ πρόχειρο', () => {
    const { result } = render();
    act(() => { expect(result.current.enterTableMode('nav')).toBe(true); });

    const cursor = getTableCellCursor();
    expect(cursor).toMatchObject({ entityId: ENTITY.id, mode: 'nav', draft: '' });
    expect(cursor?.position).toEqual(tableCursorAt('r1', 'c1'));
  });

  it('🔴 `F2` ⇒ επεξεργασία ΜΕ το δεσμευμένο κείμενο — ΔΕΝ σβήνει το κελί', () => {
    const { result } = render();
    act(() => { expect(result.current.enterTableMode('edit')).toBe(true); });

    // Αν αυτό γίνει `''`, το επόμενο Tab γράφει κενό πάνω στον τίτλο.
    expect(getTableCellCursor()).toMatchObject({ mode: 'edit', draft: 'ΠΙΝΑΚΑΣ' });
  });

  it('`F2` σε **κενό** κελί ⇒ κενό πρόχειρο (και όχι σφάλμα)', () => {
    const empty: TableEntity = {
      ...ENTITY,
      model: toPersistedTableModel(createTableModel({ columns: COLUMNS, rows: ROWS })),
    };
    const { result } = render([empty.id], [empty]);
    act(() => { result.current.enterTableMode('edit'); });
    expect(getTableCellCursor()).toMatchObject({ mode: 'edit', draft: '' });
  });

  it('κανένα `caretIndex` — ο κέρσορας πάει στο τέλος (δεν υπάρχει σημείο κλικ)', () => {
    const { result } = render();
    act(() => { result.current.enterTableMode('edit'); });
    expect(getTableCellCursor()?.caretIndex).toBeUndefined();
  });
});

describe('πότε η είσοδος ΔΕΝ ενεργεί', () => {
  it('καμία επιλογή ⇒ false, κανένας δρομέας', () => {
    const { result } = render([]);
    act(() => { expect(result.current.enterTableMode('nav')).toBe(false); });
    expect(getTableCellCursor()).toBeNull();
  });

  it('δύο επιλεγμένες οντότητες ⇒ false (ποιου πίνακα το πληκτρολόγιο;)', () => {
    const { result } = render([ENTITY.id, 'other']);
    act(() => { expect(result.current.enterTableMode('nav')).toBe(false); });
    expect(getTableCellCursor()).toBeNull();
  });

  it('η επιλογή δεν είναι πίνακας ⇒ false', () => {
    const { result } = render(['ent_line'], []);
    act(() => { expect(result.current.enterTableMode('nav')).toBe(false); });
    expect(getTableCellCursor()).toBeNull();
  });

  it('🔴 είσαι ΗΔΗ μέσα ⇒ false — το `Enter` δεν πετά τον δρομέα πίσω στο πρώτο κελί', () => {
    const { result } = render();
    act(() => { setTableCellCursor(ENTITY, tableCursorAt('r2', 'c2'), 'nav'); });
    act(() => { expect(result.current.enterTableMode('nav')).toBe(false); });

    // Η θέση του χρήστη διατηρήθηκε.
    expect(getTableCellCursor()?.position).toEqual(tableCursorAt('r2', 'c2'));
  });
});

describe('η εντολή TABLEDIT', () => {
  it('εγγράφεται όσο ζει το hook και αποδεσμεύεται στο unmount', () => {
    const view = render();
    expect(resolveCommandAction('TABLEDIT')).toBe('table.edit');
    expect(runCommandAction('table.edit')).toBe(true);
    expect(getTableCellCursor()).toMatchObject({ mode: 'nav' });

    view.unmount();
    __resetTableCellCursorStoreForTests();
    expect(runCommandAction('table.edit')).toBe(false);
  });

  it('χωρίς επιλεγμένο πίνακα ⇒ δεν εκτελείται (ώστε να μη γραφτεί στο ιστορικό εντολών)', () => {
    render([]);
    expect(runCommandAction('table.edit')).toBe(false);
  });

  it('μπαίνει σε ΠΛΟΗΓΗΣΗ — η εντολή δεν είπε ποιο κελί (AutoCAD TABLEDIT)', () => {
    render();
    expect(runCommandAction('table.edit')).toBe(true);
    expect(getTableCellCursor()).toMatchObject({ mode: 'nav', draft: '' });
  });
});
