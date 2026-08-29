/**
 * 🔴 ADR-828 **Φ4α** — **ΓΕΜΙΖΩ, ΑΛΛΑΖΩ ΓΝΩΜΗ, ΚΑΙ ΤΑ ΚΕΛΙΑ ΞΑΝΑΓΡΑΦΟΝΤΑΙ.**
 *
 * ## Γιατί ζωντανό harness και όχι καθαρές συναρτήσεις
 * Η καθαρή γεωμετρία (`table-fill-badge.test.ts`) και το μενού (`table-fill-options-menu`) είναι
 * **ήδη** πράσινα. Το ίδιο ήταν και όταν η λαβή **δεν γέμιζε ποτέ τίποτα** (ADR-754 §14.9.2):
 * το σφάλμα ζει **στη συνάντηση των κομματιών**, και είναι η πέμπτη φορά που αυτό το έργο
 * πληρώνει το ίδιο μάθημα. Άρα εδώ δεν καλείται καμία καθαρή συνάρτηση για να «επιβεβαιώσει»:
 * γίνεται **πραγματική** σύρση πάνω σε **πραγματική** οντότητα, το κουμπί σημαδεύεται εκεί
 * όπου το τοποθετεί η **ζωγραφιά**, και η μέτρηση γίνεται στο **μοντέλο** που φτάνει στο commit.
 *
 * ## 🔴 Ο ΔΙΑΧΩΡΙΣΤΗΣ: τι ΑΛΛΟ θα έδινε το ίδιο σήμα;
 * «Το μενού άνοιξε» **δεν** είναι μέτρηση: το ίδιο μενού ανοίγει και από **δεξί σύρσιμο** (Φ3).
 * Τα ξεχωρίζουν δύο πράγματα και δοκιμάζονται και τα δύο:
 *  1. εδώ γίνεται **αριστερό** κλικ σε **ακίνητο** σημείο — καμία σύρση, κανένα δεξί πλήκτρο·
 *  2. το κλικ γίνεται **κάτω** από τη γεμισμένη περιοχή, όπου το δεξί σύρσιμο δεν φτάνει ποτέ.
 *
 * ⚠️ Πλέγμα **5×5**, όπως κάθε test αυτής της οικογένειας.
 *
 * @see ui/table-cell-editor/table-fill-badge-press.ts — οι δύο πόρτες που ελέγχονται
 * @see ui/table-cell-editor/__tests__/table-fill-handle-drag.test.tsx — το αδελφό δίχτυ
 */

import React from 'react';
import { act, render } from '@testing-library/react';
import { buildTableEntity } from '../../../bim/table/build-table-entity';
import {
  TABLE_TEST_VIEW,
  tableCellScreenPoint,
  tableFillBadgeScreenPoint,
  tableFillHandleScreenPoint,
} from './table-screen-point';
import { TablePointerHarness, stubHarnessRect } from './table-pointer-harness';
import { tableCursorAt } from '../../../bim/table/table-cell-navigation';
import { writeCellInput } from '../../../bim/table/formula/table-formula-engine';
import { getPersistedCellText } from '../../../bim/table/table-model-helpers';
import {
  __resetTableCellCursorStoreForTests,
  closeTableCellCursor,
  setTableCellCursor,
} from '../../../state/table-cell-cursor-store';
import {
  __resetTableFillBadgeForTests,
  getTableFillBadge,
} from '../../../state/table-fill-badge-store';
import { __resetTableCellSessionFocusForTests } from '../table-cell-session-focus';
import { setTableFillMenuPort, type TableFillMenuTarget } from '../table-fill-menu-port';
import { tryOpenTableFillBadgeMenuByKey } from '../table-fill-badge-press';
import { resolveTableFillBadgeBounds } from '../../../bim/table/table-fill-badge';
import type { TableCellRangeBounds } from '../../../bim/table/table-cell-range';
import type { PersistedTableModel } from '../../../types/table';
import type { TableEntity } from '../../../types/table-entity';
import type { Point2D } from '../../../rendering/types/Types';

describe('🔴 ADR-828 Φ4α — το κουμπί «Επιλογές Αυτόματης Συμπλήρωσης», από άκρη σε άκρη', () => {
  let entity: TableEntity;
  let onCommitModel: jest.Mock;
  let canvas: HTMLElement;
  let rerender: (ui: React.ReactElement) => void;
  let openMenu: jest.Mock;

  const rowId = (index: number): string => entity.model.rows[index].id;
  const colId = (index: number): string => entity.model.columns[index].id;

  const oneCell = (row: number, col: number): TableCellRangeBounds =>
    ({ firstRow: row, lastRow: row, firstCol: col, lastCol: col });

  /** Το τελευταίο μοντέλο που παραδόθηκε στο commit — το μόνο που θα δει ο χρήστης. */
  const lastModel = (): PersistedTableModel => {
    const model = onCommitModel.mock.calls.at(-1)?.[1] as PersistedTableModel | undefined;
    if (!model) throw new Error('Κανένα commit μοντέλου');
    return model;
  };

  const textAt = (row: number, col: number): string =>
    getPersistedCellText(lastModel(), rowId(row), colId(col));

  /** Ο στόχος που παγώθηκε στο μενού τη στιγμή του ανοίγματος. */
  const menuTarget = (): TableFillMenuTarget => {
    const call = openMenu.mock.calls.at(-1);
    if (!call) throw new Error('Το μενού δεν άνοιξε');
    return call[2] as TableFillMenuTarget;
  };

  const menuPoint = (): Point2D => {
    const call = openMenu.mock.calls.at(-1);
    if (!call) throw new Error('Το μενού δεν άνοιξε');
    return { x: call[0] as number, y: call[1] as number };
  };

  function navigateTo(row: number, col: number): void {
    act(() => {
      setTableCellCursor(entity.id, tableCursorAt(rowId(row), colId(col)), 'nav');
    });
  }

  function pressOn(point: Point2D): void {
    act(() => {
      canvas.dispatchEvent(
        new MouseEvent('mousedown', {
          button: 0,
          clientX: point.x,
          clientY: point.y,
          bubbles: true,
          cancelable: true,
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
      document.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true }));
    });
  }

  function mount(): void {
    const view = render(<TablePointerHarness entity={entity} onCommitModel={onCommitModel} />);
    rerender = view.rerender;
    canvas = view.getByTestId('canvas');
    stubHarnessRect(canvas);
  }

  /**
   * 🔴 **Η ΣΚΗΝΗ ΠΡΟΧΩΡΑ, ΟΠΩΣ ΣΤΗΝ ΠΑΡΑΓΩΓΗ.**
   *
   * Ο harness επιστρέφει `props.entity` ως «ζωντανό» πίνακα. Χωρίς αυτό το βήμα, η σφραγίδα
   * έκδοσης του κουμπιού (το **νέο** μοντέλο) δεν θα ταίριαζε ποτέ με την οντότητα — δηλαδή το
   * test θα μετρούσε «κανένα κουμπί» και θα ήταν πράσινο **για λάθος λόγο**. Εδώ ενημερώνεται
   * ό,τι θα ενημέρωνε η σκηνή: το ίδιο ακριβώς `model` που πήγε στο commit.
   */
  function sceneAdvances(): void {
    entity = { ...entity, model: lastModel() };
    act(() => {
      rerender(<TablePointerHarness entity={entity} onCommitModel={onCommitModel} />);
    });
  }

  /** Η ολόκληρη συμπλήρωση: πιάσε τη λαβή, σύρε ως το κελί, άσε — και η σκηνή προχωρά. */
  function fillFrom(source: TableCellRangeBounds, toRow: number, toCol: number): void {
    pressOn(tableFillHandleScreenPoint(entity, source));
    dragOver(tableCellScreenPoint(entity, toRow, toCol));
    release();
    sceneAdvances();
  }

  beforeEach(() => {
    jest.useFakeTimers();
    __resetTableCellCursorStoreForTests();
    __resetTableCellSessionFocusForTests();
    __resetTableFillBadgeForTests();
    openMenu = jest.fn();
    setTableFillMenuPort({ open: openMenu });
    onCommitModel = jest.fn();
    entity = buildTableEntity({ x: 0, y: 0 }, { columnCount: 5, dataRowCount: 3 }, 'table-1', 'layer-0');
    entity = { ...entity, model: writeCellInput(entity.model, entity.model.rows[2].id, entity.model.columns[1].id, '10').model };
  });

  afterEach(() => {
    jest.useRealTimers();
    setTableFillMenuPort(null);
    __resetTableFillBadgeForTests();
    __resetTableCellCursorStoreForTests();
    __resetTableCellSessionFocusForTests();
  });

  describe('🔴 το κουμπί γεννιέται από την ίδια την εγγραφή', () => {
    it('🔴 μετά τη συμπλήρωση υπάρχει κουμπί, πάνω στη ΓΕΜΙΣΜΕΝΗ περιοχή (πηγή + γέμισμα)', () => {
      mount();
      navigateTo(2, 1);
      fillFrom(oneCell(2, 1), 4, 1);

      const badge = getTableFillBadge()!;
      expect(badge.entityId).toBe('table-1');
      // Excel parity: μαρκαρισμένη —και «γεμισμένη» για το κουμπί— είναι η **ένωση**.
      expect(badge.filled).toEqual({ firstRow: 2, lastRow: 4, firstCol: 1, lastCol: 1 });
      expect(badge.source).toEqual(oneCell(2, 1));
    });

    it('🔑 η σφραγίδα έκδοσης είναι το ΝΕΟ μοντέλο ⇒ το κουμπί κρίνεται ζωντανό', () => {
      mount();
      navigateTo(2, 1);
      fillFrom(oneCell(2, 1), 4, 1);

      // Η ίδια κρίση που κάνει ο ζωγράφος κάθε καρέ. Χωρίς σωστή σφραγίδα θα ήταν `null` —
      // δηλαδή κουμπί που κανείς δεν βλέπει ποτέ, με πράσινα tests από πάνω του.
      expect(getTableFillBadge()!.modelRef).toBe(entity.model);
      expect(resolveTableFillBadgeBounds(entity, { entityId: 'table-1', mode: 'nav' } as never, getTableFillBadge()))
        .toEqual({ firstRow: 2, lastRow: 4, firstCol: 1, lastCol: 1 });
    });

    it('πριν από κάθε συμπλήρωση δεν υπάρχει κουμπί', () => {
      mount();
      navigateTo(2, 1);
      expect(getTableFillBadge()).toBeNull();
    });
  });

  describe('🔴 ΠΟΡΤΑ 1 — το πάτημα', () => {
    it('🔴🔴 κλικ στο κουμπί ⇒ ανοίγει ΤΟ ΙΔΙΟ μενού, και η επιλογή ΞΑΝΑΓΡΑΦΕΙ τα κελιά', () => {
      mount();
      navigateTo(2, 1);
      fillFrom(oneCell(2, 1), 4, 1);
      // Ο μονήρης αριθμός `10` αντιγράφεται (καμία απόδειξη βήματος) — Excel parity.
      expect(textAt(3, 1)).toBe('10');

      pressOn(tableFillBadgeScreenPoint(entity, getTableFillBadge()!.filled));
      expect(openMenu).toHaveBeenCalledTimes(1);
      // Η προσφορά έρχεται από τη **μία** ανίχνευση: μονήρης αριθμός ⇒ «Συμπλήρωση σειράς»
      // ενεργή (το `'series'` είναι υπερσύνολο του `'auto'`), ημερολόγιο όχι.
      expect(menuTarget().offer).toEqual({ series: true, date: false });

      // 🔑 Η μέτρηση: ο άνθρωπος άλλαξε γνώμη, και το **μοντέλο** το δείχνει.
      act(() => menuTarget().apply('series'));
      expect(textAt(3, 1)).toBe('11');
      expect(textAt(4, 1)).toBe('12');
    });

    it('🔴 το κουμπί ΕΠΑΝ-ΟΠΛΙΖΕΤΑΙ μετά την επιλογή — μπορείς να ξαναλλάξεις γνώμη', () => {
      mount();
      navigateTo(2, 1);
      fillFrom(oneCell(2, 1), 4, 1);
      pressOn(tableFillBadgeScreenPoint(entity, getTableFillBadge()!.filled));

      act(() => menuTarget().apply('series'));
      sceneAdvances();
      // Excel parity: το κουμπί δεν σβήνει από τη δική του επιλογή — ξαναγεννιέται με τη νέα
      // σφραγίδα, γιατί η επιλογή περνά από την **ίδια** εγγραφή που το γέννησε.
      expect(getTableFillBadge()!.modelRef).toBe(entity.model);

      pressOn(tableFillBadgeScreenPoint(entity, getTableFillBadge()!.filled));
      act(() => menuTarget().apply('copy'));
      expect(textAt(3, 1)).toBe('10');
      expect(textAt(4, 1)).toBe('10');
    });

    it('🔴 ΤΟ ΦΡΑΓΜΑ ΣΤΗΝ ΟΘΟΝΗ: το κουμπί ΔΕΝ κλέβει το πάτημα της λαβής', () => {
      mount();
      navigateTo(2, 1);
      fillFrom(oneCell(2, 1), 3, 1);
      onCommitModel.mockClear();
      openMenu.mockClear();

      // Η λαβή κάθεται τώρα στη γωνία της **γεμισμένης** περιοχής — ακριβώς πάνω από το κουμπί.
      // Αν το κουμπί διεκδικούσε έστω ένα pixel της, εδώ θα άνοιγε μενού αντί να γεμίσει.
      pressOn(tableFillHandleScreenPoint(entity, getTableFillBadge()!.filled));
      dragOver(tableCellScreenPoint(entity, 4, 1));
      release();

      expect(openMenu).not.toHaveBeenCalled();
      expect(onCommitModel).toHaveBeenCalledTimes(1);
    });
  });

  describe('🔴 ΠΟΡΤΑ 2 — το πληκτρολόγιο (`Alt+↓`), που το Excel ΔΕΝ έχει', () => {
    const keyRequest = () => ({
      entity,
      cursor: { entityId: 'table-1', mode: 'nav' } as never,
      container: canvas,
      transform: TABLE_TEST_VIEW.transform,
      writer: { liveTable: () => entity, commit: onCommitModel as never },
    });

    it('🔴🔴 ανοίγει το ίδιο μενού, ΧΩΡΙΣ να αγγίξει κανείς το ποντίκι', () => {
      mount();
      navigateTo(2, 1);
      fillFrom(oneCell(2, 1), 4, 1);
      openMenu.mockClear();

      expect(tryOpenTableFillBadgeMenuByKey(keyRequest())).toBe(true);
      expect(menuTarget().offer).toEqual({ series: true, date: false });
      act(() => menuTarget().apply('series'));
      expect(textAt(4, 1)).toBe('12');
    });

    /**
     * 🔑 **Το μενού ανοίγει ΠΑΝΩ ΣΤΟ ΚΟΥΜΠΙ, όχι όπου έτυχε να μείνει ο δείκτης.** Αυτό είναι
     * και η απόδειξη ότι η αλυσίδα `πλαίσιο → κόσμος → οθόνη` της παραγωγής
     * (`table-frame-screen.ts`) συμφωνεί με εκείνη που σημαδεύει το πάτημα — δηλαδή ότι η
     * εξαγωγή της από τον test helper δεν άφησε δύο μηχανές.
     */
    it('🔑 αγκυρώνεται στο ΚΕΝΤΡΟ του ζωγραφισμένου κουμπιού', () => {
      mount();
      navigateTo(2, 1);
      fillFrom(oneCell(2, 1), 4, 1);
      openMenu.mockClear();

      tryOpenTableFillBadgeMenuByKey(keyRequest());
      const expected = tableFillBadgeScreenPoint(entity, getTableFillBadge()!.filled);
      expect(menuPoint().x).toBeCloseTo(expected.x, 6);
      expect(menuPoint().y).toBeCloseTo(expected.y, 6);
    });

    it('χωρίς κουμπί δεν καταναλώνει το πλήκτρο', () => {
      mount();
      navigateTo(2, 1);
      expect(tryOpenTableFillBadgeMenuByKey(keyRequest())).toBe(false);
      expect(openMenu).not.toHaveBeenCalled();
    });
  });

  describe('🔴 ο φρουρός ζωής — χωρίς ρολόι, χωρίς ακυρωτές', () => {
    it('🔴 έξοδος από τον πίνακα (`Esc` / αποεπιλογή) σβήνει το κουμπί ΟΡΙΣΤΙΚΑ', () => {
      mount();
      navigateTo(2, 1);
      fillFrom(oneCell(2, 1), 4, 1);
      expect(getTableFillBadge()).not.toBeNull();

      act(() => closeTableCellCursor());
      // Το ουσιώδες είναι το **οριστικά**: χωρίς τον φρουρό, το store θα κρατούσε το κουμπί και
      // η επόμενη είσοδος στον ίδιο πίνακα (ίδιο μοντέλο!) θα το **ανάσταινε** πάνω από μια
      // συμπλήρωση που κανείς δεν θυμάται.
      expect(getTableFillBadge()).toBeNull();
    });

    it('🔴 μετάβαση σε ΑΛΛΟΝ πίνακα σβήνει το κουμπί', () => {
      mount();
      navigateTo(2, 1);
      fillFrom(oneCell(2, 1), 4, 1);

      act(() => setTableCellCursor('table-2', tableCursorAt(rowId(0), colId(0)), 'nav'));
      expect(getTableFillBadge()).toBeNull();
    });
  });
});
