/**
 * 🔴 ADR-739 §46 — **ΤΟ ΔΙΠΛΟ ΚΛΙΚ ΕΙΝΑΙ ΔΥΟ ΧΕΙΡΟΝΟΜΙΕΣ, ΟΧΙ ΜΙΑ.**
 *
 * ## Το ζητούμενο, όπως το διατύπωσε ο ιδιοκτήτης (2026-08-05, με στιγμιότυπο)
 * «Θέλω όταν κάνω διπλό κλικ πάνω σε έναν πίνακα να μπαίνω σε edit mode, αλλά **να μην
 * μπαίνει ταυτόχρονα** και σε edit mode κελιού.» Στο στιγμιότυπο: ο πίνακας μόλις άνοιξε και
 * το `C1` έχει ήδη κέρσορα μέσα του — ο χρήστης γράφει πριν προλάβει να δει πού είναι.
 *
 * ## Γιατί αυτά τα tests και όχι tests του store
 * Το store έκανε πάντα ό,τι του ζητούσαν· λάθος ήταν **ποιος** του ζητούσε τι. Άρα η
 * ερώτηση εδώ είναι «**τι έγραψε το ΠΡΑΓΜΑΤΙΚΟ `handleDoubleClick`**», με πραγματική
 * γεωμετρία και πραγματικό δρομέα — καμία προσομοίωση της απόφασης που ελέγχεται.
 *
 * ## Η αρνητική απόδειξη είναι το μισό αρχείο
 * Ένα test που έλεγχε μόνο «η είσοδος δίνει `nav`» θα ήταν πράσινο και σε υλοποίηση που
 * **κατάργησε** το άνοιγμα κελιού με το ποντίκι — δηλαδή θα κλείδωνε μια απώλεια. Γι' αυτό
 * ελέγχεται και ο δεύτερος δρόμος: μέσα στη λειτουργία, το διπλό κλικ **εξακολουθεί** να
 * ανοίγει το κελί με κέρσορα στο γράμμα (Excel).
 *
 * @see ui/table-cell-editor/useTableCellDoubleClickEditor.ts — η απόφαση, με το σκεπτικό της
 * @see ui/table-cell-editor/use-table-mode-entry.ts — οι είσοδοι **χωρίς** σημείο (Enter/F2)
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react';

// Ο οδηγός αποκτά ενέργειες περιοχής που ενημερώνουν τον χρήστη (`useNotifications`)· ο
// provider πετά εκτός δέντρου. Άπραγο mock — αυτή η σουίτα μετρά **τον δρομέα**.
jest.mock('@/providers/NotificationProvider', () => ({
  useNotifications: () => ({
    success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn(),
    notify: jest.fn(), loading: jest.fn(), showConfirmDialog: jest.fn(),
  }),
}));

import { useTableCellDoubleClickEditor } from '../useTableCellDoubleClickEditor';
import { TABLE_TEST_VIEW, tableCellScreenPoint } from './table-screen-point';
import {
  getTableCellCursor,
  setTableCellCursor,
  __resetTableCellCursorStoreForTests,
} from '../../../state/table-cell-cursor-store';
import { tableCursorAt } from '../../../bim/table/table-cell-navigation';
import { createTableModel, toPersistedTableModel } from '../../../bim/table/table-model-helpers';
import { BUILTIN_TABLE_STYLE_IDS } from '../../../bim/table/table-style-presets';
import { useDrawingScaleStore } from '../../../state/drawing-scale-store';
import type { TableCell, TableColumn, TableRow } from '../../../types/table';
import type { TableEntity } from '../../../types/table-entity';
import type { Point2D, ViewTransform } from '../../../rendering/types/Types';
import { setTableCellCursorById } from '../../../bim/table/__tests__/make-table-entity';

const { transform: TRANSFORM, viewport: VIEWPORT } = TABLE_TEST_VIEW;

// ── Fixture ───────────────────────────────────────────────────────────────────────
// Δύο στήλες × δύο γραμμές, **με κείμενο**: χωρίς κείμενο ο κλάδος «άνοιγμα κελιού» θα
// έδινε `caretIndex === undefined` για λόγο άσχετο με αυτό που ελέγχεται (κενό κελί ⇒
// κέρσορας στο τέλος, εξ ορισμού).

const COLUMNS: TableColumn[] = [
  { id: 'c1', sizing: { kind: 'fixed', widthMm: 40 }, valueType: 'text', align: 'left' },
  { id: 'c2', sizing: { kind: 'fixed', widthMm: 40 }, valueType: 'text', align: 'left' },
];
const ROWS: TableRow[] = [
  { id: 'r1', rowClass: 'header', heightMm: 8 },
  { id: 'r2', rowClass: 'data', heightMm: 8 },
];
const textCell = (value: string): TableCell => ({ kind: 'text', value });

const ENTITY: TableEntity = {
  id: 'tbl_dblclick',
  type: 'table',
  layerId: 'lyr_test',
  position: { x: 100, y: 200 },
  angleRad: 0,
  styleId: BUILTIN_TABLE_STYLE_IDS.STANDARD,
  model: toPersistedTableModel(
    createTableModel({
      columns: COLUMNS,
      rows: ROWS,
      cells: [
        ['r1', 'c1', textCell('ΠΕΡΙΓΡΑΦΗ')],
        ['r1', 'c2', textCell('ΜΟΝΑΔΑ')],
        ['r2', 'c1', textCell('Σκυρόδεμα')],
        ['r2', 'c2', textCell('m3')],
      ],
    }),
  ),
};

/** Ο ελάχιστος πιστός `levelManager`: μία σκηνή, μία οντότητα, καμία εγγραφή. */
const LEVEL_MANAGER = {
  currentLevelId: 'lvl_1',
  getLevelScene: () => ({ entities: [ENTITY] }),
  setLevelScene: () => undefined,
};

function renderEditor(selected: readonly string[] = [ENTITY.id]) {
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

/**
 * Το διπλό κλικ, όπως το βλέπει ο χειριστής: μόνο `clientX`/`clientY` διαβάζονται. Το
 * σημείο **παράγεται από τη γεωμετρία** (`tableCellScreenPoint`) — ποτέ σταθερά οθόνης, για
 * τον λόγο που τεκμηριώνει η κεφαλίδα του `table-screen-point`.
 */
function doubleClickAt(
  view: ReturnType<typeof renderEditor>,
  point: Point2D,
): void {
  act(() => {
    view.result.current.handleDoubleClick(
      { clientX: point.x, clientY: point.y } as React.MouseEvent<HTMLDivElement>,
    );
  });
}

beforeEach(() => {
  useDrawingScaleStore.setState({ drawingScale: 1 });
  __resetTableCellCursorStoreForTests();
});

afterEach(() => {
  __resetTableCellCursorStoreForTests();
});

describe('🔴 ADR-739 §46 — ΕΙΣΟΔΟΣ: το διπλό κλικ ανοίγει τη λειτουργία, ΟΧΙ το κελί', () => {
  it('ΒΑΣΗ — πριν το κλικ δεν υπάρχει δρομέας', () => {
    // Χωρίς αυτό, ένα «πάντα nav» θα ήταν πράσινο σε όλα τα υπόλοιπα.
    renderEditor();
    expect(getTableCellCursor()).toBeNull();
  });

  it('🔴 ΤΟ ΖΗΤΟΥΜΕΝΟ — διπλό κλικ σε κελί ⇒ κατάσταση `nav`, ΚΑΝΕΝΑ πρόχειρο', () => {
    const view = renderEditor();
    doubleClickAt(view, tableCellScreenPoint(ENTITY, 1, 0));

    const cursor = getTableCellCursor();
    expect(cursor).not.toBeNull();
    // `nav` = «είμαι μέσα στον πίνακα, δεν γράφω». Το κενό πρόχειρο **είναι** μέρος του
    // ζητουμένου: με πρόχειρο, το `handleCommit` δεν σιωπά πια και ένα Tab θα έγραφε.
    expect(cursor).toMatchObject({ entityId: ENTITY.id, mode: 'nav', draft: '' });
    expect(cursor?.caretIndex).toBeUndefined();
  });

  it('ο δρομέας πάει στο κελί που ΕΔΕΙΞΕΣ — όχι στο πρώτο κελί (διαφορά από το `Enter`)', () => {
    // Αυτή είναι η μία πληροφορία που έχει το ποντίκι και δεν έχει το πληκτρολόγιο. Μια
    // υλοποίηση που έλυνε το ζητούμενο δρομολογώντας στο `enterTableMode('nav')` θα έχανε
    // ακριβώς αυτήν, και θα ήταν πράσινη σε κάθε άλλο test αυτού του αρχείου.
    const view = renderEditor();
    doubleClickAt(view, tableCellScreenPoint(ENTITY, 1, 1));

    expect(getTableCellCursor()?.position).toMatchObject({ rowId: 'r2', colId: 'c2' });
  });

  it('διπλό κλικ ΕΞΩ από το πλέγμα δεν γεννά δρομέα', () => {
    const view = renderEditor();
    doubleClickAt(view, { x: VIEWPORT.width - 1, y: VIEWPORT.height - 1 });
    expect(getTableCellCursor()).toBeNull();
  });

  it('χωρίς επιλεγμένο πίνακα δεν συμβαίνει τίποτα', () => {
    const view = renderEditor([]);
    doubleClickAt(view, tableCellScreenPoint(ENTITY, 0, 0));
    expect(getTableCellCursor()).toBeNull();
  });
});

describe('🔴 ADR-739 §46 — ΑΡΝΗΤΙΚΗ ΑΠΟΔΕΙΞΗ: μέσα στη λειτουργία, το κελί ΑΝΟΙΓΕΙ', () => {
  it('🔴 δεύτερο διπλό κλικ ⇒ `edit` με το δεσμευμένο κείμενο ως πρόχειρο', () => {
    // Η δυνατότητα «κέρσορας εκεί που έδειξες» δεν καταργήθηκε — μετακινήθηκε στη
    // χειρονομία όπου έχει νόημα. Χωρίς αυτό το test, η §46 θα μπορούσε να «λυθεί»
    // σβήνοντας τον κλάδο, και το `caretIndexOfClick` θα γινόταν νεκρός κώδικας.
    const view = renderEditor();
    const point = tableCellScreenPoint(ENTITY, 1, 0);

    doubleClickAt(view, point);
    expect(getTableCellCursor()?.mode).toBe('nav');

    doubleClickAt(view, point);
    expect(getTableCellCursor()).toMatchObject({
      entityId: ENTITY.id,
      mode: 'edit',
      draft: 'Σκυρόδεμα',
    });
  });

  it('🔴 το `caretRevision` ΑΥΞΑΝΕΤΑΙ στο άνοιγμα κελιού — αλλιώς ο κέρσορας δεν πάει ποτέ', () => {
    // ADR-754 §4: ο δείκτης είναι **θέση**, το `caretRevision` είναι **εντολή**. Στο άνοιγμα
    // κελιού το `<textarea>` ζει ήδη (ίδιο React `key` ⇒ κανένα remount), οπότε χωρίς αύξηση
    // το `useLayoutEffect` δεν ξανατρέχει και ο δείκτης μένει διακοσμητικός. Το test κοιτά
    // τον αριθμό ακριβώς επειδή το σφάλμα θα ήταν **αόρατο** σε κάθε έλεγχο κατάστασης.
    const view = renderEditor();
    const point = tableCellScreenPoint(ENTITY, 1, 0);

    doubleClickAt(view, point);
    const beforeOpen = getTableCellCursor()?.caretRevision ?? -1;

    doubleClickAt(view, point);
    const cursor = getTableCellCursor();
    expect(cursor?.caretIndex).toBeDefined();
    expect(cursor?.caretRevision).toBe(beforeOpen + 1);
  });

  it('η ΕΙΣΟΔΟΣ ΔΕΝ αυξάνει το `caretRevision` — δεν τοποθέτησε κανέναν κέρσορα', () => {
    // Το δίδυμο του προηγούμενου: αν η είσοδος αύξανε κι αυτή, ο αριθμός θα έπαυε να
    // σημαίνει «ο κώδικας τοποθέτησε κέρσορα» και θα γινόταν μετρητής κλικ.
    const view = renderEditor();
    act(() => { setTableCellCursorById('tbl_other', tableCursorAt('r1', 'c1'), 'nav'); });
    const before = getTableCellCursor()?.caretRevision ?? -1;

    doubleClickAt(view, tableCellScreenPoint(ENTITY, 1, 0));
    expect(getTableCellCursor()?.entityId).toBe(ENTITY.id);
    expect(getTableCellCursor()?.caretRevision).toBe(before);
  });

  it('δρομέας σε ΑΛΛΟΝ πίνακα ⇒ το διπλό κλικ είναι πάλι ΕΙΣΟΔΟΣ, όχι άνοιγμα κελιού', () => {
    // Το κριτήριο είναι «μέσα σε **αυτόν** τον πίνακα», όχι «υπάρχει δρομέας κάπου». Με το
    // δεύτερο, ένα διπλό κλικ σε δεύτερο πίνακα θα άνοιγε κατευθείαν κελί.
    const view = renderEditor();
    act(() => { setTableCellCursorById('tbl_other', tableCursorAt('r1', 'c1'), 'edit', 'ξένο'); });

    doubleClickAt(view, tableCellScreenPoint(ENTITY, 1, 0));
    expect(getTableCellCursor()).toMatchObject({ entityId: ENTITY.id, mode: 'nav', draft: '' });
  });
});
