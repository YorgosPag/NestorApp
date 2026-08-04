/**
 * 🔴 ADR-754 **§14.9** — **ΠΙΑΝΩ ΤΗ ΛΑΒΗ, ΣΕΡΝΩ, ΚΑΙ ΤΑ ΚΕΛΙΑ ΓΕΜΙΖΟΥΝ.**
 *
 * ## Γιατί αυτό το αρχείο υπάρχει: ο φρουρός είχε **ΜΗΔΕΝ** tests, και ο δείκτης ψευδόταν
 * Η καθαρή γεωμετρία (`table-fill-handle.test.ts`) και η καθαρή εφαρμογή (`table-fill-apply`)
 * ήταν **πράσινες με 2.001 tests** ενώ στην οθόνη **δεν γέμιζε ποτέ τίποτα**: ο
 * `tryTableFillHandleMouseDown` καλούσε το `tableWorldToFrame` με **τέσσερα** ορίσματα σε
 * συνάρτηση **τριών** ⇒ `{ u: NaN, v: NaN }` ⇒ `false` σε κάθε πάτημα, ενώ ο δείκτης —που περνά
 * από άλλη, σωστή κλήση— υποσχόταν `fill-handle`. **Πρώτη παραβίαση του ADR-739 §31** («ο
 * δείκτης δεν ψεύδεται») στο έργο.
 *
 * Είναι, τέταρτη φορά, το ίδιο σχήμα που το έργο έχει ήδη πληρώσει (§26.15, §27.16 Ε6, §29.15):
 * **το σφάλμα ζει στη συνάντηση των κομματιών**. Γι' αυτό εδώ δεν καλείται καμία καθαρή
 * συνάρτηση: στήνεται ο **πραγματικός** ακροατής πάνω σε **πραγματική** οντότητα, το πάτημα
 * σημαδεύει το **ζωγραφισμένο** τετράγωνο, και η μέτρηση γίνεται στο **μοντέλο** που φτάνει στο
 * commit — δηλαδή στο μόνο πράγμα που ο χρήστης θα δει.
 *
 * ## 🔴 Ο ΔΙΑΧΩΡΙΣΤΗΣ — και τον βρήκε ο ιδιοκτήτης, όχι το όργανο
 * Η **κατακόρυφη** σύρση της λαβής και η **σύρση-επιλογής** δίνουν *ταυτόσημη* ορατή έκβαση:
 * μαρκαρισμένη μία στήλη κελιών. Ένα ζωντανό όργανο που κοιτούσε την επιλογή δήλωσε «δουλεύει»
 * ενώ δεν δούλευε (§14.9.1, ανακλήθηκε). Τα ξεχωρίζουν **δύο** πράγματα, και τα δοκιμάζουμε
 * **και τα δύο**:
 *
 *  1. **τι γράφτηκε στο μοντέλο** — η σύρση-επιλογής δεν γράφει μοντέλο **ποτέ**·
 *  2. **η διαγώνιος** — η συμπλήρωση κλειδώνει **έναν** άξονα (§13.1), η επιλογή φτιάχνει
 *     ορθογώνιο σε **δύο**.
 *
 * «Δουλεύει» δεν είναι μέτρηση μέχρι να ξέρεις τι **άλλο** θα έδινε το ίδιο σήμα.
 *
 * ## ⚠️ Τι ΔΕΝ αποδεικνύει αυτό το αρχείο, ρητά
 * Το jsdom δεν κάνει διάταξη, άρα ο **στόχος** του `mousedown` τον δηλώνει το test (`canvas`)
 * αντί να τον βρει το `elementFromPoint`. Δηλαδή εδώ **δεν** ελέγχεται αν το `<textarea>` της
 * συνεδρίας σκεπάζει τη λαβή στην πραγματική οθόνη — αυτό το απάντησε ζωντανή μέτρηση (§14.9).
 * Ό,τι κλειδώνει εδώ είναι η **διαδρομή** από το πάτημα ως το μοντέλο.
 *
 * ⚠️ Πλέγμα **5×5**, όπως κάθε test αυτού του ADR (§1.2).
 *
 * @see ui/table-cell-editor/table-fill-handle-drag.ts — ο φρουρός που ελέγχεται
 * @see ui/table-cell-editor/__tests__/table-point-mode-pointer.test.tsx — το αδελφό δίχτυ,
 *   ίδιο σχήμα harness για την **τέταρτη** χειρονομία (υπόδειξη κελιού μέσα σε τύπο)
 */

import React, { useRef } from 'react';
import { act, render } from '@testing-library/react';
import { buildTableEntity } from '../../../bim/table/build-table-entity';
import {
  TABLE_TEST_VIEW,
  tableCellScreenPoint,
  tableFillHandleScreenPoint,
} from './table-screen-point';
import { tableCursorAt } from '../../../bim/table/table-cell-navigation';
import { writeCellInput } from '../../../bim/table/formula/table-formula-engine';
import { getPersistedCellText } from '../../../bim/table/table-model-helpers';
import {
  __resetTableCellCursorStoreForTests,
  getTableCellCursor,
  setTableCellCursor,
  setTableCellSelection,
  useTableCellCursor,
} from '../../../state/table-cell-cursor-store';
import {
  __resetTableCellSessionFocusForTests,
  TABLE_CELL_SESSION_MARKER,
} from '../table-cell-session-focus';
import { useTableCellPointer } from '../use-table-cell-pointer';
import type { TableCellRangeBounds } from '../../../bim/table/table-cell-range';
import type { PersistedTableModel } from '../../../types/table';
import type { TableEntity } from '../../../types/table-entity';
import type { Point2D, ViewTransform } from '../../../rendering/types/Types';

const { transform: TRANSFORM, viewport: VIEWPORT } = TABLE_TEST_VIEW;

interface HarnessProps {
  readonly entity: TableEntity;
  readonly onCommitModel: (entity: TableEntity, model: PersistedTableModel) => void;
}

/**
 * Ο ελάχιστος πιστός κόσμος: το δοχείο του καμβά με τον **πραγματικό** ακροατή, και από πάνω του
 * το πεδίο της συνεδρίας — που στην παραγωγή υπάρχει και σε `nav`, άρα οφείλει να υπάρχει κι εδώ.
 */
function FillHandleHarness(props: HarnessProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const transformRef = useRef<ViewTransform>(TRANSFORM);
  const cursor = useTableCellCursor();

  useTableCellPointer({
    cursor,
    entity: props.entity,
    liveTable: () => props.entity,
    containerRef,
    transformRef,
    onSelectTo: () => undefined,
    onSelectAll: () => undefined,
    onCommitPending: () => undefined,
    onPreviewModel: () => undefined,
    onCommitModel: props.onCommitModel,
  });

  return (
    <div ref={containerRef} data-testid="canvas">
      {cursor ? (
        <textarea
          key={`${cursor.entityId}:${cursor.position.rowId}:${cursor.position.colId}:${cursor.sessionId}`}
          value={cursor.draft}
          onChange={() => undefined}
          {...TABLE_CELL_SESSION_MARKER}
        />
      ) : null}
    </div>
  );
}

describe('🔴 ADR-754 §14.9 — η λαβή συμπλήρωσης, από το πάτημα ως το μοντέλο', () => {
  let entity: TableEntity;
  let onCommitModel: jest.Mock;
  let canvas: HTMLElement;

  /** Το ενιαίο κελί ως περιοχή — η μορφή που ζητά η γεωμετρία της λαβής. */
  const oneCell = (row: number, col: number): TableCellRangeBounds =>
    ({ firstRow: row, lastRow: row, firstCol: col, lastCol: col });

  const rowId = (index: number): string => entity.model.rows[index].id;
  const colId = (index: number): string => entity.model.columns[index].id;

  /** Το κείμενο ενός κελιού στο **μοντέλο που παραδόθηκε στο commit**. */
  const filledText = (row: number, col: number): string => {
    const model = onCommitModel.mock.calls.at(-1)?.[1] as PersistedTableModel | undefined;
    if (!model) throw new Error('Κανένα commit μοντέλου — η συμπλήρωση δεν εκτελέστηκε');
    return getPersistedCellText(model, rowId(row), colId(col));
  };

  /** Ο χρήστης έχει το κελί ενεργό, σε **πλοήγηση** — η μόνη κατάσταση όπου ζει η λαβή. */
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
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });
  }

  /** Η ολόκληρη χειρονομία: πιάσε τη λαβή της περιοχής, σύρε ως το κελί, άσε. */
  function fillFrom(source: TableCellRangeBounds, toRow: number, toCol: number): void {
    pressOn(tableFillHandleScreenPoint(entity, source));
    dragOver(tableCellScreenPoint(entity, toRow, toCol));
    release();
  }

  /** Γράψε κείμενο σε κελί **πριν** το mount — το μοντέλο είναι immutable, η οντότητα νέα. */
  function type(row: number, col: number, text: string): void {
    entity = { ...entity, model: writeCellInput(entity.model, rowId(row), colId(col), text) };
  }

  /**
   * 🔴 **ΤΟ MOUNT ΕΙΝΑΙ ΡΗΤΟ, ΚΑΙ ΕΙΝΑΙ ΔΙΟΡΘΩΣΗ.**
   *
   * Το `render` ζούσε στο `beforeEach`, οπότε κάθε test που ήθελε άλλο περιεχόμενο έκανε
   * **δεύτερο** `render` — και το `pressOn` συνέχιζε να χτυπά τον container του **πρώτου**,
   * δηλαδή ο φρουρός έτρεχε με το **παλιό** μοντέλο. Ένα test πέρασε έτσι για **λάθος λόγο**
   * (έλεγχε τιμή που υπήρχε ήδη και στα δύο μοντέλα) — ακριβώς το σχήμα «πράσινο που δεν
   * δοκιμάζει τίποτα» του §1.3. Τώρα το στήσιμο τελειώνει **πριν** το mount, και το mount
   * γίνεται **μία** φορά ανά test.
   */
  function mount(): void {
    const view = render(<FillHandleHarness entity={entity} onCommitModel={onCommitModel} />);
    canvas = view.getByTestId('canvas');
    canvas.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: VIEWPORT.width, height: VIEWPORT.height }) as DOMRect;
  }

  beforeEach(() => {
    jest.useFakeTimers();
    __resetTableCellCursorStoreForTests();
    __resetTableCellSessionFocusForTests();
    onCommitModel = jest.fn();
    // 5 στήλες × (1 title + 1 header + 3 data) = 5×5.
    entity = buildTableEntity({ x: 0, y: 0 }, { columnCount: 5, dataRowCount: 3 }, 'table-1', 'layer-0');
    // Η πηγή έχει περιεχόμενο· τα κελιά από κάτω είναι **άδεια**. Χωρίς αυτό, «γέμισε» και «δεν
    // έκανε τίποτα» θα ήταν το ίδιο κείμενο και η μέτρηση δεν θα ξεχώριζε τίποτα.
    type(2, 1, 'ΠΑΛΙΟ');
  });

  afterEach(() => {
    jest.useRealTimers();
    __resetTableCellCursorStoreForTests();
    __resetTableCellSessionFocusForTests();
  });

  describe('🔴 ΤΟ ΑΝΟΙΧΤΟ ΤΟΥ §14.9.2 — η συμπλήρωση ΕΚΤΕΛΕΙΤΑΙ', () => {
    it('🔴 σύρσιμο της λαβής δύο γραμμές κάτω ⇒ τα ΔΥΟ άδεια κελιά γέμισαν', () => {
      // Ο αποφασιστικός έλεγχος, αυτούσιος από τη ζωντανή μέτρηση που άνοιξε το §14.9.2: εκεί τα
      // δύο κελιά έμειναν `''`. Η σύρση-επιλογής θα έδινε **ακριβώς** την ίδια ορατή επιλογή —
      // και μηδέν εγγραφή μοντέλου. Γι' αυτό μετριέται το μοντέλο, όχι η επιλογή.
      mount();
      navigateTo(2, 1);
      fillFrom(oneCell(2, 1), 4, 1);

      expect(onCommitModel).toHaveBeenCalledTimes(1);
      expect(filledText(3, 1)).toBe('ΠΑΛΙΟ');
      expect(filledText(4, 1)).toBe('ΠΑΛΙΟ');
    });

    it('🔴 Ο ΔΙΑΧΩΡΙΣΤΗΣ: διαγώνια σύρση κλειδώνει ΕΝΑΝ άξονα — η διαγώνιος μένει άδεια', () => {
      // Η πρόταση του ιδιοκτήτη που άνοιξε το εύρημα: «*στο Excel η λαβή πάει είτε σε γραμμές
      // είτε σε στήλες, ποτέ και στα δύο*». Ισοπαλία υπερβάσεων (2 κάτω, 2 δεξιά) ⇒ κερδίζει ο
      // κατακόρυφος (§13.1). Μια σύρση-**επιλογής** θα κάλυπτε ολόκληρο το ορθογώνιο 3×3, άρα
      // αυτή η γραμμή είναι που ξεχωρίζει τους δύο μηχανισμούς — όχι το πλήθος των κελιών.
      mount();
      navigateTo(2, 1);
      fillFrom(oneCell(2, 1), 4, 3);

      expect(filledText(4, 1)).toBe('ΠΑΛΙΟ');
      expect(filledText(4, 3)).toBe('');
      expect(filledText(2, 3)).toBe('');
    });

    it('πηγή η ΕΠΙΛΟΓΗ και όχι το ενεργό κελί — το μοτίβο επαναλαμβάνεται ολόκληρο', () => {
      // §14: η λαβή κάθεται στη γωνία της **επιλογής**· ο φρουρός του πατήματος οφείλει να
      // διαβάζει την ίδια πηγή με τον ζωγράφο.
      //
      // 🔑 **Το διακριτικό είναι η ΣΕΙΡΑ του μοτίβου, όχι το πλήθος**: ενεργό κελί το **κάτω**
      // (`ΝΕΟ`), επιλογή και τα δύο. Αν ο φρουρός διάβαζε μόνο το **ενεργό κελί**, το γέμισμα θα
      // ξεκινούσε από `ΝΕΟ`. Ξεκινά από `ΠΑΛΙΟ` ⇒ πηγή είναι η **επιλογή**. Με ίδιες τιμές στα
      // δύο κελιά, το test θα ήταν πράσινο και στις δύο περιπτώσεις — δηλαδή τίποτα.
      type(3, 1, 'ΝΕΟ');
      mount();
      navigateTo(3, 1);
      act(() => {
        setTableCellSelection({
          from: { rowId: rowId(2), colId: colId(1) },
          to: { rowId: rowId(3), colId: colId(1) },
          kind: 'range',
        });
      });

      pressOn(tableFillHandleScreenPoint(entity, { firstRow: 2, lastRow: 3, firstCol: 1, lastCol: 1 }));
      dragOver(tableCellScreenPoint(entity, 4, 1));
      release();

      expect(filledText(4, 1)).toBe('ΠΑΛΙΟ');
    });

    it('🔴 ΠΕΡΙΟΧΗ 2×2 + διαγώνια σύρση ⇒ ΕΝΑΣ άξονας, όχι ορθογώνιο σε δύο', () => {
      // Η ρητή αναφορά του ιδιοκτήτη (05/08): «*σε **περιοχές** κινείται σε στήλες ΚΑΙ σε
      // γραμμές*». Πηγή 2 γραμμές × 2 στήλες, χέρι διαγώνια έξω και από τους δύο άξονες.
      // Excel: το πλάτος της πηγής **ταξιδεύει** (2 στήλες γεμίζουν μαζί), αλλά ο άξονας
      // **επέκτασης** είναι ένας — οι στήλες 3-4 δεν αγγίζονται ΠΟΤΕ.
      type(2, 2, 'ΔΕΞΙΑ');
      mount();
      navigateTo(2, 1);
      act(() => {
        setTableCellSelection({
          from: { rowId: rowId(2), colId: colId(1) },
          to: { rowId: rowId(3), colId: colId(2) },
          kind: 'range',
        });
      });

      // ⚠️ Το σημείο απελευθέρωσης είναι **μέτρηση, όχι γούστο**: στο `(4,4)` η υπέρβαση είναι
      // 1 γραμμή έναντι **2 στηλών**, οπότε κερδίζει —σωστά— ο **οριζόντιος** άξονας. Για να
      // δοκιμαστεί το «κάτω» χρειάζεται **ισοπαλία**: το `(4,3)` δίνει 1 και 1 (§13.1: στην
      // ισοπαλία κερδίζει ο κατακόρυφος). Η πρώτη γραφή αυτού του test το είχε λάθος και το
      // κόκκινο το έπιασε — αξίζει να μείνει γραμμένο.
      pressOn(tableFillHandleScreenPoint(entity, { firstRow: 2, lastRow: 3, firstCol: 1, lastCol: 2 }));
      dragOver(tableCellScreenPoint(entity, 4, 3));
      release();

      // Το πλάτος της πηγής ταξιδεύει προς τα κάτω — **δύο** στήλες μαζί, όπως στο Excel…
      expect(filledText(4, 1)).toBe('ΠΑΛΙΟ');
      expect(filledText(4, 2)).toBe('ΔΕΞΙΑ');
      // …αλλά ο δεύτερος άξονας ΔΕΝ επεκτάθηκε: η στήλη 3 μένει άθικτη σε **κάθε** γραμμή.
      expect(filledText(2, 3)).toBe('');
      expect(filledText(4, 3)).toBe('');
    });
  });

  describe('🔴 ΟΙ ΑΡΝΗΣΕΙΣ — πότε το πάτημα σημαίνει ό,τι σήμαινε πάντα', () => {
    it('🔴 πάτημα στο ΚΕΝΤΡΟ του κελιού ⇒ καμία συμπλήρωση, ο δρομέας μετακινείται', () => {
      // Η μη-παλινδρόμηση, και είναι η μισή προδιαγραφή: ένας φρουρός που καταναλώνει κάθε
      // πάτημα μέσα στην επιλογή θα έκανε τον πίνακα ανώφελο — δεν θα άλλαζες πια κελί με το
      // ποντίκι. Ο δρομέας **οφείλει** να φτάσει στο κελί που πατήθηκε.
      mount();
      navigateTo(2, 1);
      pressOn(tableCellScreenPoint(entity, 4, 1));
      release();

      expect(onCommitModel).not.toHaveBeenCalled();
      expect(getTableCellCursor()?.position.rowId).toBe(rowId(4));
    });

    it('🔴 σε ΓΡΑΦΗ η λαβή δεν πιάνεται (Excel parity, §13.5)', () => {
      // Ο ίδιος φρουρός που έχουν ο ζωγράφος και ο δείκτης: όσο ο χρήστης πληκτρολογεί, η λαβή
      // ούτε ζωγραφίζεται ούτε πιάνεται. Αν πιανόταν, ο χρήστης θα έχανε ό,τι έγραφε πατώντας
      // ένα τετραγωνάκι που **δεν βλέπει**.
      mount();
      act(() => {
        setTableCellCursor(entity.id, tableCursorAt(rowId(2), colId(1)), 'edit', '777');
      });
      fillFrom(oneCell(2, 1), 4, 1);

      expect(onCommitModel).not.toHaveBeenCalled();
    });

    it('σύρσιμο που δεν βγήκε από την πηγή ⇒ τίποτα δεν γράφεται', () => {
      // `resolveTableFillTarget` απαντά `null` όσο το χέρι είναι **μέσα** στην πηγή· η σιωπή
      // είναι η σωστή απάντηση, όχι «γέμισε την ίδια σου την επιλογή».
      mount();
      navigateTo(2, 1);
      pressOn(tableFillHandleScreenPoint(entity, oneCell(2, 1)));
      release();

      expect(onCommitModel).not.toHaveBeenCalled();
    });
  });
});
