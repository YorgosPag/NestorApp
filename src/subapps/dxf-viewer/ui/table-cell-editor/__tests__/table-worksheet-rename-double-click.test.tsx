/**
 * 🔴 ADR-833 Φάση 4 — **Η ΔΕΥΤΕΡΗ ΔΙΑΔΡΟΜΗ ΠΡΟΣ ΤΗ ΜΕΤΟΝΟΜΑΣΙΑ: ΤΟ ΔΙΠΛΟ ΚΛΙΚ ΣΤΗΝ ΚΑΡΤΕΛΑ.**
 *
 * ## Γιατί υπάρχει αυτό το αρχείο
 * Το σύμπτωμα #1 της Φάσης 4 έλεγε ρητά *«ούτε από το μενού, ούτε από το διπλό κλικ»*. Η
 * διόρθωση του §5.4.11 αγγίζει **μόνο** τη διαδρομή του μενού (παγίδα εστίασης του Radix) — το
 * διπλό κλικ κάνει **δικό του** hit-test, χωρίς κανένα μενού στη μέση. Δηλαδή η δεύτερη
 * διαδρομή **δεν επαληθεύτηκε από τίποτα**: το `table-double-click-entry.test.tsx` έχει **9**
 * δοκιμασίες και **καμία** για τη λωρίδα.
 *
 * 🔴 **ADR-833 §5.4.11 #3 (2026-09-05)**: εδώ έγραφε ότι το διπλό κλικ *«καλεί κατευθείαν το
 * `openWorksheetRename`»* — δεν ισχύει πια, και η αλλαγή είναι **η μισή διόρθωση** του #3.
 * Περνά πλέον από την ίδια θύρα με το μενού (`openWorksheetRenameById`), δηλαδή δίνει
 * **ταυτότητα** φύλλου αντί για slot: το slot κάτω από το pixel είναι απάντηση που **λήγει
 * μέσα στην ίδια χειρονομία**, γιατί το πρώτο κλικ κυλά το παράθυρο υπερχείλισης.
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
import { buildTableEntity, buildTableModel } from '../../../bim/table/build-table-entity';
import { computeTableEntityGeometryLive } from '../../../bim/table/table-entity-geometry';
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

/**
 * 🔴 ADR-833 §5.4.11 #3 — **Η ΣΚΗΝΗ ΟΠΩΣ ΤΗΝ ΑΦΗΝΕΙ ΤΟ ΠΡΩΤΟ ΚΛΙΚ.**
 *
 * Ένα διπλό κλικ **δεν** είναι ένα συμβάν: το πρώτο του κλικ έχει ήδη τρέξει τον ακροατή της
 * λωρίδας και έχει **ενεργοποιήσει** την καρτέλα. Τα tests καλούσαν σκέτο `handleDoubleClick`
 * πάνω σε αμετάβλητη σκηνή — δηλαδή δοκίμαζαν χειρονομία που **ο άνθρωπος δεν μπορεί να
 * κάνει**, και γι' αυτό δεν είδαν ποτέ ούτε το κατακόρυφο ούτε το οριζόντιο ελάττωμα.
 */
let SCENE: TableEntity = ENTITY;

/** Ό,τι κάνει ο `use-table-worksheet-tab-click` στο **πρώτο** κλικ: ενεργοποιεί το φύλλο. */
function firstClickActivates(worksheetId: TableEntity['activeWorksheetId']): void {
  SCENE = { ...SCENE, activeWorksheetId: worksheetId };
}

const LEVEL_MANAGER = {
  currentLevelId: 'lvl_1',
  getLevelScene: () => ({ entities: [SCENE] }),
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
  SCENE = ENTITY;
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
    // ⚠️ **Η προσομοίωση έγινε ΠΙΣΤΗ** (ADR-833 §5.4.11 #3): το πρώτο κλικ του διπλού
    // ενεργοποιεί την καρτέλα **πριν** φτάσει το `dblclick`. Ως τώρα το test παρέλειπε αυτό
    // το βήμα, δηλαδή δοκίμαζε χειρονομία που ο άνθρωπος δεν μπορεί να κάνει — και γι' αυτό
    // ήταν πράσινο πάνω από **δύο** ελαττώματα.
    firstClickActivates(SECOND_SHEET);
    const view = renderEditor();
    doubleClickAt(view, tabPoint(1));

    expect(getTableWorksheetRename()).toMatchObject({
      entityId: ENTITY_ID,
      worksheetId: SECOND_SHEET,
    });
  });

  it('🔑 …και στην ΠΡΩΤΗ καρτέλα ανοίγει η πρώτη — η θέση δεν είναι διακοσμητική', () => {
    firstClickActivates(ENTITY.worksheets[0].id);
    const view = renderEditor();
    doubleClickAt(view, tabPoint(0));

    expect(getTableWorksheetRename()?.worksheetId).toBe(ENTITY.worksheets[0].id);
  });

  it('🔑 ΤΟ ΣΥΜΠΤΩΜΑ ΤΗΣ ΟΘΟΝΗΣ — φύλλα με ΔΙΑΦΟΡΕΤΙΚΟ ύψος, διπλό κλικ στο μη ενεργό', () => {
    // 🔴 **Η ζωντανή εκδοχή του #3, όπως ακριβώς την είδε ο άνθρωπος** (ADR-833 §5.4.11):
    // «διπλό κλικ σε μη ενεργή καρτέλα δεν ανοίγει τίποτα». Το δείγμα των υπόλοιπων tests έχει
    // δύο φύλλα με το **ίδιο** μοντέλο, άρα ίδιο ύψος — δηλαδή δεν μπορούσε ποτέ να το δείξει.
    //
    // Εδώ το δεύτερο φύλλο είναι **ψηλότερο**: το πρώτο κλικ το ενεργοποιεί, ο πίνακας αλλάζει
    // ύψος, και μέχρι σήμερα η λωρίδα έφευγε κάτω από το χέρι. Το σημείο υπολογίζεται **πριν**
    // (όπως το βλέπει ο άνθρωπος) και πατιέται **μετά** — ακριβώς η αλληλουχία της χειρονομίας.
    const shortSheet = twoSheetTable().worksheets[0];
    const tallSheet = {
      id: SECOND_SHEET,
      model: buildTableModel({ columnCount: 3, dataRowCount: 9 }),
    };
    const before: TableEntity = {
      ...twoSheetTable(),
      worksheets: [shortSheet, tallSheet],
      activeWorksheetId: shortSheet.id,
    };

    // ΒΑΣΗ: τα δύο φύλλα έχουν όντως διαφορετικό ύψος, αλλιώς το test δεν δοκιμάζει τίποτα.
    const after: TableEntity = { ...before, activeWorksheetId: SECOND_SHEET };
    expect(computeTableEntityGeometryLive(after).layout.heightMm)
      .toBeGreaterThan(computeTableEntityGeometryLive(before).layout.heightMm);

    // Το σημείο **όπως το βλέπει ο άνθρωπος τη στιγμή που πατά**.
    const point = tableWorksheetStripScreenPoint(before, { kind: 'tab', seat: 1 }, VIEW);
    expect(point).not.toBeNull();

    SCENE = after; // ό,τι άφησε το πρώτο κλικ
    const view = renderEditor();
    doubleClickAt(view, point!);

    expect(getTableWorksheetRename()?.worksheetId).toBe(SECOND_SHEET);
  });

  it('🔴 έξω από τη λωρίδα ΔΕΝ ανοίγει μετονομασία — ούτε καν του ενεργού φύλλου', () => {
    // Ο φύλακας που κρατά την ερώτηση του hit-test **ζωντανή**: τώρα που το «ποια» το απαντά
    // το ενεργό φύλλο, μια υλοποίηση που ξεχνά το «είμαι πάνω σε καρτέλα;» θα άνοιγε
    // μετονομασία σε **κάθε** διπλό κλικ μέσα στον πίνακα. Χωρίς αυτό δεν θα το έβλεπε κανείς.
    firstClickActivates(SECOND_SHEET);
    const view = renderEditor();
    const tab = tabPoint(0);
    // Αρκετά μακριά ώστε να είναι σίγουρα έξω από τη λωρίδα (μέσα στο πλέγμα, προς τα κάτω).
    doubleClickAt(view, { x: tab.x, y: tab.y + 400 });

    expect(getTableWorksheetRename()).toBeNull();
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

/**
 * 🔴 ADR-833 §5.4.11 #3 — **Η ΔΕΥΤΕΡΗ ΔΙΑΔΡΟΜΗ ΤΟΥ ΙΔΙΟΥ ΕΛΑΤΤΩΜΑΤΟΣ: ΟΡΙΖΟΝΤΙΑ.**
 *
 * Η κατακόρυφη διαδρομή (η λωρίδα κρεμόταν από την κάτω ακμή και έφευγε ~46 px όταν άλλαζε το
 * ύψος του πίνακα) έκλεισε **δομικά**, με τη μετακόμιση στην αμετάβλητη πάνω ακμή.
 *
 * ⚠️ **Υπάρχει όμως δεύτερη, ανεξάρτητη**, και τη δηλώνει η ίδια η κεφαλίδα του
 * `table-worksheet-tabs-geometry.ts`: το παράθυρο υπερχείλισης είναι **κεντραρισμένο στην
 * ενεργή** καρτέλα, και *«πατώντας την ακριανή ορατή καρτέλα, το παράθυρο ξανακεντράρεται»*.
 * Δηλαδή με υπερχείλιση, το **πρώτο** κλικ ενός διπλού κλικ μετακινεί τις καρτέλες
 * **οριζόντια** — by design, όχι από ελάττωμα.
 *
 * 🔑 Και το σύμπτωμα εκεί είναι **χειρότερο** από «δεν ανοίγει τίποτα»: το ίδιο σημείο οθόνης
 * φιλοξενεί πλέον **άλλο φύλλο**, άρα ανοίγει η μετονομασία **φύλλου που ο χρήστης δεν
 * διάλεξε**. Μια σιωπηλή αστοχία που καταλήγει σε λάθος δεδομένα, όχι σε αδράνεια.
 *
 * ## Γιατί αυτό μετριέται ΠΡΙΝ γραφτεί οποιαδήποτε λύση
 * Το §5.4.11 πλήρωσε ήδη το μάθημα: *«μια αληθοφανής αιτία που ταιριάζει στο σύμπτωμα δεν
 * είναι μέτρηση»*. Αυτή η ομάδα υπάρχει για να πει **αν** το πρόβλημα υπάρχει, με αριθμό.
 */
describe('🔴 ADR-833 Φ4 #3 — ΤΟ ΠΑΡΑΘΥΡΟ ΚΥΛΑΕΙ ΑΝΑΜΕΣΑ ΣΤΑ ΔΥΟ ΚΛΙΚ', () => {
  const OVERFLOW_ID = 'tbl_dblclick_overflow';
  const SHEET_COUNT = 40;

  /** Βιβλίο με **πολλά** φύλλα — αρκετά ώστε η λωρίδα να μην τα χωρά όλα σε αυτή την κλίμακα. */
  function overflowTable(activeIndex: number): TableEntity {
    const base = buildTableEntity({ x: 0, y: 0 }, { columnCount: 1 }, OVERFLOW_ID, 'lyr_test');
    const worksheets = Array.from({ length: SHEET_COUNT }, (_, i) => ({
      id: tableWorksheetId(`ws_${i}`),
      model: base.worksheets[0].model,
    }));
    return { ...base, worksheets, activeWorksheetId: worksheets[activeIndex].id };
  }

  /** Πόσες καρτέλες φαίνονται όντως — από τη διάταξη που ζωγραφίζεται, ποτέ από σταθερά. */
  function visibleSeats(entity: TableEntity): number {
    let seats = 0;
    while (tableWorksheetStripScreenPoint(entity, { kind: 'tab', seat: seats }, VIEW)) seats++;
    return seats;
  }

  function renderFor(entity: TableEntity) {
    const container = document.createElement('div');
    container.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: VIEWPORT.width, height: VIEWPORT.height }) as DOMRect;
    return renderHook(() =>
      useTableCellDoubleClickEditor({
        transformRef: { current: TRANSFORM } as React.RefObject<ViewTransform>,
        containerRef: { current: container },
        getSelectedEntityIds: () => [OVERFLOW_ID],
        levelManager: {
          currentLevelId: 'lvl_1',
          getLevelScene: () => ({ entities: [entity] }),
          setLevelScene: () => undefined,
        } as never,
      }),
    );
  }

  it('ΒΑΣΗ — υπάρχει ΟΝΤΩΣ υπερχείλιση: οι ορατές καρτέλες είναι λιγότερες από τα φύλλα', () => {
    // Χωρίς αυτό, κάθε ισχυρισμός παρακάτω θα ήταν πράσινος επειδή το παράθυρο δεν κυλά ποτέ.
    const seats = visibleSeats(overflowTable(0));
    expect(seats).toBeGreaterThan(0);
    expect(seats).toBeLessThan(SHEET_COUNT);
  });

  it('ΒΑΣΗ — το πρώτο κλικ ΟΝΤΩΣ μετακινεί τις καρτέλες οριζόντια', () => {
    // Η μέτρηση της αιτίας, χωριστά από το σύμπτωμα: το ίδιο seat δείχνει άλλο σημείο πριν
    // και μετά την αλλαγή ενεργού φύλλου.
    const before = tableWorksheetStripScreenPoint(overflowTable(0), { kind: 'tab', seat: 0 }, VIEW);
    const after = tableWorksheetStripScreenPoint(
      overflowTable(SHEET_COUNT - 1), { kind: 'tab', seat: 0 }, VIEW,
    );
    expect(before).not.toBeNull();
    expect(after).not.toBeNull();
    // Το seat 0 δείχνει **άλλο φύλλο**: η θέση οθόνης είναι η ίδια, ο ένοικος όχι.
    expect(before!.x).toBeCloseTo(after!.x, 6);
  });

  it('🔑 ΤΟ ΕΛΑΤΤΩΜΑ — διπλό κλικ στην ΑΚΡΙΑΝΗ καρτέλα ανοίγει ΑΛΛΟ φύλλο από αυτό που πατήθηκε', () => {
    const startActive = 0;
    const seats = visibleSeats(overflowTable(startActive));
    const lastSeat = seats - 1;

    // Ποιο φύλλο βλέπει ο άνθρωπος σε εκείνη τη θέση **τη στιγμή που πατά**.
    const pressed = overflowTable(startActive).worksheets[lastSeat];
    const point = tableWorksheetStripScreenPoint(
      overflowTable(startActive), { kind: 'tab', seat: lastSeat }, VIEW,
    );
    expect(point).not.toBeNull();

    // Το **πρώτο** κλικ του διπλού: ενεργοποιεί εκείνο το φύλλο (ό,τι κάνει ο tab-click
    // ακροατής). Το παράθυρο ξανακεντράρεται γύρω του.
    const afterFirstClick = { ...overflowTable(startActive), activeWorksheetId: pressed.id };

    // Το **δεύτερο** κλικ, στο ΙΔΙΟ σημείο οθόνης.
    const view = renderFor(afterFirstClick);
    doubleClickAt(view, point!);

    expect(getTableWorksheetRename()?.worksheetId).toBe(pressed.id);
  });
});
