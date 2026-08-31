/**
 * 🔴 ADR-739 §40.9 — **ΤΟ ⊕ ΣΕ ΑΠΛΗ ΕΠΙΛΟΓΗ: Ο ΑΚΡΟΑΤΗΣ ΓΕΝΝΙΕΤΑΙ ΧΩΡΙΣ ΑΠΟΔΟΣΗ.**
 *
 * **Ελάττωμα (ιδιοκτήτης, 2026-08-04):** «*Για ποιον λόγο πρέπει να μπω σε edit mode ώστε να
 * προσθέσω στήλη ή γραμμή, και δεν μπορώ όταν επιλέγω απλά τον πίνακα;*»
 *
 * ## Η ερώτηση που ρωτούν αυτά τα tests
 * **«Προσαρτήθηκε ο ακροατής χωρίς δρομέα;»** — όχι «τι απάντησε η γεωμετρία;». Η γεωμετρία
 * ήταν σωστή σε **όλα** (33 tests του §40) και το ελάττωμα ζούσε δύο στρώσεις πιο πάνω: το
 * `active` των τριών ακροατών υπολογιζόταν **την ώρα της απόδοσης**, και ο κάτοχός του
 * (`CanvasSection`) **δεν αποδίδει ποτέ σε αλλαγή επιλογής** (ADR-532 B4). Επιλογή πίνακα ⇒
 * καμία απόδοση ⇒ κανένας ακροατής ⇒ το ⊕ ούτε ζωγραφιζόταν ούτε πατιόταν.
 *
 * 🔴 **Γι' αυτό το harness ΔΕΝ ΞΑΝΑΑΠΟΔΙΔΕΙ ΠΟΤΕ μετά το mount.** Η επιλογή αλλάζει μέσα από
 * μεταβλητή που διαβάζει ο σταθερός getter — ακριβώς όπως στην παραγωγή, όπου ο
 * `SelectedEntitiesStore` αλλάζει χωρίς να ειδοποιήσει τη React. Ένα test που καλούσε
 * `rerender()` ανάμεσα θα ήταν **πράσινο και τυφλό**: θα αναπαρήγαγε ακριβώς τη μία συνθήκη
 * που δεν ισχύει στην παραγωγή, και το ελάττωμα θα επιβίωνε ολόκληρο από κάτω του.
 *
 * ## Η αντίφαση που έλυσε αυτό το αρχείο
 * Το §40.8 κατέγραψε «*δουλεύει μόνον **έξω** από το edit mode*»· το §40.9 «*πρέπει να **μπω**
 * σε edit mode*». Ίδια αιτία: ο δρομέας **είναι** συνδρομή, άρα το **κλείσιμό** του προκαλεί
 * απόδοση, και σε εκείνη την απόδοση το `active` μανταλωνόταν `true` με τον πίνακα ακόμα
 * επιλεγμένο. Η απλή επιλογή δούλευε **μόνο ως υπόλειμμα** συνεδρίας που μόλις έκλεισε.
 *
 * @see ui/table-cell-editor/use-table-mode-canvas-wiring.ts — εκεί ζούσε η αιτία
 * @see ui/table-cell-editor/use-table-armed-control-click.ts — §40.9 σκέλος Β (το ζευγάρι)
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §40.9
 */

// 🔴 ADR-833 Φ5Β — ο φύλακας χωρητικότητας **μιλά στον άνθρωπο** όταν αρνείται (`useTableWorksheetAdd`
// → `useNotifications`), και ο provider ζει έξω από αυτό το δέντρο. Άπραγο mock, ίδιο με το
// `table-canvas-lockdown-merged-cell`: αυτή η σουίτα δεν μετρά μηνύματα.
jest.mock('@/providers/NotificationProvider', () => ({
  useNotifications: () => ({
    success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn(),
    notify: jest.fn(), loading: jest.fn(), showConfirmDialog: jest.fn(),
  }),
}));

import React, { useRef } from 'react';
import { act, render } from '@testing-library/react';
import { buildTableEntity } from '../../../bim/table/build-table-entity';
import { resolveTableModel } from '../../../bim/table/table-model-helpers';
import { TABLE_TEST_VIEW, tableInsertControlScreenPoint } from './table-screen-point';
import { useTableModeCanvasWiring } from '../use-table-mode-canvas-wiring';
import {
  __resetTableInsertControlForTests,
  getTableInsertControl,
} from '../../../state/table-insert-control-store';
import { __resetTableDeleteControlForTests } from '../../../state/table-delete-control-store';
import { __resetTableIndicatorHoverForTests } from '../../../state/table-indicator-hover-store';
import { __resetTableIndicatorCursorForTests } from '../../../systems/cursor/TableIndicatorCursorStore';
import type { ICommand } from '../../../core/commands';
import type { TableEntity } from '../../../types/table-entity';
import type { LevelManagerLike } from '../../../hooks/canvas/canvas-click-types';
import type { ViewTransform } from '../../../rendering/types/Types';
import { activeTableModel } from '../../../bim/table/table-worksheet-resolve';

const executed: ICommand[] = [];

// Το ιστορικό είναι React context· εδώ ενδιαφέρει ότι η εντολή εκτελείται **στ' αλήθεια**,
// ώστε η σκηνή να γραφτεί από την κανονική διαδρομή και να μετρηθεί το ΑΠΟΤΕΛΕΣΜΑ.
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
const TABLE_ID = 'table-1';
const { transform: TRANSFORM, viewport: VIEWPORT } = TABLE_TEST_VIEW;

/**
 * 🔴 Η **μεταβλητή** επιλογή — αλλάζει χωρίς καμία ειδοποίηση προς τη React.
 *
 * Είναι το πιστό ομοίωμα του `SelectedEntitiesStore` όπως τον βλέπει ο `CanvasSection`: ο
 * getter είναι σταθερός, η τιμή του αλλάζει, και **καμία απόδοση δεν προκύπτει**.
 */
let selectedIds: readonly string[] = [];

interface Harness {
  readonly table: () => TableEntity;
  readonly levelManager: LevelManagerLike;
}

/** Ο ελάχιστος πιστός κόσμος: μία σκηνή με έναν πίνακα, γραφόμενη από την κανονική διαδρομή. */
function createHarness(): Harness {
  let scene = {
    entities: [buildTableEntity({ x: 0, y: 0 }, {}, TABLE_ID, 'layer-0')],
  } as unknown as ReturnType<LevelManagerLike['getLevelScene']>;

  const levelManager = {
    currentLevelId: LEVEL_ID,
    getLevelScene: () => scene,
    setLevelScene: (_id: string, next: typeof scene) => { scene = next; },
    floorplans: {},
  } as unknown as LevelManagerLike;

  return {
    table: () => scene!.entities.find((e) => e.id === TABLE_ID) as TableEntity,
    levelManager,
  };
}

/** Πόσες στήλες έχει **τώρα** ο πίνακας στη σκηνή — το αποτέλεσμα, όχι η πρόθεση. */
function columnCount(table: TableEntity): number {
  return resolveTableModel(activeTableModel(table)).columns.length;
}

/**
 * Το wiring της παραγωγής, **χωρίς δρομέα**: `entity: null` σημαίνει «καμία συνεδρία» — δηλαδή
 * ακριβώς η κατάσταση «απλή επιλογή» για την οποία γράφτηκε το §40.
 */
function SelectionWiringHarness(props: { readonly levelManager: LevelManagerLike }): React.ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const transformRef = useRef<ViewTransform>(TRANSFORM);

  useTableModeCanvasWiring({
    entity: null,
    levelManager: props.levelManager,
    getSelectedEntityIds: () => selectedIds,
    containerRef,
    transformRef,
  });

  return <div ref={containerRef} data-testid="canvas" />;
}

describe('🔴 ADR-739 §40.9 — το ⊕ σε ΑΠΛΗ ΕΠΙΛΟΓΗ, χωρίς καμία επαναπόδοση', () => {
  let harness: Harness;
  let canvas: HTMLElement;
  /** Ό,τι **έφτασε** στον καμβά — η ερώτηση του χρήστη, όχι του ακροατή. */
  let seenByCanvas: string[];
  let unmount: () => void;

  beforeEach(() => {
    executed.length = 0;
    selectedIds = [];
    __resetTableInsertControlForTests();
    __resetTableDeleteControlForTests();
    __resetTableIndicatorHoverForTests();
    __resetTableIndicatorCursorForTests();

    harness = createHarness();
    const view = render(<SelectionWiringHarness levelManager={harness.levelManager} />);
    unmount = view.unmount;
    canvas = view.getByTestId('canvas');
    canvas.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: VIEWPORT.width, height: VIEWPORT.height }) as DOMRect;

    seenByCanvas = [];
    // Φάση **αναδίπλωσης** στο δοχείο — εκεί ακριβώς όπου ακούει η παραγωγή (`onMouseDown` /
    // `onMouseUp` του `CanvasLayerStack`). Ό,τι καταναλώθηκε δεν φτάνει ποτέ εδώ.
    canvas.addEventListener('mousedown', () => seenByCanvas.push('mousedown'));
    canvas.addEventListener('mouseup', () => seenByCanvas.push('mouseup'));
  });

  afterEach(() => unmount());

  /** Στέλνει συμβάν από το δοχείο, όπως ο browser. */
  function dispatchAt(type: string, point: { readonly x: number; readonly y: number }): void {
    act(() => {
      canvas.dispatchEvent(new MouseEvent(type, {
        bubbles: true, cancelable: true, button: 0, clientX: point.x, clientY: point.y,
      }));
    });
  }

  /** Το κέντρο του **οπλισμένου** δίσκου του ⊕ στην κατάσταση `'selection'` (SSoT helper). */
  function armedDiscPoint(line = 1): { readonly x: number; readonly y: number } {
    return tableInsertControlScreenPoint(harness.table(), 'column', line, 'selection');
  }

  it('🔴 Α1 — η επιλογή αλλάζει ΧΩΡΙΣ απόδοση, και η κίνηση οπλίζει το ⊕', () => {
    // Το mount έγινε με ΜΗΔΕΝ επιλογή: με τον παλιό κώδικα ο ακροατής δεν υπήρχε ποτέ, και
    // καμία μεταγενέστερη επιλογή δεν μπορούσε να τον γεννήσει (δεν υπάρχει απόδοση).
    selectedIds = [TABLE_ID];

    dispatchAt('mousemove', armedDiscPoint());

    const control = getTableInsertControl();
    expect(control?.entityId).toBe(TABLE_ID);
    expect(control?.control.phase).toBe('armed');
    expect(control?.control.target).toEqual({ axis: 'column', line: 1 });
  });

  it('🔴 Α2 — το πάτημα εισάγει στήλη χωρίς να μπει κανείς σε edit mode', () => {
    selectedIds = [TABLE_ID];
    const before = columnCount(harness.table());

    dispatchAt('mousemove', armedDiscPoint());
    dispatchAt('mousedown', armedDiscPoint());

    expect(columnCount(harness.table())).toBe(before + 1);
    expect(executed).toHaveLength(1);
    // §40.8 — το κουμπί καταναλώνει το πάτημα: ο καμβάς δεν σέρνει τον πίνακα.
    expect(seenByCanvas).not.toContain('mousedown');
  });

  it('🔴 Β1 — ΤΟ ΜΗ ΠΡΟΦΑΝΕΣ: το `mouseup` του ίδιου πατήματος ΔΕΝ φτάνει στον καμβά', () => {
    // Χωρίς αυτό, το `onCanvasClick` του `mouse-handler-up` διαβάζει «κλικ στο κενό» (το ⊕
    // κάθεται ΕΞΩ από τον πίνακα) και **αποεπιλέγει**: ο χρήστης εισάγει στήλη και χάνει τον
    // πίνακα με την ίδια κίνηση. Σε λειτουργία πίνακα δεν συνέβαινε ποτέ, γιατί το κλείδωμα
    // του §29 έκοβε ήδη το `mouseup` — άρα η ασυμμετρία του §40.8 ζούσε σε ΕΝΑΝ από δύο δρόμους.
    selectedIds = [TABLE_ID];

    dispatchAt('mousemove', armedDiscPoint());
    dispatchAt('mousedown', armedDiscPoint());
    dispatchAt('mouseup', armedDiscPoint());

    expect(seenByCanvas).not.toContain('mouseup');
  });

  it('🔴 Β2 — χωρίς οπλισμένο χειριστήριο το `mouseup` περνά ΑΝΕΓΓΙΧΤΟ', () => {
    // Ο φραγμός είναι **του κουμπιού**, όχι κατάσταση: αν επιβίωνε, ο χρήστης θα έχανε κλικ
    // σε ολόκληρο τον καμβά — η χειρότερη εκδοχή του «δεν δουλεύει».
    selectedIds = [TABLE_ID];

    dispatchAt('mouseup', armedDiscPoint());

    expect(seenByCanvas).toEqual(['mouseup']);
  });

  it('🔴 Α3 — χωρίς επιλογή, η ίδια κίνηση δεν γράφει τίποτα', () => {
    // Ο φρουρός δεν διαγράφηκε — μετακόμισε σε **χρόνο συμβάντος**. Εδώ αποδεικνύεται ότι
    // εξακολουθεί να φρουρεί: σταθερά προσαρτημένος ακροατής ≠ ακροατής που δρα πάντα.
    selectedIds = [];

    dispatchAt('mousemove', armedDiscPoint());

    expect(getTableInsertControl()).toBeNull();
  });

  it('🔴 Α4 — δύο επιλεγμένες οντότητες δεν είναι «ο πίνακας» (ids.length === 1)', () => {
    selectedIds = [TABLE_ID, 'other-entity'];

    dispatchAt('mousemove', armedDiscPoint());

    expect(getTableInsertControl()).toBeNull();
  });
});
