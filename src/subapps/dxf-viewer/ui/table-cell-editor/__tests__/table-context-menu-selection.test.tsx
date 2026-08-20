/**
 * 🔴 ADR-739 §68 — **ΤΟ ΔΕΞΙ ΚΛΙΚ ΕΓΚΑΘΙΣΤΑ ΤΟΝ ΣΤΟΧΟ ΤΟΥ** (full parity με το Excel).
 *
 * Ο ιδιοκτήτης, 20/08, με στιγμιότυπο: επιλεγμένο το `A1`, δεξί κλικ στο `B2` — το μενού
 * τιτλοφορούνταν σωστά «Περιγράμματα B2» και η οθόνη έδειχνε ακόμα μαρκαρισμένο το `A1`.
 *
 * ## Γιατί εδώ τρέχει η ΟΛΟΚΛΗΡΗ αλυσίδα και όχι η καθαρή συνάρτηση
 * Το κριτήριο («*είναι ήδη μέσα;*») δοκιμάζεται καθαρά στο `table-range-menu-target.test.ts`.
 * Αυτό είναι το ασφαλές μισό — και είναι ακριβώς ο τύπος πράσινου test που μπορεί να κάθεται
 * πάνω σε **νεκρό καλώδιο**: ένα κριτήριο που κανείς δεν καλεί, ή ένα `if (!primary) return`
 * που έμεινε ένα επίπεδο πιο πάνω, θα άφηναν κάθε test κριτηρίου πράσινο ενώ ο χρήστης πατά
 * και η επιλογή δεν κουνιέται. **Αυτό ακριβώς ήταν το ελάττωμα.**
 *
 * Εδώ λοιπόν: πραγματικό `mousedown` με `button: 2` σε pixel οθόνης → `tablePointerHitAtWorld`
 * → `use-table-cell-pointer` → οι γραφείς → **πραγματικό store**. Η επαλήθευση γίνεται στο
 * store, ποτέ σε mock: ένα `toHaveBeenCalled()` θα ξαναπερνούσε ακόμα κι αν η επιλογή που
 * γράφτηκε ήταν λάθος.
 *
 * ## ⚠️ Τι ΔΕΝ αποδεικνύει αυτό το αρχείο, ρητά
 * Ότι το μενού που ανοίγει **μετά** τιτλοφορείται με τα νέα όρια. Αυτό το εγγυάται η σειρά
 * `mousedown` → `contextmenu` του browser, την οποία το jsdom δεν αναπαράγει από μόνο του, και
 * ο κανόνας Α22 που διαβάζει το store — δοκιμασμένος χωριστά. Ό,τι κλειδώνει εδώ είναι ότι
 * **όταν φτάσει το μενού, το store λέει ήδη το σωστό**.
 *
 * ⚠️ Πλέγμα **5×3** (το προεπιλεγμένο του `buildTableEntity`).
 *
 * @see ui/table-cell-editor/table-context-menu-selection.ts — η αρχή και οι φρουροί
 * @see ui/table-cell-editor/table-pointer-axis-selection.ts — η τρίτη διαδρομή (ζώνη)
 */

import React from 'react';
import { act, render } from '@testing-library/react';
import { buildTableEntity } from '../../../bim/table/build-table-entity';
import { TablePointerHarness, stubHarnessRect } from './table-pointer-harness';
import { tableBandScreenPoint, tableCellScreenPoint } from './table-screen-point';
import { tableCursorAt } from '../../../bim/table/table-cell-navigation';
import { resolveTableModel } from '../../../bim/table/table-model-helpers';
import {
  resolveTableSelectionBounds,
  type TableCellRangeBounds,
} from '../../../bim/table/table-cell-range';
import {
  __resetTableCellCursorStoreForTests,
  getTableCellCursor,
  setTableCellCursor,
  setTableCellSelection,
} from '../../../state/table-cell-cursor-store';
import { __resetTableCellSessionFocusForTests } from '../table-cell-session-focus';
import type { TableEntity } from '../../../types/table-entity';
import type { Point2D } from '../../../rendering/types/Types';

describe('🔴 ADR-739 §68 — το δεξί κλικ μετακινεί την επιλογή (Excel parity)', () => {
  let entity: TableEntity;
  let canvas: HTMLElement;
  let onCommitPending: jest.Mock;

  const rowId = (index: number): string => entity.model.rows[index].id;
  const colId = (index: number): string => entity.model.columns[index].id;
  const cellRef = (row: number, col: number) => ({ rowId: rowId(row), colId: colId(col) });

  beforeEach(() => {
    __resetTableCellCursorStoreForTests();
    __resetTableCellSessionFocusForTests();
    onCommitPending = jest.fn();
    entity = buildTableEntity({ x: 0, y: 0 }, {}, 'table-1', 'layer-0');
    // Ο χρήστης είναι ήδη μέσα στη λειτουργία πίνακα, με ενεργό το **A1** — ακριβώς το
    // στιγμιότυπο του ιδιοκτήτη.
    setTableCellCursor(entity.id, tableCursorAt(rowId(0), colId(0)), 'nav');
    const view = render(
      <TablePointerHarness entity={entity} onCommitPending={onCommitPending} />,
    );
    canvas = view.getByTestId('canvas');
    stubHarnessRect(canvas);
  });

  afterEach(() => {
    __resetTableCellCursorStoreForTests();
    __resetTableCellSessionFocusForTests();
  });

  /** Πάτημα **δεξιού** πλήκτρου — `button: 2`, το μόνο που ενδιαφέρει αυτή τη σουίτα. */
  function rightPressAt(point: Point2D): void {
    act(() => {
      canvas.dispatchEvent(
        new MouseEvent('mousedown', {
          bubbles: true,
          button: 2,
          clientX: point.x,
          clientY: point.y,
        }),
      );
    });
  }

  /** Τα όρια της τρέχουσας επιλογής όπως τα διαβάζει ο ζωγράφος — ποτέ ωμό `selection`. */
  function currentBounds(): TableCellRangeBounds | null {
    const selection = getTableCellCursor()?.selection;
    return selection
      ? resolveTableSelectionBounds(resolveTableModel(entity.model), selection)
      : null;
  }

  describe('μέσα στο πλέγμα', () => {
    /** 🔑 Το ίδιο το στιγμιότυπο του ιδιοκτήτη, από το πάτημα ως το store. */
    it('🔴 ενεργό A1, δεξί κλικ στο B2 ⇒ ενεργό γίνεται το B2', () => {
      rightPressAt(tableCellScreenPoint(entity, 1, 1));

      const position = getTableCellCursor()?.position;
      expect(position?.rowId).toBe(rowId(1));
      expect(position?.colId).toBe(colId(1));
    });

    /**
     * Ό,τι γράφεται δεσμεύεται **πριν** κουνηθεί το ενεργό κελί — το ίδιο συμβόλαιο που τηρεί
     * το αριστερό κλικ (§26.15). Χωρίς αυτό, η μετακίνηση θα ήταν σιωπηλή απώλεια
     * πληκτρολόγησης: το `setTableCellCursor` **σβήνει το πρόχειρο**.
     */
    it('🔴 δεσμεύει ό,τι γράφεται ΠΡΙΝ μετακινήσει', () => {
      rightPressAt(tableCellScreenPoint(entity, 1, 1));
      expect(onCommitPending).toHaveBeenCalled();
    });

    /**
     * §27.15 — «*καμία επιλογή ≠ επιλογή 1×1*». Το δεξί κλικ κάνει **ό,τι ακριβώς** το
     * αριστερό: τοποθετεί ενεργό κελί και διαλύει την περιοχή. Δεν εφευρίσκει επιλογή 1×1,
     * γιατί τότε τα δύο πλήκτρα θα άφηναν τον πίνακα σε **διαφορετική** κατάσταση από το ίδιο
     * σημείο — και η διαφορά θα φαινόταν μόνο στο επόμενο `Shift+βέλος`.
     */
    it('🔴 δεν εφευρίσκει επιλογή 1×1 — ίδια κατάσταση με το αριστερό κλικ', () => {
      rightPressAt(tableCellScreenPoint(entity, 1, 1));
      expect(getTableCellCursor()?.selection).toBeFalsy();
    });

    /**
     * 🔴 Ο κανόνας του Excel που ο Α22 πάντα υπηρετούσε: δεξί κλικ **μέσα** στην επιλογή την
     * κρατά ολόκληρη. Χωρίς αυτό, «αντιγραφή» πάνω σε μαρκαρισμένο `A1:B3` θα αντέγραφε **ένα**
     * κελί — δηλαδή η οθόνη θα έλεγε τρία και η πράξη θα έκανε ένα (§27.17 ανάποδα).
     */
    it('🔴 επιλογή A1:B3, δεξί κλικ ΜΕΣΑ της ⇒ μένει ανέπαφη', () => {
      act(() => {
        setTableCellSelection({ from: cellRef(0, 0), to: cellRef(2, 1), kind: 'range' });
      });

      rightPressAt(tableCellScreenPoint(entity, 1, 1));

      expect(currentBounds()).toEqual({ firstRow: 0, lastRow: 2, firstCol: 0, lastCol: 1 });
      expect(onCommitPending).not.toHaveBeenCalled();
    });

    it('🔴 επιλογή A1:B3, δεξί κλικ ΕΞΩ της ⇒ η επιλογή πέφτει και ενεργό γίνεται το πατημένο', () => {
      act(() => {
        setTableCellSelection({ from: cellRef(0, 0), to: cellRef(2, 1), kind: 'range' });
      });

      rightPressAt(tableCellScreenPoint(entity, 4, 2));

      expect(currentBounds()).toBeNull();
      expect(getTableCellCursor()?.position.rowId).toBe(rowId(4));
      expect(getTableCellCursor()?.position.colId).toBe(colId(2));
    });
  });

  describe('🔴 ο φρουρός `nav` — όσο γράφεται κάτι, το δεξί δεν μετακινεί', () => {
    /**
     * Μετρημένο στο Excel: με ανοιχτή καταχώριση, το δεξί κλικ σε άλλο κελί **δεν** τερματίζει
     * τη γραφή. Και είναι η διαδρομή που θα έτρωγε μισογραμμένους τύπους: ο φρουρός των
     * υποδείξεων (`tryTablePointModeMouseDown`) **παραιτείται** στο `event.button !== 0`, άρα
     * χωρίς αυτόν τον έλεγχο το δεξί κλικ θα έσβηνε ένα `=SUM(` χωρίς κανένα σφάλμα πουθενά.
     */
    it.each(['enter', 'edit'] as const)('mode «%s» ⇒ το πρόχειρο επιβιώνει και ο δρομέας μένει', (mode) => {
      act(() => {
        setTableCellCursor(entity.id, tableCursorAt(rowId(0), colId(0)), mode, '=SUM(');
      });

      rightPressAt(tableCellScreenPoint(entity, 1, 1));

      expect(getTableCellCursor()?.draft).toBe('=SUM(');
      expect(getTableCellCursor()?.position.colId).toBe(colId(0));
      expect(onCommitPending).not.toHaveBeenCalled();
    });
  });

  describe('🔴 ζώνη δείκτη (γράμμα στήλης / αριθμός γραμμής)', () => {
    /** Excel: δεξί κλικ σε γράμμα στήλης εκτός επιλογής μαρκάρει **ολόκληρη** τη στήλη. */
    it('🔴 δεξί κλικ στο γράμμα «B» ⇒ μαρκάρεται ΟΛΗ η στήλη B', () => {
      rightPressAt(tableBandScreenPoint(entity, 'column', 1));

      expect(currentBounds()).toEqual({
        firstRow: 0,
        lastRow: entity.model.rows.length - 1,
        firstCol: 1,
        lastCol: 1,
      });
      expect(getTableCellCursor()?.selection?.kind).toBe('column');
    });

    it('🔴 δεξί κλικ στον αριθμό «2» ⇒ μαρκάρεται ΟΛΗ η γραμμή 2', () => {
      rightPressAt(tableBandScreenPoint(entity, 'row', 1));

      expect(currentBounds()).toEqual({
        firstRow: 1,
        lastRow: 1,
        firstCol: 0,
        lastCol: entity.model.columns.length - 1,
      });
      expect(getTableCellCursor()?.selection?.kind).toBe('row');
    });

    /**
     * 🔴 **Η ερώτηση «μέσα ή έξω;» είναι ΜΙΑ**, και είναι το `insideSelection` του
     * `resolveTableAxisActionTarget` — το ίδιο που θα εφαρμόσει το μενού χιλιοστά αργότερα.
     * Χωρίς αυτό, «Διαγραφή στήλης» με μαρκαρισμένες τις `A:B` και δεξί κλικ στην `B` θα
     * έσβηνε **μία** ενώ ο τίτλος γράφει δύο: ακριβώς το ελάττωμα του §27.17, από την ανάποδη.
     */
    it('🔴 μαρκαρισμένες οι στήλες A:B, δεξί κλικ στη «B» ⇒ μένουν ΚΑΙ ΟΙ ΔΥΟ', () => {
      act(() => {
        setTableCellSelection({ from: cellRef(0, 0), to: cellRef(4, 1), kind: 'column' });
      });

      rightPressAt(tableBandScreenPoint(entity, 'column', 1));

      expect(currentBounds()).toEqual({ firstRow: 0, lastRow: 4, firstCol: 0, lastCol: 1 });
    });

    /**
     * 🔴 Το **είδος** της επιλογής είναι φράγμα (§27.15): μαρκαρισμένες **γραμμές** δεν κάνουν
     * ένα δεξί κλικ σε **στήλη** «μέσα». Ο χρήστης άλλαξε άξονα — και το Excel μαρκάρει τη
     * στήλη που πάτησε. Ένα κριτήριο που κοίταζε μόνο γεωμετρία θα απαντούσε «μέσα» και θα
     * άφηνε μαρκαρισμένες τις γραμμές πάνω σε μενού που μιλά για στήλη.
     */
    it('🔴 μαρκαρισμένες ΓΡΑΜΜΕΣ, δεξί κλικ σε ΣΤΗΛΗ ⇒ μαρκάρεται η στήλη', () => {
      act(() => {
        setTableCellSelection({ from: cellRef(0, 0), to: cellRef(1, 2), kind: 'row' });
      });

      rightPressAt(tableBandScreenPoint(entity, 'column', 2));

      expect(getTableCellCursor()?.selection?.kind).toBe('column');
      expect(currentBounds()).toEqual({
        firstRow: 0,
        lastRow: entity.model.rows.length - 1,
        firstCol: 2,
        lastCol: 2,
      });
    });
  });
});
