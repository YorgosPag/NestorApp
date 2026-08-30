/**
 * 🔴 **ADR-739 §36.9 — ΠΙΑΝΩ ΤΟ ΠΕΡΙΓΡΑΜΜΑ ΤΟΥ ΣΚΕΤΟΥ ΕΝΕΡΓΟΥ ΚΕΛΙΟΥ ΚΑΙ ΤΟ ΜΕΤΑΚΙΝΩ.**
 *
 * Το αίτημα του ιδιοκτήτη, αυτούσιο: «*όταν πηγαίνω με τον κέρσορα πάνω στο περίγραμμα **ενός
 * κελιού** ή μιας επιλεγμένης περιοχής, να γίνεται σταυρός με βέλη ώστε να καταλαβαίνω ότι
 * μπορώ να το πιάσω και να το μετακινήσω*». Το δεύτερο μισό δούλευε ήδη· το **πρώτο** δεν
 * υπήρχε — και το κελί **φαινόταν** περιγραμμένο (§41) και **είχε** λαβή συμπλήρωσης, δηλαδή
 * ήταν «σχήμα που φαίνεται και δεν πιάνεται» (ADR-754 §13.5).
 *
 * ## 🔴 Ο ΔΙΑΧΩΡΙΣΤΗΣ — σχεδιάστηκε ΠΡΙΝ τη μέτρηση
 * «*Τι ΑΛΛΟ θα έδινε το ίδιο σήμα;*» Εδώ έχει άμεση εφαρμογή, δύο φορές:
 *
 *  1. **`cursor: move` πάνω στο περίγραμμα** και **`cursor: move` επειδή ολόκληρη η οντότητα
 *     πίνακας είναι πιάσιμη** είναι **το ίδιο pixel value**. Γι' αυτό εδώ δεν μετριέται ποτέ
 *     CSS: μετριέται ο **ρόλος** (`range-move`), που ξεχωρίζει τα δύο.
 *  2. **Ένα κλικ που επιλέγει** και **ένα κλικ που ξεκινά μεταφορά μηδενικού μήκους** αφήνουν
 *     **και τα δύο** το μοντέλο ανέπαφο. Τα ξεχωρίζει **πού κατέληξε ο δρομέας**: η επιλογή τον
 *     μετακινεί, η μεταφορά κάνει `return` πριν φτάσει στο `setTableCellCursor`. Γι' αυτό το
 *     δίχτυ του γείτονα (§36.9) μετρά τον **δρομέα**, όχι το μοντέλο.
 *
 * ⚠️ Πλέγμα **5×5**, όπως κάθε test αυτού του ADR (§1.2).
 *
 * @see bim/table/table-effective-range.ts — ο ΕΝΑΣ κανόνας «επιλογή· αλλιώς το ενεργό κελί»
 * @see bim/table/table-range-move-zone.ts — το φράγμα που προστατεύει τον γείτονα
 */

import React from 'react';
import { act, render } from '@testing-library/react';
import { buildTableEntity } from '../../../bim/table/build-table-entity';
import {
  tableCellScreenPoint,
  tableFrameScreenPoint,
  tableRangeBorderScreenPoint,
  TABLE_TEST_VIEW,
  type TableTestView,
} from './table-screen-point';
import { TablePointerHarness, stubHarnessRect } from './table-pointer-harness';
import { tableCursorAt } from '../../../bim/table/table-cell-navigation';
import { writeCellInput } from '../../../bim/table/formula/table-formula-engine';
import { getPersistedCellText } from '../../../bim/table/table-model-helpers';
import {
  computeTableEntityGeometryLive,
  tableFrameToWorld,
  tablePxPerMm,
} from '../../../bim/table/table-entity-geometry';
import { tableIndicatorBandsMm } from '../../../bim/table/table-indicator-geometry';
import { tableRangeBorderReachMm } from '../../../bim/table/table-range-move-zone';
import { tableRangeRectMm } from '../../../bim/table/table-cell-range';
import { tableIndicatorProbeAtWorld } from '../table-cell-pointer-hit';
import {
  __resetTableCellCursorStoreForTests,
  getTableCellCursor,
  setTableCellCursor,
  setTableCellCursorMode,
  setTableCellSelection,
} from '../../../state/table-cell-cursor-store';
import { __resetTableCellSessionFocusForTests } from '../table-cell-session-focus';
import type { TableCellRangeBounds } from '../../../bim/table/table-cell-range';
import type { TableIndicatorCursorRole } from '../../../bim/table/table-indicator-cursor-role';
import type { PersistedTableModel } from '../../../types/table';
import type { TableEntity } from '../../../types/table-entity';
import type { Point2D } from '../../../rendering/types/Types';
import { activeTableModel } from '../../../bim/table/table-worksheet-resolve';
import { tableWorksheetFields } from '../../../bim/table/__tests__/make-table-entity';

const { transform: TRANSFORM, viewport: VIEWPORT } = TABLE_TEST_VIEW;

describe('🔴 ADR-739 §36.9 — το περίγραμμα του ΕΝΕΡΓΟΥ ΚΕΛΙΟΥ πιάνεται και μετακινείται', () => {
  let entity: TableEntity;
  let onCommitModel: jest.Mock;
  let canvas: HTMLElement;

  const rowId = (index: number): string => activeTableModel(entity).rows[index].id;
  const colId = (index: number): string => activeTableModel(entity).columns[index].id;
  const oneCell = (row: number, col: number): TableCellRangeBounds =>
    ({ firstRow: row, lastRow: row, firstCol: col, lastCol: col });
  const cellRef = (row: number, col: number) => ({ rowId: rowId(row), colId: colId(col) });

  /** Το κείμενο ενός κελιού στο **μοντέλο που παραδόθηκε στο commit**. */
  const movedText = (row: number, col: number): string => {
    const model = onCommitModel.mock.calls.at(-1)?.[1] as PersistedTableModel | undefined;
    if (!model) throw new Error('Κανένα commit μοντέλου — η μεταφορά δεν εκτελέστηκε');
    return getPersistedCellText(model, rowId(row), colId(col));
  };

  /**
   * 🔬 **Ο ΡΟΛΟΣ ΔΕΙΚΤΗ, ΑΠΟ ΤΟΝ ΖΩΝΤΑΝΟ ΔΡΟΜΟ.** Ίδια κλήση με τον `use-table-indicator-hover`:
   * το `activeCell` περνά **μόνο σε πλοήγηση**, όπως εκεί.
   */
  function roleAtFrame(
    u: number,
    v: number,
    activeCell = cellRef(3, 2),
    view: TableTestView = TABLE_TEST_VIEW,
  ): TableIndicatorCursorRole | null {
    const { mmToWorld } = computeTableEntityGeometryLive(entity);
    const world = tableFrameToWorld(entity, u, v, mmToWorld);
    return tableIndicatorProbeAtWorld(
      entity, world, view.transform.scale, null, undefined, 'table-mode', activeCell,
    ).cursor;
  }

  /**
   * 🔴 **Η ΚΛΙΜΑΚΑ ΤΟΥ ΦΥΛΛΟΥ** — γραμμή ~24 px, δηλαδή αυτό που βλέπει ο χρήστης όταν δουλεύει
   * σε πίνακα, όχι το 1:1 του `TABLE_TEST_VIEW` (όπου η ίδια γραμμή βγαίνει **800 px**).
   *
   * Ζει ως συνάρτηση της **διάταξης** και όχι ως σταθερά: το ύψος γραμμής ανήκει στο θέμα του
   * πίνακα και μπορεί να αλλάξει. Ένας γραμμένος αριθμός εδώ θα έπαυε σιωπηλά να δεσμεύει το
   * φράγμα — δηλαδή τα tests παρακάτω θα γίνονταν πράσινα χωρίς να δοκιμάζουν τίποτα, ακριβώς
   * όπως συνέβη στην πρώτη γραφή τους (η ΠΡΟΫΠΟΘΕΣΗ παρακάτω το έπιασε).
   */
  function sheetView(): TableTestView {
    const { mmToWorld, layout } = computeTableEntityGeometryLive(entity);
    const targetPxPerMm = 24 / layout.rows[3].heightMm;
    return {
      transform: { scale: targetPxPerMm / tablePxPerMm(mmToWorld, 1), offsetX: 0, offsetY: 0 },
      viewport: VIEWPORT,
    };
  }

  /** Ο χρήστης έχει το κελί ενεργό, σε **πλοήγηση**. */
  function navigateTo(row: number, col: number): void {
    act(() => {
      setTableCellCursor(entity, tableCursorAt(rowId(row), colId(col)), 'nav');
    });
  }

  function pressOn(point: Point2D): void {
    act(() => {
      canvas.dispatchEvent(
        new MouseEvent('mousedown', {
          button: 0, clientX: point.x, clientY: point.y, bubbles: true, cancelable: true,
        }),
      );
    });
  }

  function dragOver(point: Point2D): void {
    act(() => {
      document.dispatchEvent(
        new MouseEvent('mousemove', { buttons: 1, bubbles: true, clientX: point.x, clientY: point.y }),
      );
    });
  }

  function release(): void {
    act(() => {
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });
  }

  /** Γράψε κείμενο σε κελί **πριν** το mount — το μοντέλο είναι immutable, η οντότητα νέα. */
  function type(row: number, col: number, text: string): void {
    entity = { ...entity, ...tableWorksheetFields(writeCellInput(activeTableModel(entity), rowId(row), colId(col), text).model) };
  }

  /** 🔴 Ρητό mount, **μετά** το στήσιμο: δύο mounted harness δίνουν πράσινο για λάθος λόγο. */
  function mount(view: TableTestView = TABLE_TEST_VIEW): void {
    const rendered = render(
      <TablePointerHarness entity={entity} onCommitModel={onCommitModel} view={view} />,
    );
    canvas = rendered.getByTestId('canvas');
    stubHarnessRect(canvas, view);
  }

  beforeEach(() => {
    jest.useFakeTimers();
    __resetTableCellCursorStoreForTests();
    __resetTableCellSessionFocusForTests();
    onCommitModel = jest.fn();
    // 5 στήλες × (1 title + 1 header + 3 data) = 5×5.
    entity = buildTableEntity({ x: 0, y: 0 }, { columnCount: 5, dataRowCount: 3 }, 'table-1', 'layer-0');
    // Χωρίς περιεχόμενο, «μετακινήθηκε» και «δεν έγινε τίποτα» θα ήταν το ίδιο κείμενο.
    type(3, 2, 'ΜΕΤΑΚΙΝΟΥΜΕΝΟ');
  });

  afterEach(() => {
    jest.useRealTimers();
    __resetTableCellCursorStoreForTests();
    __resetTableCellSessionFocusForTests();
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Ο δείκτης — §31 συνάντησε το μισό αίτημα που έλειπε
  // ────────────────────────────────────────────────────────────────────────────

  describe('🔴 ο δείκτης πάνω στο περίγραμμα του σκέτου ενεργού κελιού', () => {
    /** Το μέσο της κάτω πλευράς του ενεργού κελιού — μακριά από λαβή και από `row-resize`. */
    function borderMid(): { readonly u: number; readonly v: number } {
      const { layout } = computeTableEntityGeometryLive(entity);
      const rect = tableRangeRectMm(layout, oneCell(3, 2))!;
      return { u: rect.x + rect.w / 2, v: rect.y + rect.h };
    }

    it('🔴 ΧΩΡΙΣ ΚΑΜΙΑ ΕΠΙΛΟΓΗ ⇒ `range-move` — ο σταυρός με τα βέλη', () => {
      const { u, v } = borderMid();
      expect(roleAtFrame(u, v)).toBe('range-move');
    });

    /**
     * 🔴 **Ο ΔΙΑΧΩΡΙΣΤΗΣ ΤΟΥ ΙΔΙΟΥ ΤΟΥ TEST.** Χωρίς αυτή τη γραμμή, το από πάνω θα μπορούσε να
     * είναι πράσινο επειδή κάτι **άλλο** δίνει `range-move` σε εκείνο το pixel. Εδώ αποδεικνύεται
     * ότι η αιτία είναι **ακριβώς** το ενεργό κελί: αφαίρεσέ το και ο ρόλος γυρίζει στο
     * `cell-select` — δηλαδή στη συμπεριφορά πριν το §36.9.
     */
    it('🔴 ο ΙΔΙΟΣ δείκτης χωρίς ενεργό κελί ⇒ `cell-select` (η προ-§36.9 συμπεριφορά)', () => {
      const { u, v } = borderMid();
      expect(roleAtFrame(u, v, null as never)).toBe('cell-select');
    });

    it('στο ΣΩΜΑ του ενεργού κελιού ⇒ σταυρός κελιού, όχι μετακίνηση', () => {
      const { layout } = computeTableEntityGeometryLive(entity);
      const rect = tableRangeRectMm(layout, oneCell(3, 2))!;
      expect(roleAtFrame(rect.x + rect.w / 2, rect.y + rect.h / 2)).toBe('cell-select');
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Η χειρονομία — από το πάτημα ως το μοντέλο
  // ────────────────────────────────────────────────────────────────────────────

  it('🔴 πάτημα στο περίγραμμα + σύρση + άφημα ⇒ ΤΟ ΚΕΛΙ ΜΕΤΑΚΙΝΗΘΗΚΕ στο μοντέλο', () => {
    mount();
    navigateTo(3, 2);
    pressOn(tableRangeBorderScreenPoint(entity, oneCell(3, 2)));
    dragOver(tableCellScreenPoint(entity, 4, 3));
    release();

    expect(onCommitModel).toHaveBeenCalledTimes(1);
    expect(movedText(4, 3)).toBe('ΜΕΤΑΚΙΝΟΥΜΕΝΟ');
    // Η **μετακίνηση** αδειάζει την πηγή — αλλιώς θα ήταν αντιγραφή (`Ctrl`).
    expect(movedText(3, 2)).toBe('');
  });

  it('🔑 η ΕΠΙΛΟΓΗ εξακολουθεί να μετακινείται — καμία απώλεια από την αλλαγή', () => {
    mount();
    navigateTo(3, 1);
    act(() => {
      setTableCellSelection({ from: cellRef(3, 1), to: cellRef(3, 2), kind: 'range' });
    });
    pressOn(tableRangeBorderScreenPoint(entity, { firstRow: 3, lastRow: 3, firstCol: 1, lastCol: 2 }));
    dragOver(tableCellScreenPoint(entity, 4, 1));
    release();

    expect(onCommitModel).toHaveBeenCalledTimes(1);
    expect(movedText(4, 2)).toBe('ΜΕΤΑΚΙΝΟΥΜΕΝΟ');
  });

  /** 🔑 Ο **ίδιος** φύλακας που έχει ήδη η λαβή συμπλήρωσης (§13.5): σε γραφή, σιωπή. */
  it('🔑 σε ΓΡΑΦΗ το περίγραμμα του ενεργού κελιού ΔΕΝ πιάνεται (Excel parity)', () => {
    mount();
    navigateTo(3, 2);
    act(() => setTableCellCursorMode('edit'));
    pressOn(tableRangeBorderScreenPoint(entity, oneCell(3, 2)));
    dragOver(tableCellScreenPoint(entity, 4, 3));
    release();

    expect(onCommitModel).not.toHaveBeenCalled();
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 🔴🔴 ΤΟ ΔΙΧΤΥ ΤΟΥ ΓΕΙΤΟΝΑ — το εύρημα της Μέτρησης Γ (§36.9)
  // ────────────────────────────────────────────────────────────────────────────

  describe('🔴🔴 §36.9 ο ΓΕΙΤΟΝΑΣ ΜΕΝΕΙ ΕΠΙΛΕΞΙΜΟΣ — η άλως δεν τρώει το σώμα του', () => {
    /**
     * Η οπή (9 px) και η **φραγμένη** εμβέλεια, από τα ίδια SSoT που ρωτά ο κώδικας. Το test
     * **δεν** γράφει αριθμούς: αν αύριο αλλάξει η οπή ή το κλάσμα, μετακινείται μαζί τους.
     */
    function reaches(view: TableTestView) {
      const geometry = computeTableEntityGeometryLive(entity);
      const pxPerMm = tablePxPerMm(geometry.mmToWorld, view.transform.scale);
      const apertureMm = tableIndicatorBandsMm(pxPerMm).gapMm;
      const rect = tableRangeRectMm(geometry.layout, oneCell(3, 2))!;
      return {
        apertureMm,
        reachMm: tableRangeBorderReachMm(rect, apertureMm),
        rectBottom: rect.y + rect.h,
        u: rect.x + rect.w / 2,
      };
    }

    /**
     * 🔴 **Η ΠΡΟΫΠΟΘΕΣΗ ΤΟΥ ΔΙΧΤΥΟΥ.** Αν το φράγμα **δεν** δεσμεύει σε αυτή την κλίμακα, τα δύο
     * tests παρακάτω δοκιμάζουν το τίποτα και είναι πράσινα για λάθος λόγο. Δηλώνεται ρητά.
     */
    it('🔴 ΠΡΟΫΠΟΘΕΣΗ: για ΕΝΑ κελί το φράγμα ΔΕΣΜΕΥΕΙ — η εμβέλεια είναι μικρότερη της οπής', () => {
      const { apertureMm, reachMm } = reaches(sheetView());
      expect(reachMm).toBeLessThan(apertureMm);
    });

    it('🔑 λίγο έξω από το περίγραμμα, ΜΕΣΑ στην εμβέλεια ⇒ ακόμη `range-move`', () => {
      const view = sheetView();
      const { reachMm, rectBottom, u } = reaches(view);
      expect(roleAtFrame(u, rectBottom + reachMm / 2, cellRef(3, 2), view)).toBe('range-move');
    });

    /**
     * 🔴🔴 **ΤΟ ΕΛΑΤΤΩΜΑ ΠΟΥ ΘΑ ΕΙΧΕ ΓΕΝΝΗΘΕΙ, ΚΛΕΙΔΩΜΕΝΟ.** Σημείο **πιο μακριά από τη
     * φραγμένη εμβέλεια αλλά μέσα στην παλιά οπή των 9 px**: πριν το φράγμα, εκεί ο δείκτης
     * έλεγε `range-move` και το κλικ ξεκινούσε **μεταφορά** αντί να επιλέξει το γειτονικό κελί.
     * Μετρημένο: η άλως έτρωγε **56%** της γειτονικής γραμμής στα 2 px/mm και **100%** στο 1.
     */
    it('🔴 πιο έξω από την εμβέλεια, μέσα στην ΠΑΛΙΑ οπή ⇒ `cell-select`, ο γείτονας ζει', () => {
      const view = sheetView();
      const { apertureMm, reachMm, rectBottom, u } = reaches(view);
      expect(roleAtFrame(u, rectBottom + (reachMm + apertureMm) / 2, cellRef(3, 2), view))
        .toBe('cell-select');
    });

    /**
     * 🔑 **ΚΑΙ Η ΧΕΙΡΟΝΟΜΙΑ, ΟΧΙ ΜΟΝΟ Ο ΔΕΙΚΤΗΣ.** Ο ρόλος και το πάτημα περνούν από τον ίδιο
     * δρόμο (§36), αλλά «ίδιος δρόμος» είναι ισχυρισμός μέχρι να μετρηθεί — και το ADR-754
     * §14.9.2 είναι η απόδειξη ότι μπορούν να αποκλίνουν (ο δείκτης υποσχόταν, το πάτημα όχι).
     */
    it('🔴 το ΠΑΤΗΜΑ εκεί ΕΠΙΛΕΓΕΙ τον γείτονα — ο δρομέας μετακινείται, καμία μεταφορά', () => {
      const view = sheetView();
      mount(view);
      navigateTo(3, 2);
      const { apertureMm, reachMm, rectBottom, u } = reaches(view);
      pressOn(tableFrameScreenPoint(entity, u, rectBottom + (reachMm + apertureMm) / 2, view));

      expect(onCommitModel).not.toHaveBeenCalled();
      expect(getTableCellCursor()?.position.rowId).toBe(rowId(4));
    });
  });
});
