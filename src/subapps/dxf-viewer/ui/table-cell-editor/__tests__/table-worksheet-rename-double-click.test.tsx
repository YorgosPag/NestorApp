/**
 * 🔴 ADR-833 Φάση 4 — **Η ΔΕΥΤΕΡΗ ΔΙΑΔΡΟΜΗ ΠΡΟΣ ΤΗ ΜΕΤΟΝΟΜΑΣΙΑ: ΤΟ ΔΙΠΛΟ ΚΛΙΚ ΣΤΗΝ ΚΑΡΤΕΛΑ.**
 *
 * ## Γιατί υπάρχει αυτό το αρχείο
 * Το σύμπτωμα #1 της Φάσης 4 έλεγε ρητά *«ούτε από το μενού, ούτε από το διπλό κλικ»*. Η
 * διόρθωση του §5.4.11 αγγίζει **μόνο** τη διαδρομή του μενού (παγίδα εστίασης του Radix) — το
 * διπλό κλικ κάνει **δικό του** hit-test και καλεί κατευθείαν το `openWorksheetRename`, χωρίς
 * κανένα μενού στη μέση. Δηλαδή η δεύτερη διαδρομή **δεν επαληθεύτηκε από τίποτα**:
 * το `table-double-click-entry.test.tsx` έχει **9** δοκιμασίες και **καμία** για τη λωρίδα.
 *
 * 🔑 «Λογικά δεν θα είχε το πρόβλημα» είναι ακριβώς το είδος υπόθεσης που αυτή η φάση απέδειξε
 * επικίνδυνο: η κύρια υπόθεση του handoff ήταν επίσης αληθοφανής και ήταν **λάθος** (§5.4.11).
 *
 * ## Τι κλειδώνει
 * Τη **χειρονομία ως χειρονομία**: διπλό κλικ σε καρτέλα ⇒ ανοίγει η μετονομασία **εκείνης**
 * της καρτέλας· διπλό κλικ στο ⊕ ⇒ **τίποτα** (το ⊕ δεν έχει όνομα, και ένα δεύτερο πάτημα θα
 * έφτιαχνε φύλλο που κανείς δεν ζήτησε συνειδητά — δες `table-double-click-gesture.ts`).
 *
 * Το σημείο οθόνης **παράγεται από την ίδια διάταξη** που ζωγραφίζει ο καμβάς
 * (`tableWorksheetStripScreenPoint`), ποτέ από σταθερά: ένα test με δική του μηχανή προβολής
 * μπορεί να συμφωνήσει με τον εαυτό του πάνω σε λάθος γεωμετρία.
 *
 * @see ../table-double-click-gesture.ts — η χειρονομία (και η σειρά των ερμηνειών)
 * @see ./table-worksheet-rename-session.test.tsx — η ΠΡΩΤΗ διαδρομή (μενού) και η αιτία της
 */

import React from 'react';
import { act, renderHook } from '@testing-library/react';

jest.mock('@/providers/NotificationProvider', () => ({
  useNotifications: () => ({
    success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn(),
    notify: jest.fn(), loading: jest.fn(), showConfirmDialog: jest.fn(),
  }),
}));

import { useTableCellDoubleClickEditor } from '../useTableCellDoubleClickEditor';
import { tableWorksheetStripScreenPoint, type TableTestView } from './table-screen-point';
import {
  __resetTableWorksheetRenameForTests,
  getTableWorksheetRename,
} from '../../../state/table-worksheet-rename-store';
import { __resetTableCellCursorStoreForTests } from '../../../state/table-cell-cursor-store';
import { buildTableEntity } from '../../../bim/table/build-table-entity';
import { tableWorksheetId } from '../../../types/table-worksheet';
import { useDrawingScaleStore } from '../../../state/drawing-scale-store';
import type { TableEntity } from '../../../types/table-entity';
import type { Point2D, ViewTransform } from '../../../rendering/types/Types';

/**
 * ⚠️ **ΟΧΙ το `TABLE_TEST_VIEW`.** Στην προεπιλεγμένη κλίμακα (1:1) το `tableWorksheetTabStrip`
 * περνά την **πρώτη** του πύλη αρνητικά — ο πίνακας είναι πολύ μικρός για να φορέσει χρώμιο
 * (`isTableIndicatorVisible`) — και επιστρέφει **κενή λωρίδα**. Ένα test που στόχευε εκεί θα
 * μετρούσε «δεν άνοιξε μετονομασία» για λόγο **άσχετο** με αυτό που ελέγχει.
 *
 * Η τιμή είναι η ίδια που χρησιμοποιεί ήδη το `table-worksheet-strip-chain.test.ts` — και ο
 * πρώτος έλεγχος παρακάτω **επιβεβαιώνει** ότι το δείγμα έχει όντως καρτέλες και ⊕.
 */
const VIEW: TableTestView = {
  transform: { scale: 40, offsetX: 0, offsetY: 0 },
  viewport: { width: 1600, height: 1200 },
};
const { viewport: VIEWPORT, transform: TRANSFORM } = VIEW;

const ENTITY_ID = 'tbl_dblclick_ws';
const SECOND_SHEET = tableWorksheetId('ws_second');

/** Δύο φύλλα: με ένα, η λωρίδα δεν έχει δεύτερη καρτέλα να στοχευθεί. */
function twoSheetTable(): TableEntity {
  const base = buildTableEntity({ x: 0, y: 0 }, { columnCount: 3 }, ENTITY_ID, 'lyr_test');
  return {
    ...base,
    worksheets: [base.worksheets[0], { id: SECOND_SHEET, model: base.worksheets[0].model }],
  };
}

const ENTITY = twoSheetTable();

const LEVEL_MANAGER = {
  currentLevelId: 'lvl_1',
  getLevelScene: () => ({ entities: [ENTITY] }),
  setLevelScene: () => undefined,
};

function renderEditor(selected: readonly string[] = [ENTITY_ID]) {
  const container = document.createElement('div');
  container.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: VIEWPORT.width, height: VIEWPORT.height }) as DOMRect;

  return renderHook(() =>
    useTableCellDoubleClickEditor({
      transformRef: { current: TRANSFORM } as React.RefObject<ViewTransform>,
      containerRef: { current: container },
      getSelectedEntityIds: () => selected,
      levelManager: LEVEL_MANAGER as never,
    }),
  );
}

function doubleClickAt(view: ReturnType<typeof renderEditor>, point: Point2D): void {
  act(() => {
    view.result.current.handleDoubleClick(
      { clientX: point.x, clientY: point.y } as React.MouseEvent<HTMLDivElement>,
    );
  });
}

/** Το κέντρο μιας καρτέλας, από τη διάταξη που ζωγραφίζεται — ποτέ σταθερά. */
function tabPoint(seat: number): Point2D {
  const point = tableWorksheetStripScreenPoint(ENTITY, { kind: 'tab', seat }, VIEW);
  if (!point) throw new Error(`Η λωρίδα δεν έχει καρτέλα στη θέση ${seat}`);
  return point;
}

beforeEach(() => {
  useDrawingScaleStore.setState({ drawingScale: 1 });
  __resetTableWorksheetRenameForTests();
  __resetTableCellCursorStoreForTests();
});

afterEach(() => {
  __resetTableWorksheetRenameForTests();
  __resetTableCellCursorStoreForTests();
});

describe('🔴 ADR-833 Φ4 — ΤΟ ΔΙΠΛΟ ΚΛΙΚ ΣΤΗΝ ΚΑΡΤΕΛΑ ΑΝΟΙΓΕΙ ΤΗ ΜΕΤΟΝΟΜΑΣΙΑ', () => {
  it('ΒΑΣΗ — πριν από τη χειρονομία δεν υπάρχει ανοιχτή μετονομασία', () => {
    // Χωρίς αυτό, ένα «πάντα ανοιχτό» θα ήταν πράσινο σε όλα τα υπόλοιπα.
    renderEditor();
    expect(getTableWorksheetRename()).toBeNull();
  });

  it('ΒΑΣΗ — το δείγμα ΕΧΕΙ δύο καρτέλες και ⊕ σε αυτή την κλίμακα', () => {
    // Αλλιώς κάθε «δεν άνοιξε» παρακάτω θα ήταν πράσινο επειδή **δεν υπήρχε τι να πατηθεί**.
    expect(tableWorksheetStripScreenPoint(ENTITY, { kind: 'tab', seat: 1 }, VIEW)).not.toBeNull();
    expect(tableWorksheetStripScreenPoint(ENTITY, { kind: 'add' }, VIEW)).not.toBeNull();
  });

  it('🔑 διπλό κλικ στη ΔΕΥΤΕΡΗ καρτέλα ⇒ ανοίγει η μετονομασία ΕΚΕΙΝΗΣ', () => {
    const view = renderEditor();
    doubleClickAt(view, tabPoint(1));

    expect(getTableWorksheetRename()).toMatchObject({
      entityId: ENTITY_ID,
      worksheetId: SECOND_SHEET,
    });
  });

  it('🔑 …και στην ΠΡΩΤΗ καρτέλα ανοίγει η πρώτη — η θέση δεν είναι διακοσμητική', () => {
    const view = renderEditor();
    doubleClickAt(view, tabPoint(0));

    expect(getTableWorksheetRename()?.worksheetId).toBe(ENTITY.worksheets[0].id);
  });

  it('το ορθογώνιο του πεδίου έχει ΜΕΓΕΘΟΣ — αλλιώς το κουτί ανοίγει αόρατο', () => {
    const view = renderEditor();
    doubleClickAt(view, tabPoint(1));

    const rect = getTableWorksheetRename()?.anchorRect;
    expect(rect?.width).toBeGreaterThan(0);
    expect(rect?.height).toBeGreaterThan(0);
  });

  it('⊕ ΔΕΝ ανοίγει μετονομασία — δεν έχει όνομα, και δεν παίρνει δεύτερη σημασία', () => {
    const view = renderEditor();
    const add = tableWorksheetStripScreenPoint(ENTITY, { kind: 'add' }, VIEW);
    expect(add).not.toBeNull();
    doubleClickAt(view, add!);

    expect(getTableWorksheetRename()).toBeNull();
  });

  it('χωρίς επιλεγμένο πίνακα δεν συμβαίνει τίποτα — η λωρίδα δεν έχει ιδιοκτήτη', () => {
    const view = renderEditor([]);
    doubleClickAt(view, tabPoint(1));

    expect(getTableWorksheetRename()).toBeNull();
  });
});
