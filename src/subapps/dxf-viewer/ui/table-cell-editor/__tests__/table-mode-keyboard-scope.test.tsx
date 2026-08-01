/**
 * 🔴 ADR-739 Φ.Δ βήμα 4 — **Η ΑΠΟΔΕΙΞΗ ΟΤΙ Ο VIEWER ΔΕΝ ΚΛΕΙΔΩΝΕΙ.**
 *
 * Το `pushModalKeyboardScope` είναι **σωρός με βάθος**, όχι boolean. Ένα ξεχασμένο release
 * δεν δίνει σφάλμα, δεν δίνει προειδοποίηση, και δεν φαίνεται σε καμία οθόνη: απλώς **κανένα**
 * πλήκτρο του καμβά δεν ξαναδουλεύει μέχρι reload. Είναι η μία αστοχία αυτού του βήματος που
 * ο χρήστης θα βίωνε ως «χάλασε η εφαρμογή», και είναι αόρατη σε κάθε test κατάστασης.
 *
 * Γι' αυτό εδώ δεν ελέγχεται συμπεριφορά — ελέγχεται **ένας αριθμός**: το βάθος του σωρού,
 * μετά από κάθε δρόμο εξόδου που υπάρχει. Ο κατάλογος των δρόμων ΕΙΝΑΙ η προδιαγραφή:
 *
 *   1. `Esc` #2 / κλικ έξω  →  `closeTableCellCursor()`
 *   2. undo ή διαγραφή που **εξαφανίζει τον πίνακα** κάτω από τον δρομέα
 *   3. **unmount** του viewer ενώ ο χρήστης είναι μέσα στον πίνακα
 *   4. αλλαγή επιπέδου (η σκηνή δεν περιέχει πια αυτή την οντότητα)
 *
 * Και η **αρνητική** απόδειξη, εξίσου απαραίτητη: το `Esc` #1 (ακύρωση γραφής) **ΔΕΝ**
 * απελευθερώνει — μένεις μέσα στον πίνακα, απλώς σε πλοήγηση. Ένα test που έλεγχε μόνο
 * «απελευθερώνεται» θα περνούσε και από μια υλοποίηση που βγάζει τον χρήστη έξω στο πρώτο Esc.
 *
 * @see ui/table-cell-editor/useTableCellDoubleClickEditor.ts — §«Η ΔΗΛΩΣΗ»
 * @see src/lib/a11y/keyboard-scope.ts — ο σωρός
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import {
  inspectModalKeyboardScope,
  __resetModalKeyboardScopeForTests,
} from '@/lib/a11y/keyboard-scope';
import { useTableCellDoubleClickEditor } from '../useTableCellDoubleClickEditor';
import {
  setTableCellCursor,
  closeTableCellCursor,
  cancelTableCellCursorSession,
  setTableCellCursorDraft,
  __resetTableCellCursorStoreForTests,
} from '../../../state/table-cell-cursor-store';
import { tableCursorAt } from '../../../bim/table/table-cell-navigation';
import { createTableModel, toPersistedTableModel } from '../../../bim/table/table-model-helpers';
import { BUILTIN_TABLE_STYLE_IDS } from '../../../bim/table/table-style-presets';
import { useDrawingScaleStore } from '../../../state/drawing-scale-store';
import type { TableColumn, TableRow } from '../../../types/table';
import type { TableEntity } from '../../../types/table-entity';

// ── Fixture: ο ίδιος πίνακας 60mm × 16mm με τα αδελφά tests ────────────────────

const COLUMNS: TableColumn[] = [
  { id: 'c1', sizing: { kind: 'fixed', widthMm: 40 }, valueType: 'text', align: 'left' },
  { id: 'c2', sizing: { kind: 'fixed', widthMm: 20 }, valueType: 'text', align: 'left' },
];
const ROWS: TableRow[] = [
  { id: 'r1', rowClass: 'header', heightMm: 8 },
  { id: 'r2', rowClass: 'data', heightMm: 8 },
];

const ENTITY: TableEntity = {
  id: 'tbl_1',
  type: 'table',
  layerId: 'lyr_test',
  position: { x: 100, y: 200 },
  angleRad: 0,
  styleId: BUILTIN_TABLE_STYLE_IDS.STANDARD,
  model: toPersistedTableModel(createTableModel({ columns: COLUMNS, rows: ROWS })),
};

/**
 * Ελάχιστος διαχειριστής επιπέδων του οποίου η σκηνή είναι **μεταβλητή** — αυτό είναι το
 * όλο νόημα: οι δρόμοι εξόδου 2 και 4 δεν αγγίζουν τον δρομέα, **αφαιρούν την οντότητα**.
 */
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

/** Μπες στον πίνακα όπως το διπλό κλικ: δρομέας στο (r1,c1), κατάσταση γραφής. */
function enterTable(): void {
  act(() => {
    setTableCellCursor(ENTITY.id, tableCursorAt('r1', 'c1'), 'edit', 'αρχικό');
  });
}

const depth = (): number => inspectModalKeyboardScope().depth;

beforeEach(() => {
  useDrawingScaleStore.setState({ drawingScale: 1 });
  __resetTableCellCursorStoreForTests();
  __resetModalKeyboardScopeForTests();
});

describe('ADR-739 Φ.Δ βήμα 4 — το scope του πληκτρολογίου δεν διαρρέει', () => {
  it('χωρίς δρομέα, ο καμβάς κατέχει το πληκτρολόγιο (βάθος 0)', () => {
    renderEditor();
    expect(depth()).toBe(0);
  });

  it('μπαίνοντας στον πίνακα, το πληκτρολόγιο δηλώνεται δεσμευμένο (βάθος 1)', () => {
    renderEditor();
    enterTable();
    expect(depth()).toBe(1);
  });

  it('ΔΡΟΜΟΣ 1 — `closeTableCellCursor` (Esc #2 / κλικ έξω) απελευθερώνει', () => {
    renderEditor();
    enterTable();
    expect(depth()).toBe(1);
    act(() => { closeTableCellCursor(); });
    expect(depth()).toBe(0);
  });

  it('ΔΡΟΜΟΣ 2/4 — ο πίνακας εξαφανίζεται κάτω από τον δρομέα (undo/διαγραφή/αλλαγή επιπέδου)', () => {
    const view = renderEditor();
    enterTable();
    expect(depth()).toBe(1);

    // Ο δρομέας ΔΕΝ αγγίζεται· φεύγει μόνο η οντότητα. Αυτό είναι ακριβώς το σενάριο που
    // ένα `cursor !== null` θα άφηνε το scope πατημένο για πάντα.
    act(() => {
      view.removeTable();
      view.rerender();
    });
    expect(depth()).toBe(0);
  });

  it('ΔΡΟΜΟΣ 3 — unmount ενώ ο χρήστης είναι ΜΕΣΑ στον πίνακα', () => {
    const view = renderEditor();
    enterTable();
    expect(depth()).toBe(1);
    act(() => { view.unmount(); });
    expect(depth()).toBe(0);
  });

  it('🔴 ΑΡΝΗΤΙΚΗ ΑΠΟΔΕΙΞΗ — το `Esc` #1 ακυρώνει τη ΓΡΑΦΗ και ΔΕΝ σε βγάζει έξω', () => {
    const view = renderEditor();
    enterTable();
    act(() => { setTableCellCursorDraft('μισογραμμένο'); });
    expect(depth()).toBe(1);

    // Esc #1: γυρίζει σε πλοήγηση στο ΙΔΙΟ κελί (νέος sessionId ⇒ νέο `<input>`).
    act(() => {
      cancelTableCellCursorSession();
      view.rerender();
    });

    // Είσαι ακόμη μέσα στον πίνακα ⇒ ο καμβάς ΔΕΝ ξαναπαίρνει τα πλήκτρα.
    expect(depth()).toBe(1);

    // Esc #2: τώρα βγαίνεις.
    act(() => { closeTableCellCursor(); });
    expect(depth()).toBe(0);
  });

  it('ο σωρός δεν συσσωρεύεται σε επαναλαμβανόμενες εισόδους/εξόδους', () => {
    const view = renderEditor();
    for (let i = 0; i < 5; i++) {
      enterTable();
      act(() => { view.rerender(); });
      act(() => { closeTableCellCursor(); });
    }
    expect(depth()).toBe(0);
  });

  it('η μετακίνηση κελιού (Tab) ΔΕΝ αφήνει το βάθος να ανέβει στο 2', () => {
    const view = renderEditor();
    enterTable();
    act(() => {
      setTableCellCursor(ENTITY.id, tableCursorAt('r1', 'c2'), 'nav');
      view.rerender();
    });
    expect(depth()).toBe(1);
  });
});
