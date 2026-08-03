/**
 * 🔴 ADR-739 Φ.Δ βήμα 9 — **ΤΟ ΔΕΞΙ ΚΛΙΚ ΣΤΙΣ ΖΩΝΕΣ ΔΕΙΚΤΗ ΦΤΑΝΕΙ ΣΤΟΝ ΠΙΝΑΚΑ, ΚΑΙ ΑΛΛΑΖΕΙ
 * ΤΟ ΠΛΕΓΜΑ ΜΕ ΜΙΑ ΕΝΤΟΛΗ.**
 *
 * Οι καθαρές πράξεις (`table-row-column-ops`) και η γεωμετρία (`table-indicator-geometry`)
 * έχουν τις δικές τους σουίτες. Εδώ μετριέται ό,τι **μόνο** η ένωσή τους μπορεί να σπάσει:
 *
 *  1. **Η θύρα δηλώνεται** — χωρίς αυτήν ο δρομολογητής δεν ρωτά ποτέ, και το δεξί κλικ
 *     ανοίγει το μενού οντότητας πάνω από τον πίνακα (η σιωπηλή αστοχία που φοβόμαστε).
 *  2. **Το `getHit` βρίσκει την πραγματική στήλη** από συντεταγμένες **οθόνης**, μέσα από
 *     ολόκληρη την αλυσίδα screen → world → frame → ζώνη.
 *  3. **Μία ενέργεια = μία εντολή = ένα undo**, και το μοντέλο όντως άλλαξε.
 *  4. **Ο δρομέας επιβιώνει** και δείχνει σε κελί που **υπάρχει** μετά τη διαγραφή.
 *
 * Εκτελείται ο **πραγματικός** hook με **πραγματική** εντολή (ADR-587: ένα anchor χωρίς
 * εκτέλεση είναι σχόλιο) — το `execute` του ιστορικού εκτελεί κανονικά την `ICommand`, οπότε
 * η σκηνή γράφεται από την ίδια διαδρομή που τρέχει σε παραγωγή.
 */

import React from 'react';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { buildTableEntity } from '../../../bim/table/build-table-entity';
import { computeTableEntityGeometryLive } from '../../../bim/table/table-entity-geometry';
// ADR-739 Φ.Δ βήμα 9 — η ΜΙΑ προβολή «σημείο πίνακα → pixel» των tests (N.18: ήταν τρία
// αντίγραφα με τρία ονόματα, και τα τρία καλούνταν μόνο με `angleRad = 0`).
import {
  TABLE_TEST_VIEW,
  tableBandScreenPoint,
  tableFrameScreenPoint,
  tableIndicatorCornerScreenPoint,
} from './table-screen-point';
import {
  __resetTableCellCursorStoreForTests,
  getTableCellCursor,
  setTableCellCursor,
} from '../../../state/table-cell-cursor-store';
import { tableCursorAt } from '../../../bim/table/table-cell-navigation';
import {
  __resetTableHeaderMenuPortForTests,
  getTableHeaderMenuPort,
} from '../table-header-menu-port';
import { useTableHeaderMenu } from '../use-table-header-menu';
import { useTableCellPointer } from '../use-table-cell-pointer';
import { isTableCellSessionElement } from '../table-cell-session-focus';
import { escapeBus, type EscapeDispatchResult } from '../../../systems/escape-bus/EscapeCommandBus';
import { ESC_PRIORITY } from '../../../systems/escape-bus/escape-priority';
import {
  TableHeaderContextMenu,
  type TableHeaderContextMenuHandle,
} from '../../components/TableHeaderContextMenu';
import type { ICommand } from '../../../core/commands';
import type { TableEntity } from '../../../types/table-entity';
import type { LevelManagerLike } from '../../../hooks/canvas/canvas-click-types';
import type { ViewTransform } from '../../../rendering/types/Types';

const executed: ICommand[] = [];

// Το ιστορικό είναι React context· εδώ ενδιαφέρει ΜΟΝΟ ότι εκτελείται **μία** εντολή — και
// εκτελείται στ' αλήθεια, ώστε η σκηνή να γραφτεί από την κανονική διαδρομή.
jest.mock('../../../core/commands', () => ({
  ...jest.requireActual('../../../core/commands'),
  useCommandHistory: () => ({
    execute: (command: ICommand) => {
      executed.push(command);
      command.execute();
    },
    undo: jest.fn(),
    redo: jest.fn(),
  }),
}));

const LEVEL_ID = 'level-1';
// Η ΙΔΙΑ προβολή που χρησιμοποιεί ο βοηθός `table-screen-point` — ένα ζεύγος τιμών, όχι δύο
// που μπορούν να αποκλίνουν σιωπηλά (τότε το test θα πατούσε αλλού απ' ό,τι υπολόγισε).
const { transform: TRANSFORM, viewport: VIEWPORT } = TABLE_TEST_VIEW;

interface Harness {
  readonly entity: () => TableEntity;
  readonly levelManager: LevelManagerLike;
  readonly containerRef: { current: HTMLDivElement | null };
  readonly transformRef: { current: ViewTransform };
}

/**
 * Ο ελάχιστος πιστός κόσμος: μία σκηνή με **έναν** πίνακα και ένα δοχείο με γνωστό rect.
 *
 * 🔴 ADR-739 Φ.Δ βήμα 9 — τα `angleRad` / `position` είναι **παράμετροι**, όχι σταθερές.
 * Με καρφωμένο `angleRad = 0` (και άγκυρα στην αρχή των αξόνων) ολόκληρη η γωνιακή
 * διαδρομή `screen → world → frame` έμενε ανέλεγκτη: το `tableWorldToFrame` πολλαπλασιάζει
 * με `cos`/`sin`, οπότε **κάθε** πρόσημο περνά όταν η γωνία είναι μηδέν, και η μη μηδενική
 * άγκυρα είναι το μόνο που ξεχωρίζει «στροφή γύρω από τον πίνακα» από «στροφή γύρω από την
 * αρχή του κόσμου».
 */
function createHarness(
  angleRad = 0,
  position: { readonly x: number; readonly y: number } = { x: 0, y: 0 },
): Harness {
  const table: TableEntity = {
    ...buildTableEntity(position, {}, 'table-1', 'layer-0'),
    angleRad,
  };
  let scene = { entities: [table] } as unknown as ReturnType<LevelManagerLike['getLevelScene']>;

  const container = document.createElement('div');
  container.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: VIEWPORT.width, height: VIEWPORT.height }) as DOMRect;
  document.body.appendChild(container);

  const levelManager = {
    currentLevelId: LEVEL_ID,
    getLevelScene: () => scene,
    setLevelScene: (_id: string, next: typeof scene) => { scene = next; },
  } as unknown as LevelManagerLike;

  const entity = (): TableEntity => {
    const found = levelManager.getLevelScene(LEVEL_ID)?.entities.find((e) => e.id === 'table-1');
    return found as unknown as TableEntity;
  };

  return {
    entity,
    levelManager,
    containerRef: { current: container },
    transformRef: { current: TRANSFORM },
  };
}

function mount(harness: Harness) {
  return renderHook(() =>
    useTableHeaderMenu({
      containerRef: harness.containerRef,
      transformRef: harness.transformRef,
      levelManager: harness.levelManager,
    }),
  );
}

describe('🔴 μενού ζωνών δείκτη — από το δεξί κλικ ως το undo', () => {
  let harness: Harness;

  beforeEach(() => {
    executed.length = 0;
    __resetTableCellCursorStoreForTests();
    __resetTableHeaderMenuPortForTests();
    harness = createHarness();
  });

  afterEach(() => {
    harness.containerRef.current?.remove();
  });

  it('🔴 δηλώνει τη θύρα προς τον δρομολογητή — χωρίς αυτήν κανείς δεν ρωτά ποτέ', () => {
    expect(getTableHeaderMenuPort()).toBeNull();
    mount(harness);
    expect(getTableHeaderMenuPort()).not.toBeNull();
  });

  it('αποσύρει τη θύρα στο ξεμοντάρισμα — καμία μπαγιάτικη αναφορά σε σβησμένο container', () => {
    const view = mount(harness);
    view.unmount();
    expect(getTableHeaderMenuPort()).toBeNull();
  });

  it('χωρίς δρομέα δεν υπάρχει ζώνη: το δεξί κλικ ανήκει στον καμβά', () => {
    mount(harness);
    const point = tableBandScreenPoint(harness.entity(), 'column', 1);
    expect(getTableHeaderMenuPort()?.getHit(point.x, point.y)).toBeNull();
  });

  it('🔴 βρίσκει τη ΣΩΣΤΗ στήλη από συντεταγμένες οθόνης (screen → world → frame → ζώνη)', () => {
    openCursor(harness);
    mount(harness);
    const point = tableBandScreenPoint(harness.entity(), 'column', 1);
    expect(getTableHeaderMenuPort()?.getHit(point.x, point.y)).toEqual({
      axis: 'column',
      colId: harness.entity().model.columns[1].id,
      index: 1,
    });
  });

  it('🔴 βρίσκει τη ΣΩΣΤΗ γραμμή — η αριστερή ζώνη δεν συγχέεται με την πάνω', () => {
    openCursor(harness);
    mount(harness);
    const point = tableBandScreenPoint(harness.entity(), 'row', 2);
    expect(getTableHeaderMenuPort()?.getHit(point.x, point.y)).toEqual({
      axis: 'row',
      rowId: harness.entity().model.rows[2].id,
      index: 2,
    });
  });

  it('🔴 «Εισαγωγή στήλης δεξιά» ⇒ ΜΙΑ εντολή, νέα στήλη στη σωστή θέση, τίτλος ακέραιος', () => {
    openCursor(harness);
    const view = mount(harness);
    const before = harness.entity().model;

    act(() => {
      view.result.current.props.onInsertAfter({ axis: 'column', colId: before.columns[1].id, index: 1 });
    });

    const after = harness.entity().model;
    expect(executed).toHaveLength(1);
    expect(after.columns).toHaveLength(before.columns.length + 1);
    expect(after.columns[1].id).toBe(before.columns[1].id);
    // Η γραμμή τίτλου καλύπτει ΟΛΟ το πλάτος — αλλιώς ο πίνακας φαίνεται σπασμένος.
    expect(after.merges[0].colSpan).toBe(after.columns.length);
  });

  it('🔴 «Διαγραφή γραμμής» ⇒ μία εντολή, ΚΑΙ ο δρομέας μένει σε κελί που ΥΠΑΡΧΕΙ', () => {
    openCursor(harness);
    const view = mount(harness);
    const before = harness.entity().model;
    const doomedRowId = before.rows[before.rows.length - 1].id;

    act(() => {
      view.result.current.props.onDelete({
        axis: 'row',
        rowId: doomedRowId,
        index: before.rows.length - 1,
      });
    });

    const after = harness.entity().model;
    expect(executed).toHaveLength(1);
    expect(after.rows.map((r) => r.id)).not.toContain(doomedRowId);

    const cursor = getTableCellCursor();
    expect(cursor).not.toBeNull();
    expect(after.rows.some((r) => r.id === cursor?.position.rowId)).toBe(true);
    expect(after.columns.some((c) => c.id === cursor?.position.colId)).toBe(true);
  });

  it('οι σημαίες απαντιούνται τη ΣΤΙΓΜΗ του ανοίγματος, από το ζωντανό μοντέλο', () => {
    openCursor(harness);
    const view = mount(harness);
    const state = view.result.current.props.resolveState({
      axis: 'column',
      colId: harness.entity().model.columns[0].id,
      index: 0,
    });
    expect(state).toEqual({ label: 'A', canInsert: true, canDelete: true });
  });

  it('η ετικέτα γραμμής είναι 1-based — ίδια ονομασία με τη ζώνη', () => {
    openCursor(harness);
    const view = mount(harness);
    const state = view.result.current.props.resolveState({
      axis: 'row',
      rowId: harness.entity().model.rows[2].id,
      index: 2,
    });
    expect(state.label).toBe('3');
  });

  it('🔴 το κλείσιμο του μενού ξαναστήνει τη συνεδρία — αλλιώς μένει ζωντανή αλλά κουφή', () => {
    openCursor(harness);
    const view = mount(harness);
    const before = getTableCellCursor()?.sessionId ?? 0;

    act(() => { view.result.current.props.onClosed(); });

    expect(getTableCellCursor()?.sessionId).toBe(before + 1);
    // Ο δρομέας ΔΕΝ κουνήθηκε: ξαναπιάνεις το πληκτρολόγιο, δεν πλοηγείσαι.
    expect(getTableCellCursor()?.position.rowId).toBe(harness.entity().model.rows[0].id);
  });
});

/**
 * 🔴 ADR-739 Φ.Δ βήμα 9 §27.9 — **Ο ΣΤΡΑΜΜΕΝΟΣ ΠΙΝΑΚΑΣ** (`angleRad ≠ 0`).
 *
 * ## Γιατί αυτό το μπλοκ δεν είναι «άλλη μια περίπτωση»
 * Όλη η διαδρομή `screen → world → frame` περνά από το `tableWorldToFrame`, που εφαρμόζει
 * **αντίστροφη περιστροφή**. Με `angleRad = 0` ισχύει `cos = 1, sin = 0`: κάθε όρος με
 * `sin` **εξαφανίζεται**, οπότε ένα λάθος πρόσημο — ή μια υλοποίηση που αγνοεί εντελώς τη
 * γωνία — δίνει **ακριβώς το ίδιο σωστό αποτέλεσμα**. Το σφάλμα μεγαλώνει **γραμμικά με τη
 * γωνία** και είναι σιωπηλό: το μενού απλώς λέει «Στήλη A» εκεί που πάτησες το «C».
 *
 * Μέχρι σήμερα **κάθε** table test της Φ.Δ έχτιζε `buildTableEntity(...)`, που γεννά
 * `angleRad: 0` — δηλαδή η γωνιακή συμπεριφορά ήταν δομικά ανέλεγκτη.
 *
 * ## Τι κάνει το test ΕΓΚΥΡΟ και όχι ταυτολογία
 * Η προβολή του σημείου γίνεται με το `tableFrameToWorld` (εμπρός) και το hit-test τρέχει
 * το `tableWorldToFrame` (αντίστροφο) — δύο διαφορετικές συναρτήσεις που **οφείλουν** να
 * είναι αυστηρά αντίστροφες. Επιπλέον το τελευταίο test **αποδεικνύει ότι το μπλοκ
 * διακρίνει τη στροφή**: το σημείο του **άστροφου** διδύμου, δοσμένο στον στραμμένο
 * πίνακα, ΔΕΝ επιτρέπεται να δώσει την ίδια απάντηση. Χωρίς αυτό, μια υλοποίηση που αγνοεί
 * τη γωνία θα έμενε πράσινη.
 *
 * ## Η άγκυρα ΔΕΝ είναι στην αρχή των αξόνων — επίτηδες
 * Η στροφή γίνεται γύρω από το `position` του πίνακα. Με `position = (0,0)` μια υλοποίηση
 * που ξέχασε τη μετάθεση (στρίβει γύρω από την αρχή του **κόσμου**) περνά αθόρυβα.
 */
describe('🔴 στραμμένος πίνακας — η γωνιακή διαδρομή που ήταν ανέλεγκτη', () => {
  /** Μικρή γωνία, ορθή γωνία, αρνητική, και μία πάνω από 90° (ανάποδο κείμενο). */
  const ANGLES = [0.35, Math.PI / 2, -1.2, 2.6];
  /** Άγκυρα εκτός αρχής αξόνων, αλλά μέσα στο παράθυρο — δες την κεφαλίδα. */
  const ANCHOR = { x: 300, y: 200 };

  const created: Harness[] = [];

  beforeEach(() => {
    executed.length = 0;
    __resetTableCellCursorStoreForTests();
    __resetTableHeaderMenuPortForTests();
  });

  afterEach(() => {
    for (const h of created) h.containerRef.current?.remove();
    created.length = 0;
  });

  /** Πίνακας στραμμένος κατά `angleRad`, με ανοιχτή συνεδρία και δηλωμένη θύρα. */
  function rotated(angleRad: number): Harness {
    const harness = createHarness(angleRad, ANCHOR);
    created.push(harness);
    openCursor(harness);
    mount(harness);
    return harness;
  }

  it.each(ANGLES)('🔴 βρίσκει ΚΑΘΕ στήλη σε γωνία %f rad — καμία ολίσθηση γείτονα', (angleRad) => {
    const harness = rotated(angleRad);
    const columns = harness.entity().model.columns;

    for (let index = 0; index < columns.length; index++) {
      const point = tableBandScreenPoint(harness.entity(), 'column', index);
      expect(getTableHeaderMenuPort()?.getHit(point.x, point.y)).toEqual({
        axis: 'column',
        colId: columns[index].id,
        index,
      });
    }
  });

  it.each(ANGLES)('🔴 βρίσκει ΚΑΘΕ γραμμή σε γωνία %f rad — η αριστερή ζώνη δεν γέρνει στην πάνω', (angleRad) => {
    const harness = rotated(angleRad);
    const rows = harness.entity().model.rows;

    for (let index = 0; index < rows.length; index++) {
      const point = tableBandScreenPoint(harness.entity(), 'row', index);
      expect(getTableHeaderMenuPort()?.getHit(point.x, point.y)).toEqual({
        axis: 'row',
        rowId: rows[index].id,
        index,
      });
    }
  });

  it.each(ANGLES)('η σκόπιμα νεκρή γωνία μένει νεκρή σε %f rad — δεν υπάρχει τέτοια εντολή', (angleRad) => {
    const harness = rotated(angleRad);
    const point = tableIndicatorCornerScreenPoint(harness.entity());
    expect(getTableHeaderMenuPort()?.getHit(point.x, point.y)).toBeNull();
  });

  it.each(ANGLES)('κλικ ΜΕΣΑ στο πλέγμα σε %f rad ⇒ καμία ζώνη: ανήκει στο κελί', (angleRad) => {
    const harness = rotated(angleRad);
    const cell = computeTableEntityGeometryLive(harness.entity()).layout.cells[4];
    const point = tableFrameScreenPoint(
      harness.entity(),
      cell.rect.x + cell.rect.w / 2,
      cell.rect.y + cell.rect.h / 2,
    );
    expect(getTableHeaderMenuPort()?.getHit(point.x, point.y)).toBeNull();
  });

  /**
   * 🔴 **Η απόδειξη ότι το μπλοκ μετράει τη στροφή** — δες την κεφαλίδα.
   *
   * Το σημείο υπολογίζεται πάνω στο **άστροφο** δίδυμο (ίδια άγκυρα, ίδιο μοντέλο) και
   * δίνεται στον **στραμμένο** πίνακα. Αν το hit-test αγνοούσε τη γωνία, θα απαντούσε
   * «στήλη 2» και όλα τα προηγούμενα tests θα ήταν ταυτολογίες.
   */
  it.each(ANGLES)('🔴 ΔΙΑΚΡΙΝΕΙ τη στροφή: το άστροφο σημείο ΔΕΝ δίνει την ίδια στήλη σε %f rad', (angleRad) => {
    const straight = createHarness(0, ANCHOR);
    created.push(straight);
    const index = straight.entity().model.columns.length - 1;
    const straightPoint = tableBandScreenPoint(straight.entity(), 'column', index);

    const harness = rotated(angleRad);
    expect(getTableHeaderMenuPort()?.getHit(straightPoint.x, straightPoint.y)).not.toEqual({
      axis: 'column',
      colId: harness.entity().model.columns[index].id,
      index,
    });
  });

  it('🔴 η ετικέτα του μενού είναι αυτή της στήλης που πατήθηκε — όχι της γειτονικής', () => {
    const harness = rotated(0.35);
    const columns = harness.entity().model.columns;
    const point = tableBandScreenPoint(harness.entity(), 'column', 1);
    const hit = getTableHeaderMenuPort()?.getHit(point.x, point.y);

    expect(hit).not.toBeNull();
    expect(hit).toEqual({ axis: 'column', colId: columns[1].id, index: 1 });
  });
});

describe('🔴 αριστερό κλικ στη ζώνη — επιλογή ΟΛΟΚΛΗΡΗΣ στήλης / γραμμής', () => {
  let harness: Harness;

  beforeEach(() => {
    executed.length = 0;
    __resetTableCellCursorStoreForTests();
    __resetTableHeaderMenuPortForTests();
    harness = createHarness();
  });

  afterEach(() => {
    harness.containerRef.current?.remove();
  });

  function mountPointer() {
    const cursor = getTableCellCursor();
    return renderHook(() =>
      useTableCellPointer({
        cursor,
        entity: harness.entity(),
        containerRef: harness.containerRef,
        transformRef: harness.transformRef,
        onSelectTo: jest.fn(),
        // ADR-739 §26.15 — «δέσμευσε ό,τι γράφεται πριν κουνηθεί ο δρομέας». Εδώ η συνεδρία
        // είναι σε πλοήγηση, άρα δεν γράφεται τίποτα· το συμβόλαιο ελέγχεται στο
        // `table-cell-pointer-session-survival.test.tsx`.
        onCommitPending: jest.fn(),
      }),
    );
  }

  function clickAt(point: { readonly x: number; readonly y: number }, shiftKey = false): void {
    act(() => {
      harness.containerRef.current?.dispatchEvent(
        new MouseEvent('mousedown', {
          button: 0,
          clientX: point.x,
          clientY: point.y,
          shiftKey,
          bubbles: true,
        }),
      );
    });
  }

  it('🔴 κλικ στο γράμμα «B» ⇒ μαρκάρεται ΟΛΗ η στήλη, από την πρώτη ως την τελευταία γραμμή', () => {
    openCursor(harness);
    mountPointer();
    clickAt(tableBandScreenPoint(harness.entity(), 'column', 1));

    const model = harness.entity().model;
    const cursor = getTableCellCursor();
    expect(cursor?.selection).toEqual({
      from: { rowId: model.rows[0].id, colId: model.columns[1].id },
      to: { rowId: model.rows[model.rows.length - 1].id, colId: model.columns[1].id },
      // 🔴 ADR-739 §27.15 — **και η πρόθεση**, όχι μόνο οι γωνίες. Χωρίς αυτήν, οι ίδιες
      // δύο γωνίες κουμπώνουν στη συγχώνευση του τίτλου και μαρκάρεται ΟΛΟΣ ο πίνακας.
      kind: 'column',
    });
    // Το ενεργό κελί πάει στην ΑΡΧΗ του άξονα (Excel): εκεί αρχίζει η πληκτρολόγηση.
    expect(cursor?.position.rowId).toBe(model.rows[0].id);
    expect(cursor?.position.colId).toBe(model.columns[1].id);
  });

  it('🔴 κλικ στον αριθμό «3» ⇒ μαρκάρεται ΟΛΗ η γραμμή', () => {
    openCursor(harness);
    mountPointer();
    clickAt(tableBandScreenPoint(harness.entity(), 'row', 2));

    const model = harness.entity().model;
    expect(getTableCellCursor()?.selection).toEqual({
      from: { rowId: model.rows[2].id, colId: model.columns[0].id },
      to: { rowId: model.rows[2].id, colId: model.columns[model.columns.length - 1].id },
      kind: 'row',
    });
  });

  it('κλικ ΜΕΣΑ στο πλέγμα μένει ό,τι ήταν: μετακίνηση κελιού, καμία περιοχή', () => {
    openCursor(harness);
    mountPointer();
    const cell = computeTableEntityGeometryLive(harness.entity()).layout.cells[4];
    clickAt(
      tableFrameScreenPoint(
        harness.entity(),
        cell.rect.x + cell.rect.w / 2,
        cell.rect.y + cell.rect.h / 2,
      ),
    );

    expect(getTableCellCursor()?.selection).toBeNull();
    expect(getTableCellCursor()?.position.rowId).toBe(cell.rowId);
  });
});

/**
 * 🔴 Η ΜΙΑ γραμμή που κρατά τη λειτουργία πίνακα ζωντανή όσο το μενού είναι ανοιχτό.
 *
 * Χωρίς το σημάδι συνεδρίας πάνω στο μενού, το Radix παίρνει την εστίαση, ο
 * `useTableCellSessionBlur` δεν αναγνωρίζει τον παραλήπτη και **κλείνει τον δρομέα ένα καρέ
 * αργότερα** — δηλαδή οι ζώνες εξαφανίζονται τη στιγμή ακριβώς που τις πάτησες. Ελέγχεται
 * με τον **ίδιο** ελεγκτή που χρησιμοποιεί ο φύλακας, όχι με σύγκριση αλφαριθμητικού.
 */
/**
 * Τα props του μενού με **αδρανείς** χειριστές — η κοινή βάση κάθε απόδοσης εδώ.
 *
 * Ήταν δύο ταυτόσημα αντίγραφα σε δύο `describe`· ενοποιήθηκαν όταν η Φ.Ε βήμα 5 πρόσθεσε τα
 * χειριστήρια μορφοποίησης, ώστε το επόμενο νέο prop να γράφεται **μία** φορά (N.18).
 */
const noop = (): void => {};
const NO_FORMAT = { active: false, mixed: false, explicit: false } as const;
const menuProps = {
  onInsertBefore: noop,
  onInsertAfter: noop,
  onDelete: noop,
  onClosed: noop,
  resolveState: () => ({ label: 'B', canInsert: true, canDelete: true }),
  resolveFormat: () => ({
    bold: NO_FORMAT, italic: NO_FORMAT, underline: NO_FORMAT, canReset: false,
  }),
  onToggleFormat: noop,
  onStepTextHeight: noop,
  onResetFormat: noop,
  // ADR-750 Φ3 — οι εντολές περιγράμματος του ίδιου toolbar· αδρανείς εδώ, δοκιμάζονται στο
  // `table-border-menu-items.test.ts` και στο `table-border-icon.test.tsx`.
  onApplyBorder: noop,
  onResetBorders: noop,
  resolveCanResetBorders: () => false,
};

describe('🔴 το μενού είναι ΜΕΛΟΣ της συνεδρίας επεξεργασίας', () => {

  /**
   * 🔴 **Ο ΕΝΑΣ δρόμος κλεισίματος.** Το item **δεν** κλείνει μόνο του — το ζητά το Radix
   * (`onSelect` ⇒ `onOpenChange(false)`). Αν κάποτε προστεθεί δεύτερος δρόμος, μια έξοδος θα
   * επιστρέφει την εστίαση στο κελί και μια άλλη όχι, **σιωπηλά**.
   */
  it('🔴 κλικ σε item ⇒ εκτελείται Η ΕΝΕΡΓΕΙΑ **και** κλείνει μέσω του ενός δρόμου', async () => {
    const onInsertAfter = jest.fn();
    const onClosed = jest.fn();
    const ref = React.createRef<TableHeaderContextMenuHandle>();
    const hit = { axis: 'column', colId: 'c1', index: 1 } as const;

    render(<TableHeaderContextMenu ref={ref} {...menuProps} onInsertAfter={onInsertAfter} onClosed={onClosed} />);
    await act(async () => { ref.current?.open(10, 10, hit); });

    // Κατά θέση και όχι κατά κείμενο: η ετικέτα περνά από `t()`, που σε αυτό το περιβάλλον
    // επιστρέφει το κλειδί. Σειρά items: [τίτλος (ανενεργό), πριν, μετά, διαγραφή].
    const items = screen.getAllByRole('menuitem');
    await act(async () => { fireEvent.click(items[2]); });

    expect(onInsertAfter).toHaveBeenCalledWith(hit);
    expect(onClosed).toHaveBeenCalledTimes(1);
  });

  it('ο κρυφός trigger φέρει το σημάδι συνεδρίας', () => {
    render(<TableHeaderContextMenu {...menuProps} />);
    const marked = document.querySelectorAll('[data-table-cell-cursor="true"]');
    expect(marked.length).toBeGreaterThan(0);
    expect(isTableCellSessionElement(marked[0])).toBe(true);
  });

  it('🔴 και το ΑΝΟΙΧΤΟ περιεχόμενο — εκεί πάει η εστίαση', async () => {
    const ref = React.createRef<TableHeaderContextMenuHandle>();
    render(<TableHeaderContextMenu ref={ref} {...menuProps} />);
    // `await act`: το Radix τοποθετεί το περιεχόμενο ασύγχρονα (floating-ui), οπότε χωρίς το
    // ξέπλυμα της ουράς ο έλεγχος θα έτρεχε πάνω σε μισοστημένο DOM.
    await act(async () => { ref.current?.open(10, 10, { axis: 'column', colId: 'c1', index: 1 }); });

    const marked = Array.from(document.querySelectorAll('[data-table-cell-cursor="true"]'));
    // trigger + περιεχόμενο μενού: **δύο** σημαδεμένα στοιχεία, όχι ένα.
    expect(marked.length).toBeGreaterThanOrEqual(2);
    expect(marked.every((el) => isTableCellSessionElement(el))).toBe(true);
  });
});

/**
 * 🔴 ADR-364 — ΤΟ ESCAPE ΚΛΕΙΝΕΙ ΤΟ ΜΕΝΟΥ, ΚΑΙ ΤΙΠΟΤΑ ΑΛΛΟ.
 *
 * ── ΤΟ ΣΦΑΛΜΑ ΠΟΥ ΚΛΕΙΔΩΝΕΤΑΙ ΕΔΩ (ζωντανή επαλήθευση 2026-08-02, 3/3, δύο άξονες) ──
 *
 * Το μενού δεν είχε slot στον escape-bus. Ο bus είναι ο **πρώτος** window-capture listener
 * και σφραγίζει ό,τι καταναλωθεί με `stopImmediatePropagation()`· το `DismissableLayer` του
 * Radix ακούει σε **document** capture, δηλαδή μετά. Άρα το πρώτο `Escape` το άρπαζε το
 * `canvas/fallback-deselect` (P400) — του οποίου το `canHandle` είναι «υπάρχει επιλεγμένη
 * οντότητα;», και σε λειτουργία πίνακα ο πίνακας **είναι** η επιλεγμένη οντότητα.
 *
 * Αποτέλεσμα, με ένα πάτημα: το μενού **δεν έκλεινε**, ο πίνακας **αποεπιλεγόταν**, και ο
 * ζωγράφος (`TableRenderer`: `selected ? cursorOf(...) : null`) σταματούσε να βγάζει δρομέα
 * **και ζώνες** — τα γράμματα και οι αριθμοί εξαφανίζονταν ενώ η γραμμή τύπων έδειχνε
 * ζωντανή συνεδρία. Δηλαδή «είμαι σε λειτουργία πίνακα» χωρίς τίποτα να πατήσεις.
 */
describe('🔴 το Escape κλείνει το μενού — και δεν το αρπάζει η αποεπιλογή του καμβά', () => {
  const hit = { axis: 'column', colId: 'c1', index: 1 } as const;
  const pressEscape = (): EscapeDispatchResult =>
    escapeBus.__dispatchForTests(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));

  it('🔴 ΚΛΕΙΣΤΟ μενού ⇒ ΔΕΝ διεκδικεί — αλλιώς θα έκλεβε κάθε ESC της εφαρμογής', () => {
    // Ο κρυφός trigger είναι πάντα mountαρισμένος, άρα και η εγγραφή. Ένα `canHandle: true`
    // εδώ θα ήταν η παλινδρόμηση §10.12 του ADR-364 σε νέα συσκευασία: ένα αόρατο μενού που
    // καταπίνει το «ακύρωση εντολής / αποεπιλογή», το συχνότερο πλήκτρο του καμβά.
    render(<TableHeaderContextMenu {...menuProps} />);
    expect(escapeBus.inspect().handlers.map((h) => h.id)).toContain('table/header-menu');
    expect(pressEscape()).toEqual({ consumed: false, consumedBy: null });
  });

  it('🔴 ΑΝΟΙΧΤΟ μενού ⇒ το ESC το κλείνει μέσω του ΕΝΟΣ δρόμου (άρα γυρίζει η εστίαση)', async () => {
    const onClosed = jest.fn();
    const ref = React.createRef<TableHeaderContextMenuHandle>();
    render(<TableHeaderContextMenu ref={ref} {...menuProps} onClosed={onClosed} />);
    await act(async () => { ref.current?.open(10, 10, hit); });
    expect(screen.getAllByRole('menuitem').length).toBeGreaterThan(0);

    let result: EscapeDispatchResult | null = null;
    await act(async () => { result = pressEscape(); });

    expect(result).toEqual({ consumed: true, consumedBy: 'table/header-menu' });
    // Ο **ένας** δρόμος: το κλείσιμο περνά από το `handleOpenChange`, που είναι και ο μόνος
    // που καλεί το `onClosed` ⇒ `restartTableCellCursorSession`. Ένα σκέτο `setIsOpen(false)`
    // θα περνούσε το «έκλεισε» και θα άφηνε τη συνεδρία κουφή, σιωπηλά.
    expect(onClosed).toHaveBeenCalledTimes(1);
    expect(screen.queryAllByRole('menuitem')).toHaveLength(0);
  });

  it('🔴 ΝΙΚΑΕΙ την αποεπιλογή του καμβά — η ακριβής αναπαραγωγή του σφάλματος', async () => {
    // Δίδυμο του `canvas/fallback-deselect`: ίδιο σκαλί (P400 = DRAFT_POLYGON), ίδιο
    // «διεκδικώ όσο υπάρχει επιλογή». Αν το μενού δεν έχει δικό του slot, ΑΥΤΟ τρέχει, ο
    // πίνακας αποεπιλέγεται και οι ζώνες σβήνουν.
    const fallbackDeselect = jest.fn(() => true);
    const unregister = escapeBus.register({
      id: 'canvas/fallback-deselect',
      priority: ESC_PRIORITY.DRAFT_POLYGON,
      canHandle: () => true,
      handle: fallbackDeselect,
    });
    try {
      const ref = React.createRef<TableHeaderContextMenuHandle>();
      render(<TableHeaderContextMenu ref={ref} {...menuProps} />);
      await act(async () => { ref.current?.open(10, 10, hit); });

      let result: EscapeDispatchResult | null = null;
      await act(async () => { result = pressEscape(); });

      expect(result).toEqual({ consumed: true, consumedBy: 'table/header-menu' });
      expect(fallbackDeselect).not.toHaveBeenCalled();   // ← ο πίνακας ΜΕΝΕΙ επιλεγμένος

      // …και μόλις κλείσει το μενού, το ΕΠΟΜΕΝΟ ESC ανήκει ξανά στον καμβά: η σκάλα εξόδου
      // δεν καταργείται, απλώς αποκτά ένα σκαλί ακόμη.
      await act(async () => { pressEscape(); });
      expect(fallbackDeselect).toHaveBeenCalledTimes(1);
    } finally {
      unregister();
    }
  });
});

/** Ο χρήστης μπήκε στον πίνακα (διπλό κλικ / `Enter`) — χωρίς αυτό δεν υπάρχουν ζώνες. */
function openCursor(harness: Harness): void {
  const model = harness.entity().model;
  setTableCellCursor('table-1', tableCursorAt(model.rows[0].id, model.columns[0].id), 'nav');
}
