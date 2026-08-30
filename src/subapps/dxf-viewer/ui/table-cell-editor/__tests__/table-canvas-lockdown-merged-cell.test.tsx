/**
 * 🔴 ADR-739 §29.15 — **ΤΟ ΚΛΕΙΔΩΜΑ ΤΟΥ ΠΟΝΤΙΚΙΟΥ ΑΝΗΚΕΙ ΣΤΗ ΣΥΝΕΔΡΙΑ, ΟΧΙ ΣΤΟΝ ΕΠΕΞΕΡΓΑΣΤΗ.**
 *
 * ## Το ελάττωμα, όπως μετρήθηκε ζωντανά (2026-08-03, CDP, `47_ergasia.dxf`)
 * Ο ιδιοκτήτης: «**όταν πατάω στις λωρίδες εμφανίζονται τα window selection**». Η
 * αναπαραγωγή στο παράθυρο δοκιμών, με ανιχνευτή που έδωσε **και τις δύο** απαντήσεις μέσα
 * στην ίδια εκτέλεση (άρα δεν ήταν «καθαρός επειδή δεν μέτρησε τίποτα»):
 *
 * | στιγμή | κλείδωμα | δρομέας | `<textarea>` |
 * |---|---|---|---|
 * | πριν το πάτημα στη λωρίδα `B` | **ON** | `C4` | 1 |
 * | **μετά το `mousedown`** | **OFF** 💥 | `B1` | 0 |
 * | μετά το `mouseup` | OFF ⇒ ο καμβάς ερμηνεύει ⇒ **πλαίσιο** | `B1` | 0 |
 *
 * ## Η αιτιακή αλυσίδα, ολόκληρη
 * 1. `selectWholeAxis` βάζει τον δρομέα στην **αρχή** του άξονα — για τη στήλη `B` αυτό
 *    είναι το `B1` (`table-pointer-axis-selection.ts`, σύμβαση Excel).
 * 2. Ο πίνακας της σκηνής έχει **τίτλο συγχωνευμένο σε όλες τις στήλες** — μετρημένο στο
 *    μοντέλο: `{ anchorRowId:'r0', anchorColId:'c0', colSpan:4 }`. Άρα το `B1` είναι
 *    **καλυμμένο**.
 * 3. `resolveTableCellEditTargetById` → `findCell` → **`undefined` σε καλυμμένο κελί**
 *    (το λέει αυτολεξεί το σχόλιό του) ⇒ `target = null` ⇒ `anchor = null`.
 * 4. ⇒ `overlay === null` ⇒ το `useTableCanvasLockdown({ active: overlay !== null })`
 *    αποπροσαρτά τον φύλακα **μέσα στο ίδιο commit του `mousedown`**.
 * 5. ⇒ το `mouseup` που ακολουθεί βρίσκει `isCanvasLockedByTableSession() === false`,
 *    η τρίτη πύλη του §29.11 τον αφήνει να περάσει, και γεννιέται το `cursor.startSelection()`.
 *
 * 🔑 **Και οι τρεις πύλες ήταν σωστές. Λάθος ήταν η ΕΡΩΤΗΣΗ που τις τροφοδοτούσε.**
 * Το `overlay !== null` ρωτά «**υπάρχει εστιασμένο πεδίο που κατέχει τα πλήκτρα;**» — η
 * σωστή ερώτηση για το **πληκτρολόγιο** (`useModalKeyboardScope`), και το §29 την
 * κληρονόμησε αυτούσια για το ποντίκι επειδή «μία τιμή οδηγεί και τα δύο». Το επιχείρημα
 * ορθότητας ήταν σωστό· η τιμή ήταν λάθος. Για το **ποντίκι** η ερώτηση είναι «**είναι ο
 * χρήστης μέσα στη λειτουργία πίνακα;**», και υπάρχει πραγματική, ορατή κατάσταση όπου οι
 * δύο απαντήσεις **διίστανται**: ο χρήστης βλέπει λωρίδες, βλέπει «Esc για έξοδο», βλέπει
 * επιλεγμένη τη στήλη του — και το ποντίκι δεν είναι κλειδωμένο.
 *
 * Το ίδιο το ADR το είχε γράψει, χωρίς να δει τη συνέπεια: «ο δρομέας χωρίς επεξεργαστή
 * είναι **αδρανής**». Αδρανής για τα **πλήκτρα** — για το **ποντίκι** ζωγραφίζει λωρίδες,
 * δέχεται κλικ και επιλέγει στήλες.
 *
 * ## Γιατί αυτό το test ΚΑΙ ΟΧΙ ένα test της πύλης
 * Το μάθημα του §29.11 («*μια πύλη χωρίς επαληθευμένο καταναλωτή είναι σχόλιο*») εδώ
 * ανεβαίνει ένα επίπεδο: **μια πύλη με σωστό καταναλωτή αλλά λάθος είσοδο είναι επίσης
 * σχόλιο**. Γι' αυτό εδώ μοντάρεται ο **ΠΡΑΓΜΑΤΙΚΟΣ** `useTableCellDoubleClickEditor` και
 * μετριέται το **ΠΡΑΓΜΑΤΙΚΟ** `isCanvasLockedByTableSession()` — καμία διπλή αλήθεια, καμία
 * προσομοίωση της συνθήκης.
 *
 * @see ui/table-cell-editor/use-table-canvas-lockdown.ts — η μία αυθεντία
 * @see ui/table-cell-editor/__tests__/table-mode-keyboard-scope.test.tsx — το δίδυμο του πληκτρολογίου
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react';

// Ο οδηγός αποκτά ενέργειες περιοχής που ενημερώνουν τον χρήστη (`useNotifications`)· ο
// provider πετά εκτός δέντρου. Άπραγο mock — αυτή η σουίτα μετρά **έναν** boolean.
jest.mock('@/providers/NotificationProvider', () => ({
  useNotifications: () => ({
    success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn(),
    notify: jest.fn(), loading: jest.fn(), showConfirmDialog: jest.fn(),
  }),
}));

import { useTableCellDoubleClickEditor } from '../useTableCellDoubleClickEditor';
import {
  isCanvasLockedByTableSession,
  __resetTableCanvasLockdownForTests,
} from '../use-table-canvas-lockdown';
import {
  setTableCellCursor,
  closeTableCellCursor,
  cancelTableCellCursorSession,
  __resetTableCellCursorStoreForTests,
} from '../../../state/table-cell-cursor-store';
import { tableCursorAt } from '../../../bim/table/table-cell-navigation';
import { createTableModel, toPersistedTableModel } from '../../../bim/table/table-model-helpers';
import { BUILTIN_TABLE_STYLE_IDS } from '../../../bim/table/table-style-presets';
import { useDrawingScaleStore } from '../../../state/drawing-scale-store';
import type { CellSpan, TableColumn, TableRow } from '../../../types/table';
import type { TableEntity } from '../../../types/table-entity';
import { tableWorksheetFields } from '../../../bim/table/__tests__/make-table-entity';

// ── Fixture: ΤΟ ΣΧΗΜΑ ΤΟΥ ΠΡΑΓΜΑΤΙΚΟΥ ΠΙΝΑΚΑ ΤΗΣ ΣΚΗΝΗΣ ──────────────────────────
// Τίτλος στη γραμμή 1 συγχωνευμένος σε **όλες** τις στήλες — ακριβώς το
// `{ r0/c0, colSpan: 4 }` που διαβάστηκε ζωντανά από το `47_ergasia.dxf`. Δεν είναι
// εξωτική περίπτωση: **έτσι φτιάχνει ο ίδιος ο builder** τους πίνακες του έργου.

const COLUMNS: TableColumn[] = [
  { id: 'c1', sizing: { kind: 'fixed', widthMm: 30 }, valueType: 'text', align: 'left' },
  { id: 'c2', sizing: { kind: 'fixed', widthMm: 30 }, valueType: 'text', align: 'left' },
];
const ROWS: TableRow[] = [
  { id: 'r1', rowClass: 'header', heightMm: 8 },
  { id: 'r2', rowClass: 'data', heightMm: 8 },
];
/** Η γραμμή 1 είναι **ένας** τίτλος: το `r1/c2` δεν υπάρχει ως αυτόνομο κελί. */
const MERGES: CellSpan[] = [{ anchorRowId: 'r1', anchorColId: 'c1', rowSpan: 1, colSpan: 2 }];

const ENTITY: TableEntity = {
  id: 'tbl_merged',
  type: 'table',
  layerId: 'lyr_test',
  position: { x: 100, y: 200 },
  angleRad: 0,
  styleId: BUILTIN_TABLE_STYLE_IDS.STANDARD,
  ...tableWorksheetFields(toPersistedTableModel(createTableModel({ columns: COLUMNS, rows: ROWS, merges: MERGES }))),
};

function makeLevelManager(entities: readonly TableEntity[]) {
  const state = { entities };
  return {
    manager: {
      currentLevelId: 'lvl_1',
      getLevelScene: () => ({ entities: state.entities }),
      setLevelScene: () => undefined,
    },
    /** Ό,τι κάνει ένα undo / μια διαγραφή / μια αλλαγή επιπέδου, από τη σκοπιά του hook. */
    removeTable: () => { state.entities = []; },
  };
}

function renderEditor(entities: readonly TableEntity[] = [ENTITY]) {
  const level = makeLevelManager(entities);
  const view = renderHook(() =>
    useTableCellDoubleClickEditor({
      transformRef: { current: { scale: 1, offsetX: 0, offsetY: 0 } } as React.RefObject<never>,
      containerRef: { current: null },
      getSelectedEntityIds: () => [ENTITY.id],
      levelManager: level.manager as never,
    }),
  );
  return { ...view, ...level };
}

/** Το ίδιο που κάνει το `selectWholeAxis`: δρομέας στην **αρχή** του άξονα, σε πλοήγηση. */
const putCursorAt = (rowId: string, colId: string, mode: 'nav' | 'edit' = 'nav'): void => {
  act(() => { setTableCellCursor(ENTITY, tableCursorAt(rowId, colId), mode); });
};

beforeEach(() => {
  useDrawingScaleStore.setState({ drawingScale: 1 });
  __resetTableCellCursorStoreForTests();
  __resetTableCanvasLockdownForTests();
});

afterEach(() => {
  __resetTableCellCursorStoreForTests();
  __resetTableCanvasLockdownForTests();
});

describe('🔴 ADR-739 §29.15 — Δ1: το κλείδωμα επιβιώνει σε καλυμμένο κελί συγχώνευσης', () => {
  it('ΒΑΣΗ — χωρίς δρομέα ο καμβάς ΔΕΝ είναι κλειδωμένος', () => {
    // Χωρίς αυτό, ένα «κλείδωσε πάντα» θα ήταν πράσινο σε όλα τα υπόλοιπα.
    renderEditor();
    expect(isCanvasLockedByTableSession()).toBe(false);
  });

  it('ΕΛΕΓΚΤΗΣ Α — δρομέας στην ΑΓΚΥΡΑ της συγχώνευσης (r1/c1): κλειδωμένο', () => {
    // Εδώ το κελί αγκυρώνεται κανονικά, άρα ζει και ο επεξεργαστής. Περνούσε και πριν —
    // και γι' αυτό ακριβώς το ελάττωμα έμεινε αόρατο: η στήλη **A** δούλευε σωστά.
    renderEditor();
    putCursorAt('r1', 'c1');
    expect(isCanvasLockedByTableSession()).toBe(true);
  });

  it('🔴 ΕΛΕΓΚΤΗΣ Β — δρομέας σε ΚΑΛΥΜΜΕΝΟ κελί (r1/c2): ΠΡΕΠΕΙ να μείνει κλειδωμένο', () => {
    // ΙΔΙΑ χειρονομία, ΙΔΙΑ λωρίδα, ΔΙΠΛΑΝΗ στήλη. Η μόνη διαφορά από τον ελεγκτή Α είναι
    // ότι αυτό το κελί δεν έχει δικό του ορθογώνιο — ο χρήστης όμως είναι εξίσου **μέσα**
    // στη λειτουργία. Αυτή η γραμμή είναι το Δ1, ολόκληρο.
    renderEditor();
    putCursorAt('r1', 'c2');
    expect(isCanvasLockedByTableSession()).toBe(true);
  });

  it('🔴 ΕΛΕΓΚΤΗΣ Β — και σε κατάσταση ΓΡΑΦΗΣ πάνω σε καλυμμένο κελί', () => {
    // Το `mode` δεν είναι ο κριτής της ιδιοκτησίας του ποντικιού: αν ήταν, θα ξανακάναμε
    // το ίδιο λάθος σε δεύτερο άξονα.
    renderEditor();
    putCursorAt('r1', 'c2', 'edit');
    expect(isCanvasLockedByTableSession()).toBe(true);
  });

  it('κανονικό κελί εκτός συγχώνευσης (r2/c2): κλειδωμένο', () => {
    renderEditor();
    putCursorAt('r2', 'c2');
    expect(isCanvasLockedByTableSession()).toBe(true);
  });
});

describe('🔴 ADR-739 §29.15 — ΟΙ ΕΓΓΥΗΣΕΙΣ ΑΠΕΛΕΥΘΕΡΩΣΗΣ ΠΟΥ ΔΕΝ ΕΠΙΤΡΕΠΕΤΑΙ ΝΑ ΧΑΘΟΥΝ', () => {
  // Αυτά τα τρία είναι ο **λόγος** που το §29 διάλεξε το `overlay !== null`: ο φόβος του
  // «κλειδωμένο χωρίς κανέναν να ακούει» (§5.1 — ο viewer είχε μια φορά κλειδώσει «μέχρι
  // reload»). Ο φόβος ήταν βάσιμος. Η νέα συνθήκη οφείλει να τον καλύπτει **ολόκληρο** —
  // αλλιώς ανταλλάσσουμε ένα ορατό ελάττωμα με ένα αόρατο.

  it('ΔΡΟΜΟΣ 1 — `closeTableCellCursor` (Esc #2 / κλικ έξω) ξεκλειδώνει', () => {
    const view = renderEditor();
    putCursorAt('r1', 'c2');
    expect(isCanvasLockedByTableSession()).toBe(true);
    act(() => { closeTableCellCursor(); view.rerender(); });
    expect(isCanvasLockedByTableSession()).toBe(false);
  });

  it('🔴 ΔΡΟΜΟΣ 2/4 — ο πίνακας εξαφανίζεται ΚΑΤΩ από τον δρομέα (undo/διαγραφή/επίπεδο)', () => {
    // Ο δρομέας ΔΕΝ αγγίζεται· φεύγει μόνο η οντότητα. Αυτό είναι ακριβώς το σενάριο που
    // ένα σκέτο `cursor !== null` θα άφηνε κλειδωμένο για πάντα.
    const view = renderEditor();
    putCursorAt('r1', 'c2');
    expect(isCanvasLockedByTableSession()).toBe(true);
    act(() => { view.removeTable(); view.rerender(); });
    expect(isCanvasLockedByTableSession()).toBe(false);
  });

  it('ΔΡΟΜΟΣ 3 — unmount ενώ ο χρήστης είναι ΜΕΣΑ στον πίνακα', () => {
    const view = renderEditor();
    putCursorAt('r1', 'c2');
    expect(isCanvasLockedByTableSession()).toBe(true);
    act(() => { view.unmount(); });
    expect(isCanvasLockedByTableSession()).toBe(false);
  });

  it('🔴 ΑΡΝΗΤΙΚΗ ΑΠΟΔΕΙΞΗ — το `Esc` #1 ακυρώνει τη ΓΡΑΦΗ και ΔΕΝ ξεκλειδώνει', () => {
    // Ένα test που έλεγχε μόνο «ξεκλειδώνει» θα περνούσε και από υλοποίηση που πετά τον
    // χρήστη έξω στο πρώτο Esc.
    const view = renderEditor();
    putCursorAt('r1', 'c1', 'edit');
    expect(isCanvasLockedByTableSession()).toBe(true);
    act(() => { cancelTableCellCursorSession(); view.rerender(); });
    expect(isCanvasLockedByTableSession()).toBe(true);
    act(() => { closeTableCellCursor(); view.rerender(); });
    expect(isCanvasLockedByTableSession()).toBe(false);
  });
});
