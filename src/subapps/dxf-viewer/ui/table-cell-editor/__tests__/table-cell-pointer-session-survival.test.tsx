/**
 * 🔴 ADR-739 §26.15 — **ΤΟ ΚΛΙΚ ΣΤΟΝ ΚΑΜΒΑ ΔΕΝ ΚΛΕΙΝΕΙ ΤΗ ΣΥΝΕΔΡΙΑ ΠΙΝΑΚΑ.**
 *
 * Ζωντανά μετρήθηκε το αντίθετο: **11/11** κλικ μέσα στον πίνακα σκότωναν τη λειτουργία,
 * με μηδενική διακύμανση — και τα δύο πράγματα που υπόσχεται το §26 (απλό κλικ μετακινεί
 * το ενεργό κελί, `Shift+κλικ` δίνει τη δεύτερη γωνία) ήταν **μη εκτελέσιμα**. Το θετικό
 * control της ίδιας μέτρησης (κλικ στη **γραμμή τύπων** ⇒ η συνεδρία ζει) απέδειξε ότι ο
 * μηχανισμός συνεδρίας ήταν υγιής· έλειπε **ένας** δρόμος από τον φύλακα εστίασης.
 *
 * ## Γιατί κανένα από τα 603 tests του βήματος 8 δεν το είδε
 * Ο `use-table-cell-pointer` δοκιμαζόταν **μόνος του** (`table-header-menu.test.tsx`,
 * «αριστερό κλικ στη ζώνη»): έγραφε στο store, το store έλεγε το σωστό, πράσινο. Ο φύλακας
 * `useTableCellSessionBlur` δοκιμαζόταν **μόνος του** (`table-cell-session-focus.test.tsx`):
 * τέσσερις δρόμοι, όλοι σωστοί, πράσινο. Το σφάλμα ζούσε **αποκλειστικά στη συνάντησή τους**
 * — στη σειρά με την οποία ο browser εκτελεί `mousedown` → μεταφορά εστίασης → `blur` → καρέ.
 * Γι' αυτό αυτό το αρχείο τρέχει **και τα δύο μαζί**, πάνω σε **πραγματική** οντότητα και
 * **πραγματικό** `<textarea autoFocus>` που ξαναστήνεται με το ίδιο `key` της παραγωγής.
 *
 * ## 🔴 Το ένα βήμα που το jsdom ΔΕΝ κάνει, και γράφεται ρητά
 * Η μεταφορά της εστίασης **δεν** είναι δική μας ενέργεια: είναι η **προεπιλεγμένη ενέργεια**
 * του `mousedown`, που τρέχει **μετά** τους ακροατές — γι' αυτό ούτε ο ακροατής σύλληψης
 * μπορεί να την προλάβει, ούτε ένα `focus()` μέσα στον ίδιο χειριστή επιβιώνει. Το jsdom δεν
 * την υλοποιεί, οπότε ο έλεγχος τη γράφει **ονομαστικά** (`blurActiveElement`) αντί να την
 * κρύψει: αν κάποτε αλλάξει η σειρά, θέλουμε να φαίνεται στο test, όχι να σιωπά.
 *
 * @see ui/table-cell-editor/table-cell-session-focus.ts — ο φύλακας και οι τρεις εκβάσεις
 * @see ui/table-cell-editor/use-table-cell-pointer.ts — ποιος δηλώνει «το κλικ είναι δικό μου»
 */

import React, { useRef } from 'react';
import { act, render } from '@testing-library/react';
import { CoordinateTransforms } from '../../../rendering/core/CoordinateTransforms';
import { buildTableEntity } from '../../../bim/table/build-table-entity';
import {
  computeTableEntityGeometryLive,
  tableFrameToWorld,
  tablePxPerMm,
} from '../../../bim/table/table-entity-geometry';
import { tableIndicatorBandsMm } from '../../../bim/table/table-indicator-geometry';
import { tableCursorAt } from '../../../bim/table/table-cell-navigation';
import {
  __resetTableCellCursorStoreForTests,
  closeTableCellCursor,
  getTableCellCursor,
  restartTableCellCursorSession,
  setTableCellCursor,
  useTableCellCursor,
} from '../../../state/table-cell-cursor-store';
import {
  __resetTableCellSessionFocusForTests,
  isTableCellSessionElement,
  TABLE_CELL_SESSION_MARKER,
  useTableCellSessionBlur,
} from '../table-cell-session-focus';
import { useTableCellPointer } from '../use-table-cell-pointer';
import type { TableCellRef } from '../../../bim/table/table-cell-range';
import type { TableEntity } from '../../../types/table-entity';
import type { ViewTransform } from '../../../rendering/types/Types';

const VIEWPORT = { width: 1200, height: 800 };
const TRANSFORM: ViewTransform = { scale: 1, offsetX: 0, offsetY: 0 };

interface HarnessProps {
  readonly entity: TableEntity;
  readonly onCommit: () => void;
  readonly onSelectTo: (cell: TableCellRef) => void;
  readonly onCommitPending: () => void;
}

/**
 * Ο **ελάχιστος πιστός** κόσμος: ένας καμβάς-δοχείο με τον ακροατή του pointer, και το ένα
 * πεδίο της συνεδρίας από πάνω του.
 *
 * Το `key` είναι **αντιγραφή του παραγωγικού** (`useTableCellDoubleClickEditor`): χωρίς τον
 * αριθμό συνεδρίας μέσα του, ένα κλικ στο **ίδιο** κελί δεν ξαναστήνει τίποτα — και ακριβώς
 * εκεί πέθαινε η συνεδρία, γιατί το `autoFocus` δεν ξανατρέχει ποτέ.
 */
function TableSessionHarness(props: HarnessProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const transformRef = useRef<ViewTransform>(TRANSFORM);
  const cursor = useTableCellCursor();

  useTableCellPointer({
    cursor,
    entity: props.entity,
    containerRef,
    transformRef,
    onSelectTo: props.onSelectTo,
    onCommitPending: props.onCommitPending,
  });

  const handleBlur = useTableCellSessionBlur(
    props.onCommit,
    closeTableCellCursor,
    restartTableCellCursorSession,
  );

  return (
    <div ref={containerRef} data-testid="canvas">
      {cursor ? (
        <textarea
          key={`${cursor.entityId}:${cursor.position.rowId}:${cursor.position.colId}:${cursor.sessionId}`}
          autoFocus
          readOnly
          value=""
          {...TABLE_CELL_SESSION_MARKER}
          onBlur={handleBlur}
        />
      ) : null}
    </div>
  );
}

/** Το σημείο **οθόνης** στο κέντρο ενός κελιού — ολόκληρη η αλυσίδα frame → world → screen. */
function cellScreenPoint(entity: TableEntity, rowIndex: number, colIndex: number) {
  const geometry = computeTableEntityGeometryLive(entity);
  const rowId = entity.model.rows[rowIndex].id;
  const colId = entity.model.columns[colIndex].id;
  const cell = geometry.layout.cells.find((c) => c.rowId === rowId && c.colId === colId);
  if (!cell) throw new Error(`Το κελί ${rowIndex}/${colIndex} δεν υπάρχει στη διάταξη`);
  const world = tableFrameToWorld(
    entity,
    cell.rect.x + cell.rect.w / 2,
    cell.rect.y + cell.rect.h / 2,
    geometry.mmToWorld,
  );
  return CoordinateTransforms.worldToScreen(world, TRANSFORM, VIEWPORT);
}

/** Το σημείο **οθόνης** στο κέντρο της ζώνης δείκτη μιας στήλης (το γράμμα «B»). */
function columnBandScreenPoint(entity: TableEntity, colIndex: number) {
  const geometry = computeTableEntityGeometryLive(entity);
  const bands = tableIndicatorBandsMm(tablePxPerMm(geometry.mmToWorld, TRANSFORM.scale));
  const column = geometry.layout.columns[colIndex];
  const world = tableFrameToWorld(
    entity,
    column.xMm + column.widthMm / 2,
    -bands.columnBandMm / 2,
    geometry.mmToWorld,
  );
  return CoordinateTransforms.worldToScreen(world, TRANSFORM, VIEWPORT);
}

describe('🔴 ADR-739 §26.15 — το κλικ στον καμβά και η συνεδρία πίνακα', () => {
  let entity: TableEntity;
  let onCommit: jest.Mock;
  let onSelectTo: jest.Mock;
  /** Καταγράφει **πού βρισκόταν ο δρομέας** τη στιγμή της δέσμευσης — δες το test της σειράς. */
  let commitPendingAtColumn: (string | undefined)[];
  let onCommitPending: jest.Mock;
  let canvas: HTMLElement;

  beforeEach(() => {
    jest.useFakeTimers();
    __resetTableCellCursorStoreForTests();
    __resetTableCellSessionFocusForTests();
    onCommit = jest.fn();
    onSelectTo = jest.fn();
    commitPendingAtColumn = [];
    onCommitPending = jest.fn(() => {
      commitPendingAtColumn.push(getTableCellCursor()?.position.colId);
    });
    entity = buildTableEntity({ x: 0, y: 0 }, {}, 'table-1', 'layer-0');
    // Ο χρήστης είναι ήδη **μέσα** στον πίνακα (διπλό κλικ / `Enter`) στο κελί A3.
    setTableCellCursor(
      entity.id,
      tableCursorAt(entity.model.rows[2].id, entity.model.columns[0].id),
      'nav',
    );
    const view = render(
      <TableSessionHarness
        entity={entity}
        onCommit={onCommit}
        onSelectTo={onSelectTo}
        onCommitPending={onCommitPending}
      />,
    );
    canvas = view.getByTestId('canvas');
    canvas.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: VIEWPORT.width, height: VIEWPORT.height }) as DOMRect;
  });

  afterEach(() => {
    jest.useRealTimers();
    __resetTableCellCursorStoreForTests();
    __resetTableCellSessionFocusForTests();
  });

  /**
   * Η **προεπιλεγμένη ενέργεια** του `mousedown`, γραμμένη με το χέρι: ο browser εστιάζει τον
   * πλησιέστερο εστιάσιμο πρόγονο του στόχου — πάνω σε καμβά, **κανέναν**. Το jsdom δεν την
   * υλοποιεί. Τρέχει **μετά** τον ακροατή σύλληψης, ακριβώς όπως στον browser.
   */
  function blurActiveElement(): void {
    act(() => {
      (document.activeElement as HTMLElement | null)?.blur();
    });
  }

  function pressOn(
    target: HTMLElement,
    point: { readonly x: number; readonly y: number },
    shiftKey = false,
  ): void {
    act(() => {
      target.dispatchEvent(
        new MouseEvent('mousedown', {
          button: 0,
          clientX: point.x,
          clientY: point.y,
          shiftKey,
          bubbles: true,
        }),
      );
    });
    blurActiveElement();
  }

  /** Το καρέ στο οποίο ο φύλακας παίρνει την απόφασή του. */
  function nextFrame(): void {
    act(() => {
      jest.advanceTimersByTime(20);
    });
  }

  it('🔴 κλικ στο ΙΔΙΟ κελί ⇒ η συνεδρία ζει ΚΑΙ ξαναέχει το πληκτρολόγιο', () => {
    // Το αποφασιστικό πείραμα του §1.1: δεν υπάρχει μετακίνηση, δεν υπάρχει hit-test να
    // κατηγορήσεις, δεν υπάρχει νέο κελί. Αν πεθαίνει **αυτό**, φταίει ο φύλακας και μόνο.
    pressOn(canvas, cellScreenPoint(entity, 2, 0));
    nextFrame();

    expect(getTableCellCursor()).not.toBeNull();
    // 🔴 Το ουσιώδες: «ζωντανή αλλά κουφή» δεν είναι ζωντανή. Ο δομικός φύλακας
    // `isTextEntryTarget` κοιτά **εστιασμένο πεδίο**, όχι κατάσταση store.
    expect(isTableCellSessionElement(document.activeElement)).toBe(true);
  });

  it('🔴 κλικ σε ΑΛΛΟ κελί ⇒ η συνεδρία ζει και ο δρομέας μετακινήθηκε εκεί', () => {
    pressOn(canvas, cellScreenPoint(entity, 2, 2));
    nextFrame();

    const cursor = getTableCellCursor();
    expect(cursor).not.toBeNull();
    expect(cursor?.position.rowId).toBe(entity.model.rows[2].id);
    expect(cursor?.position.colId).toBe(entity.model.columns[2].id);
    expect(isTableCellSessionElement(document.activeElement)).toBe(true);
  });

  it('🔴 `Shift+κλικ` ⇒ η συνεδρία ζει και δίνεται η δεύτερη γωνία της περιοχής', () => {
    pressOn(canvas, cellScreenPoint(entity, 3, 2), true);
    nextFrame();

    expect(getTableCellCursor()).not.toBeNull();
    expect(onSelectTo).toHaveBeenCalledWith({
      rowId: entity.model.rows[3].id,
      colId: entity.model.columns[2].id,
    });
    expect(isTableCellSessionElement(document.activeElement)).toBe(true);
  });

  it('🔴 κλικ στη ζώνη δείκτη (το γράμμα της στήλης) ⇒ η συνεδρία ζει', () => {
    // Βήμα 9: η ζώνη είναι επιφάνεια **επιλογής**. Πεθαίνει από την ίδια αιτία — μία
    // διόρθωση, όχι δύο.
    pressOn(canvas, columnBandScreenPoint(entity, 1));
    nextFrame();

    // Ρητά **δύο** ισχυρισμοί και όχι `?.selection`: σε κλειστή συνεδρία η αλυσίδα δίνει
    // `undefined`, που περνά αθόρυβα από ένα `not.toBeNull()` — δηλαδή το test θα έβαφε
    // πράσινο ακριβώς το σφάλμα που μετρά.
    expect(getTableCellCursor()).not.toBeNull();
    expect(getTableCellCursor()?.selection).not.toBeNull();
    expect(isTableCellSessionElement(document.activeElement)).toBe(true);
  });

  it('✅ κλικ ΕΞΩ από τον πίνακα ⇒ η συνεδρία ΚΛΕΙΝΕΙ (η μη-παλινδρόμηση)', () => {
    // Η μισή προδιαγραφή. Μια «διόρθωση» που κρατά τη συνεδρία ζωντανή σε **κάθε** κλικ
    // είναι χειρότερη από το σφάλμα: ο χρήστης δεν μπορεί πια να βγει από τον πίνακα.
    pressOn(canvas, { x: 1100, y: 700 });
    nextFrame();

    expect(getTableCellCursor()).toBeNull();
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  /**
   * 🔴 **Η ΣΕΙΡΑ ΕΙΝΑΙ ΤΟ ΣΥΜΒΟΛΑΙΟ** — γραμμένη ήδη στο `use-table-cell-session-keys`:
   * «πρώτα δεσμεύεται το πρόχειρο, μετά μετακινείται ο δρομέας». Το πληκτρολόγιο την τηρεί
   * (`case 'move': commit(); onMove(…)`)· το ποντίκι την **παραβίαζε**.
   *
   * Το τίμημα δεν είναι θεωρητικό: το `setTableCellCursor` **σβήνει το πρόχειρο**, οπότε τη
   * στιγμή που θα ερχόταν το commit του `blur` (ένα βήμα αργότερα, από την προεπιλεγμένη
   * ενέργεια του browser) το κείμενο **δεν υπάρχει πια** — και μάλιστα ο επεξεργαστής έχει
   * ήδη ξαναστηθεί σε κατάσταση `nav`, όπου το commit είναι εξ ορισμού σιωπηλό. Δηλαδή
   * πληκτρολογείς, κλικάρεις δίπλα, και η δουλειά σου **εξαφανίζεται χωρίς μήνυμα**.
   */
  describe('🔴 πρώτα δέσμευση, μετά μετακίνηση — το κλικ δεν τρώει την πληκτρολόγηση', () => {
    function startWriting(): void {
      act(() => {
        setTableCellCursor(
          entity.id,
          tableCursorAt(entity.model.rows[2].id, entity.model.columns[0].id),
          'enter',
          '777',
        );
      });
    }

    it('🔴 κλικ σε άλλο κελί ⇒ το πρόχειρο δεσμεύεται ΠΡΙΝ φύγει ο δρομέας', () => {
      startWriting();
      pressOn(canvas, cellScreenPoint(entity, 2, 2));

      expect(onCommitPending).toHaveBeenCalledTimes(1);
      // Ο έλεγχος της **σειράς**, όχι μόνο της κλήσης: τη στιγμή της δέσμευσης ο δρομέας
      // ήταν ακόμα στο κελί που αφήνεις. Αλλιώς το κείμενο θα γραφόταν στο ΝΕΟ κελί —
      // σιωπηλή αλλοίωση δεδομένων, χειρότερη από την απώλεια.
      expect(commitPendingAtColumn).toEqual([entity.model.columns[0].id]);
    });

    it('🔴 κλικ στη ζώνη δείκτη ⇒ το ίδιο (μετακινεί κι αυτό το ενεργό κελί)', () => {
      startWriting();
      pressOn(canvas, columnBandScreenPoint(entity, 1));

      expect(onCommitPending).toHaveBeenCalledTimes(1);
      expect(commitPendingAtColumn).toEqual([entity.model.columns[0].id]);
    });

    it('`Shift+κλικ` ΔΕΝ δεσμεύει — η επέκταση περιοχής δεν αγγίζει το μοντέλο', () => {
      // Συμμετρικά με το `case 'extend'` του πληκτρολογίου, που τεκμηριώνει ρητά γιατί εκεί
      // **δεν** υπάρχει `commit()`: η περιοχή είναι κατάσταση διεπαφής.
      startWriting();
      pressOn(canvas, cellScreenPoint(entity, 3, 2), true);

      expect(onCommitPending).not.toHaveBeenCalled();
    });

    it('κλικ ΕΞΩ από τον πίνακα ΔΕΝ δεσμεύει από εδώ — το αναλαμβάνει ο φύλακας', () => {
      // Δύο δρόμοι δέσμευσης για την ίδια χειρονομία θα ήταν δύο διαδρομές εγγραφής.
      startWriting();
      pressOn(canvas, { x: 1100, y: 700 });

      expect(onCommitPending).not.toHaveBeenCalled();
      expect(onCommit).toHaveBeenCalledTimes(1);
    });
  });

  it('το κλικ πάνω στο ΙΔΙΟ το πεδίο της συνεδρίας δεν είναι κλικ «στον καμβά»', () => {
    // Σε γραφή το `<textarea>` σκεπάζει το κελί: το κλικ μέσα στο κείμενο που γράφεις είναι
    // **τοποθέτηση κέρσορα**. Ο ακροατής σύλληψης το βλέπει (ζει στο ίδιο δοχείο) και, χωρίς
    // φύλακα, θα το ερμήνευε ως «κλικ στο κελί» ⇒ θα γύριζε τη συνεδρία σε `nav`, δηλαδή θα
    // σου έκοβε τη γραφή τη στιγμή που πας να διορθώσεις ένα γράμμα.
    act(() => {
      setTableCellCursor(
        entity.id,
        tableCursorAt(entity.model.rows[2].id, entity.model.columns[0].id),
        'edit',
        '777',
      );
    });
    const field = document.querySelector('[data-table-cell-cursor="true"]') as HTMLElement;

    act(() => {
      field.dispatchEvent(
        new MouseEvent('mousedown', {
          button: 0,
          ...cellScreenPointAsClient(entity, 2, 0),
          bubbles: true,
        }),
      );
    });

    expect(getTableCellCursor()?.mode).toBe('edit');
    expect(getTableCellCursor()?.draft).toBe('777');
  });
});

/** Το ίδιο σημείο, με τα ονόματα που θέλει ο `MouseEvent`. */
function cellScreenPointAsClient(entity: TableEntity, rowIndex: number, colIndex: number) {
  const point = cellScreenPoint(entity, rowIndex, colIndex);
  return { clientX: point.x, clientY: point.y };
}
