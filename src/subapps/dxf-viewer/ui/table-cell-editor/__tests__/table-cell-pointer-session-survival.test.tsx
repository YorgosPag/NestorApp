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
import { buildTableEntity } from '../../../bim/table/build-table-entity';
// ADR-739 Φ.Δ βήμα 9 — η ΜΙΑ προβολή «σημείο πίνακα → pixel» των tests (N.18· δες την
// κεφαλίδα του βοηθού για τα τρία αντίγραφα που αντικατέστησε).
import {
  TABLE_TEST_VIEW,
  tableBandScreenPoint,
  tableCellScreenPoint,
} from './table-screen-point';
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
import { resolveTableSelectionBounds, type TableCellRef } from '../../../bim/table/table-cell-range';
import type { TableEntity } from '../../../types/table-entity';
import type { ViewTransform } from '../../../rendering/types/Types';

// Η ΙΔΙΑ προβολή που χρησιμοποιεί ο βοηθός `table-screen-point` — δύο αντίγραφα εδώ θα
// σήμαιναν ότι το test πατά αλλού απ' ό,τι υπολόγισε, χωρίς κανένα ίχνος.
const { transform: TRANSFORM, viewport: VIEWPORT } = TABLE_TEST_VIEW;

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
const cellScreenPoint = tableCellScreenPoint;

/** Το σημείο **οθόνης** στο κέντρο της ζώνης δείκτη μιας στήλης (το γράμμα «B»). */
const columnBandScreenPoint = (entity: TableEntity, colIndex: number) =>
  tableBandScreenPoint(entity, 'column', colIndex);

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
    /** ADR-739 §27.14 — `2` = δεξί πλήκτρο. Ίδια χειρονομία, ίδια συνέπεια στην εστίαση. */
    button = 0,
  ): void {
    act(() => {
      target.dispatchEvent(
        new MouseEvent('mousedown', {
          button,
          clientX: point.x,
          clientY: point.y,
          shiftKey,
          bubbles: true,
        }),
      );
    });
    blurActiveElement();
  }

  /** Δεξί πάτημα — αυτό που προηγείται κάθε `contextmenu`. */
  const rightPressOn = (
    target: HTMLElement,
    point: { readonly x: number; readonly y: number },
  ): void => pressOn(target, point, false, 2);

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

  /**
   * 🔴 ADR-739 §27.16 Ε2 — **`Shift+κλικ` σε δεύτερο γράμμα/αριθμό**.
   *
   * Excel: κλικ στο «A», `Shift+κλικ` στο «C» ⇒ **τρεις ολόκληρες στήλες**. Ελέγχεται στον
   * **ζωντανό** χειριστή και όχι μόνο στην καθαρή συνάρτηση, γιατί ακριβώς εκεί κρύφτηκε το
   * σφάλμα του §27.15: «το anchor που ελέγχει το store δεν ελέγχει τι βλέπει ο χρήστης».
   * Γι' αυτό το κρίσιμο test ρωτά τα **ΟΡΙΑ** μέσα από τον ΕΝΑ δρόμο ερμηνείας.
   */
  describe('🔴 §27.16 Ε2 — Shift+κλικ σε δεύτερο γράμμα/αριθμό', () => {
    /** Τα κελιά που πραγματικά θα μαρκαριστούν — η ερώτηση του **χρήστη**, όχι του store. */
    function selectedBounds() {
      const selection = getTableCellCursor()?.selection;
      return selection ? resolveTableSelectionBounds(entity.model, selection) : null;
    }

    it('🔴 κλικ στο «A» → Shift+κλικ στο «C» ⇒ ΤΡΕΙΣ ολόκληρες στήλες', () => {
      pressOn(canvas, columnBandScreenPoint(entity, 0));
      nextFrame();
      pressOn(canvas, columnBandScreenPoint(entity, 2), true);
      nextFrame();

      expect(selectedBounds()).toEqual({
        firstRow: 0,
        lastRow: entity.model.rows.length - 1,
        firstCol: 0,
        lastCol: 2,
      });
    });

    it('🔴 προς τα ΠΙΣΩ: κλικ στο «C» → Shift+κλικ στο «A» ⇒ οι ίδιες τρεις στήλες', () => {
      pressOn(canvas, columnBandScreenPoint(entity, 2));
      nextFrame();
      pressOn(canvas, columnBandScreenPoint(entity, 0), true);
      nextFrame();

      expect(selectedBounds()).toEqual({
        firstRow: 0,
        lastRow: entity.model.rows.length - 1,
        firstCol: 0,
        lastCol: 2,
      });
    });

    it('🔴 το ΕΝΕΡΓΟ ΚΕΛΙ δεν κουνιέται και ΤΙΠΟΤΑ δεν δεσμεύεται — η επέκταση δεν είναι κίνηση', () => {
      pressOn(canvas, columnBandScreenPoint(entity, 0));
      nextFrame();
      const anchorCell = getTableCellCursor()?.position;
      onCommitPending.mockClear();

      pressOn(canvas, columnBandScreenPoint(entity, 2), true);
      nextFrame();

      expect(getTableCellCursor()?.position).toEqual(anchorCell);
      expect(onCommitPending).not.toHaveBeenCalled();
    });

    it('η ΑΓΚΥΡΑ μένει στην πρώτη στήλη που πατήθηκε, το είδος μένει `column`', () => {
      pressOn(canvas, columnBandScreenPoint(entity, 0));
      nextFrame();
      pressOn(canvas, columnBandScreenPoint(entity, 2), true);
      nextFrame();

      const selection = getTableCellCursor()?.selection;
      expect(selection?.from.colId).toBe(entity.model.columns[0].id);
      expect(selection?.kind).toBe('column');
    });

    it('🔴 ΧΩΡΙΣ προηγούμενη επιλογή άξονα, το Shift+κλικ γίνεται σκέτο κλικ — καμία εφεύρεση', () => {
      // Ο δρομέας ξεκινά σε **κελί** (καμία επιλογή στήλης). Ένα `Shift+κλικ` στο «C» δεν
      // έχει άγκυρα ίδιου είδους να επεκτείνει ⇒ νέα επιλογή **μόνο** της στήλης C.
      pressOn(canvas, columnBandScreenPoint(entity, 2), true);
      nextFrame();

      expect(selectedBounds()).toEqual({
        firstRow: 0,
        lastRow: entity.model.rows.length - 1,
        firstCol: 2,
        lastCol: 2,
      });
    });

    it('🔴 επιλογή ΣΤΗΛΗΣ + Shift+κλικ σε ΑΡΙΘΜΟ γραμμής ⇒ σκέτο κλικ (άλλος άξονας, καμία ανάμειξη)', () => {
      pressOn(canvas, columnBandScreenPoint(entity, 0));
      nextFrame();
      pressOn(canvas, tableBandScreenPoint(entity, 'row', 2), true);
      nextFrame();

      const selection = getTableCellCursor()?.selection;
      expect(selection?.kind).toBe('row');
      expect(selectedBounds()).toEqual({
        firstRow: 2,
        lastRow: 2,
        firstCol: 0,
        lastCol: entity.model.columns.length - 1,
      });
    });

    it('γραμμές: κλικ στο «1» → Shift+κλικ στο «3» ⇒ τρεις ολόκληρες γραμμές', () => {
      pressOn(canvas, tableBandScreenPoint(entity, 'row', 0));
      nextFrame();
      pressOn(canvas, tableBandScreenPoint(entity, 'row', 2), true);
      nextFrame();

      expect(selectedBounds()).toEqual({
        firstRow: 0,
        lastRow: 2,
        firstCol: 0,
        lastCol: entity.model.columns.length - 1,
      });
    });
  });

  describe('🔴 §27.14 — ΤΟ ΔΕΞΙ ΚΛΙΚ ΕΙΝΑΙ ΚΙ ΑΥΤΟ ΧΕΙΡΟΝΟΜΙΑ ΤΗΣ ΣΥΝΕΔΡΙΑΣ', () => {
    /**
     * Ο Giorgio: «δεξί κλικ στις λωρίδες ⇒ εμφανίζεται το μενού του **καμβά**, όχι του Excel».
     *
     * Η ρίζα δεν είναι το μενού και δεν είναι η γεωμετρία (το `getHit` δοκιμάζεται πράσινο
     * αλλού, με τα ίδια σημεία οθόνης). Είναι ότι το §26.15 έδωσε **δήλωση** μόνο στο
     * αριστερό πλήκτρο: το δεξί πατούσε, ο browser μετέφερε την εστίαση, ο φύλακας δεν
     * έβλεπε δήλωση και **έκλεινε τη συνεδρία** — οπότε όταν έφτανε το `contextmenu`, το
     * `getHit` ρωτούσε έναν δρομέα που δεν υπήρχε πια και απαντούσε `null`. Ο δρομολογητής
     * σωστά έπεφτε στο μενού οντότητας.
     *
     * Δηλαδή: **η σειρά `mousedown` → `focusout` → `contextmenu` ήταν το πραγματικό πεδίο**,
     * όχι το «ποιο μενού ανοίγει». Ίδιο μάθημα με το §26.15: μέτρα την αλληλουχία.
     */
    it('🔴 δεξί κλικ στη ζώνη ⇒ η συνεδρία ΖΕΙ (αλλιώς το μενού βρίσκει κλειστό δρομέα)', () => {
      rightPressOn(canvas, columnBandScreenPoint(entity, 1));
      nextFrame();

      expect(getTableCellCursor()).not.toBeNull();
      expect(isTableCellSessionElement(document.activeElement)).toBe(true);
    });

    it('🔴 δεξί κλικ ΜΕΣΑ σε κελί ⇒ η συνεδρία ζει το ίδιο', () => {
      rightPressOn(canvas, cellScreenPoint(entity, 3, 2));
      nextFrame();

      expect(getTableCellCursor()).not.toBeNull();
      expect(isTableCellSessionElement(document.activeElement)).toBe(true);
    });

    it('🔴 ΜΟΝΟ δηλώνει: ο δρομέας ΔΕΝ μετακινείται και ΤΙΠΟΤΑ δεν δεσμεύεται', () => {
      // Το μενού θα ανοίξει πάνω στο σημείο· μια μετακίνηση δρομέα εδώ θα άλλαζε το
      // αντικείμενο της εντολής **κάτω από** το μενού που μόλις άνοιξε. Ο κανόνας
      // «το δεξί δεν μετακινεί την επιλογή» μένει ακέραιος — προστίθεται μόνο η δήλωση.
      const before = getTableCellCursor()?.position;
      rightPressOn(canvas, cellScreenPoint(entity, 3, 2));
      nextFrame();

      expect(getTableCellCursor()?.position).toEqual(before);
      expect(onCommitPending).not.toHaveBeenCalled();
      expect(onSelectTo).not.toHaveBeenCalled();
    });

    it('δεξί κλικ ΕΞΩ από τον πίνακα ⇒ η συνεδρία κλείνει, όπως και το αριστερό', () => {
      // Η δήλωση δεν επιτρέπεται να γίνει «κρατάω τη συνεδρία σε κάθε δεξί κλικ του
      // σχεδίου»: αυτό ακριβώς απέρριψε το §26.15 για τον καμβά.
      // Το ΙΔΙΟ σημείο με το αριστερό δίδυμο πιο κάτω — αλλιώς συγκρίνονται δύο πράγματα.
      rightPressOn(canvas, { x: 1100, y: 700 });
      nextFrame();

      expect(getTableCellCursor()).toBeNull();
    });
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

  /**
   * 🔴 ADR-739 §27.16 Ε6 — **Η ΣΥΡΣΗ ΠΡΕΠΕΙ ΝΑ ΕΠΙΒΙΩΝΕΙ ΤΩΝ ΔΙΚΩΝ ΤΗΣ ΕΓΓΡΑΦΩΝ.**
   *
   * Μετρημένο ζωντανά (02/08, raw-CDP σε πραγματικό Chrome, πίνακας `ent_1a7da856`):
   * σύρση `A2 → C4` πάνω σε 7×3 πίνακα έδωσε **καμία επιλογή**· και όταν το πάτημα έπεφτε
   * στο **ήδη ενεργό** κελί, η επιλογή **πάγωνε στο 2×2** — στο πρώτο κελί που διασχίστηκε.
   * Ο δείκτης έφτανε αποδεδειγμένα ως το C4 (η ίδια η εφαρμογή δήλωνε `X: 6,0331`) και
   * **14 `mousemove` με πατημένο κουμπί** έφταναν στο παράθυρο.
   *
   * ## Γιατί ΚΑΝΕΝΑ από τα 2.716 tests δεν το είδε — η ίδια κλάση, τρίτη φορά
   * Ο κύκλος ζωής της σύρσης δοκιμαζόταν **μόνος του** (`table-cell-drag-session.test.ts`),
   * με το store **mock-αρισμένο επίτηδες** — άρα το `setTableCellSelection` δεν παρήγαγε
   * ποτέ νέο δρομέα και τίποτα δεν ξανα-αποδιδόταν. Ο ζωντανός χειριστής δοκιμαζόταν
   * **μόνος του** εδώ — αλλά **δεν έσερνε ποτέ**. Το σφάλμα ζούσε αποκλειστικά στη
   * **συνάντησή** τους, ακριβώς όπως το §26.15 που τεκμηριώνει η κεφαλίδα αυτού του αρχείου.
   *
   * ## Η αιτία, σε μία πρόταση
   * Ο ακροατής ζει σε `useEffect` με εξάρτηση τον **δρομέα**, και το cleanup του καλεί
   * `endTableCellDrag()`. Κάθε γραφή που κάνει **η ίδια η σύρση** (`setTableCellSelection`,
   * και στο πρώτο πάτημα το `setTableCellCursor`) παράγει **νέο** αντικείμενο δρομέα ⇒ το
   * effect ξανατρέχει ⇒ το cleanup **σκοτώνει τη σύρση που μόλις ξεκίνησε**. Η νέα εκτέλεση
   * ξαναγράφει μόνο τον `mousedown`· τη σύρση δεν την ξαναστήνει κανείς.
   *
   * Τα tests ρωτούν την ερώτηση **του χρήστη** — «ποια κελιά είναι μαρκαρισμένα στο τέλος;»
   * — και όχι «κλήθηκε το store;». Το δεύτερο ήταν πράσινο όλη την ώρα.
   */
  describe('🔴 §27.16 Ε6 — η σύρση επιλογής επιβιώνει των δικών της εγγραφών', () => {
    /** Τα κελιά που πραγματικά μαρκαρίστηκαν — η ερώτηση του χρήστη, όχι του store. */
    function selectedBounds() {
      const selection = getTableCellCursor()?.selection;
      return selection ? resolveTableSelectionBounds(entity.model, selection) : null;
    }

    /** Κίνηση με **πατημένο** κουμπί, στο `document` — ό,τι ακριβώς στέλνει ο browser. */
    function dragOver(point: { readonly x: number; readonly y: number }): void {
      act(() => {
        document.dispatchEvent(
          new MouseEvent('mousemove', {
            buttons: 1,
            bubbles: true,
            clientX: point.x,
            clientY: point.y,
          }),
        );
      });
    }

    function releaseDrag(): void {
      act(() => {
        document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      });
    }

    it('🔴 σύρση από το ΕΝΕΡΓΟ κελί ⇒ η περιοχή φτάνει ως το ΤΕΛΕΥΤΑΙΟ κελί, όχι ως το πρώτο', () => {
      // Ζωντανά: πάγωνε στο 2×2. Δύο ενδιάμεσες στάσεις **επίτηδες** — με μία μόνο κίνηση
      // το test θα ήταν πράσινο ακόμη και με τη σπασμένη υλοποίηση.
      pressOn(canvas, cellScreenPoint(entity, 2, 0));
      nextFrame();

      dragOver(cellScreenPoint(entity, 3, 1));
      dragOver(cellScreenPoint(entity, 4, 2));
      releaseDrag();

      expect(selectedBounds()).toEqual({ firstRow: 2, lastRow: 4, firstCol: 0, lastCol: 2 });
    });

    it('🔴 σύρση από ΑΛΛΟ κελί (η συνηθισμένη περίπτωση) ⇒ σχηματίζεται περιοχή', () => {
      // Ζωντανά αυτή έδινε **καμία** επιλογή: το `setTableCellCursor` του πατήματος σκότωνε
      // τη σύρση πριν καν φτάσει η πρώτη κίνηση. Ο δρομέας ξεκινά στο (2,0)· πατάμε στο (2,1).
      pressOn(canvas, cellScreenPoint(entity, 2, 1));
      nextFrame();

      dragOver(cellScreenPoint(entity, 3, 2));
      dragOver(cellScreenPoint(entity, 4, 2));
      releaseDrag();

      expect(selectedBounds()).toEqual({ firstRow: 2, lastRow: 4, firstCol: 1, lastCol: 2 });
    });

    it('🔴 το ΕΝΕΡΓΟ ΚΕΛΙ μένει στην αφετηρία της σύρσης (σύμβαση Excel: A1→F1 αφήνει A1)', () => {
      pressOn(canvas, cellScreenPoint(entity, 2, 0));
      nextFrame();

      dragOver(cellScreenPoint(entity, 4, 2));
      releaseDrag();

      expect(getTableCellCursor()?.position.rowId).toBe(entity.model.rows[2].id);
      expect(getTableCellCursor()?.position.colId).toBe(entity.model.columns[0].id);
    });

    it('🔴 ΣΥΡΣΗ ΣΤΗ ΖΩΝΗ: από το «A» ως το «C» ⇒ ΤΡΕΙΣ ολόκληρες στήλες', () => {
      // Σ2 του §27.16 — ίδιος κύκλος ζωής, άρα ίδιο σφάλμα: το `selectWholeAxis` γράφει
      // δρομέα **και** επιλογή πριν ξεκινήσει η σύρση, δηλαδή τη σκοτώνει δύο φορές.
      pressOn(canvas, columnBandScreenPoint(entity, 0));
      nextFrame();

      dragOver(columnBandScreenPoint(entity, 1));
      dragOver(columnBandScreenPoint(entity, 2));
      releaseDrag();

      expect(selectedBounds()).toEqual({
        firstRow: 0,
        lastRow: entity.model.rows.length - 1,
        firstCol: 0,
        lastCol: 2,
      });
    });

    it('σκέτο κλικ μένει σκέτο κλικ — καμία επιλογή 1×1 (η μη-παλινδρόμηση)', () => {
      // Ρητή απόφαση του βήματος 8: «καμία επιλογή ≠ επιλογή 1×1». Μια διόρθωση που κρατά
      // τη σύρση ζωντανή δεν επιτρέπεται να γεννήσει επιλογή εκεί που δεν κουνήθηκε τίποτα.
      pressOn(canvas, cellScreenPoint(entity, 3, 1));
      nextFrame();
      releaseDrag();

      expect(getTableCellCursor()?.selection ?? null).toBeNull();
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
