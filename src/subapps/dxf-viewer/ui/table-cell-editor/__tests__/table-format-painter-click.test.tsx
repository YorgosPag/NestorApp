/**
 * 🔴 **ADR-768 Βήμα 5 — ΤΟ ΠΙΝΕΛΟ ΒΑΦΕΙ ΣΤ' ΑΛΗΘΕΙΑ**, μέσα από ολόκληρη την αλυσίδα.
 *
 * ## Η ερώτηση που ρωτούν αυτά τα anchors
 * **«Άλλαξε η μορφή του κελιού που έδειξε ο χρήστης;»** — όχι «κλήθηκε το `paintTableFormat`;».
 * Η μηχανή (Φ1–Φ3) και η μνήμη (Φ4) είχαν **2.490 πράσινα tests** και στην οθόνη δεν συνέβαινε
 * απολύτως τίποτα: το κουμπί ήταν `disabled` και το store είχε **μηδέν καταναλωτές**. Ένα
 * anchor που κοίταζε τη μηχανή θα ήταν πράσινο και τυφλό ξανά.
 *
 * Γι' αυτό εδώ μονταρίζεται το **πραγματικό wiring** (`useTableModeCanvasWiring`) και το συμβάν
 * ταξιδεύει από το `document` προς τα κάτω — δηλαδή περνά **και από το κλείδωμα του §29**, που
 * είναι ακριβώς το σημείο όπου το cross-table βάψιμο ήταν **δομικά αδύνατο**.
 *
 * ## 🔴 Τι κλειδώνει η αλυσίδα, βήμα-βήμα
 * ```
 *   mousemove  →  ο ΕΝΑΣ γραφέας γράφει το ΠΕΜΠΤΟ κανάλι (ποιο κελί θα βαφτεί)
 *   mousedown  →  §29 αφήνει ΜΟΝΟ το πάτημα να περάσει (η στενή τρύπα)
 *              →  ο κοινός ακροατής καταναλώνει ΠΡΙΝ την πράξη (§40.8)
 *              →  consume → paint → commit → ο δρομέας μετακινείται (Excel)
 * ```
 *
 * @see ui/table-cell-editor/use-table-format-painter-click.ts — ο εκτελεστής
 * @see state/table-format-paint-target-store.ts — το πέμπτο κανάλι
 * @see docs/centralized-systems/reference/adrs/ADR-768-table-format-painter.md
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
import { resolveTableStyle } from '../../../bim/table/table-entity-geometry';
import { captureTableFormatBrush } from '../../../bim/table/table-format-paint';
import { ALL_TABLE_FORMAT_FACETS } from '../../../bim/table/table-format-payload';
import { readTableCellFormat } from '../../../bim/table/table-format-read';
import { TABLE_TEST_VIEW, tableCellScreenPoint } from './table-screen-point';
import { useTableModeCanvasWiring } from '../use-table-mode-canvas-wiring';
import {
  __resetTableCellCursorStoreForTests,
  getTableCellCursor,
  setTableCellCursor,
} from '../../../state/table-cell-cursor-store';
import {
  __resetTableFormatPainterForTests,
  armTableFormatPainter,
  getTableFormatPainterState,
} from '../../../state/table-format-painter-store';
import {
  __resetTableFormatPaintTargetForTests,
  getTableFormatPaintTarget,
} from '../../../state/table-format-paint-target-store';
import { __resetTableCanvasLockdownForTests } from '../use-table-canvas-lockdown';
import { __resetTableIndicatorCursorForTests } from '../../../systems/cursor/TableIndicatorCursorStore';
import { __resetTableIndicatorHoverForTests } from '../../../state/table-indicator-hover-store';
import { __resetTableInsertControlForTests } from '../../../state/table-insert-control-store';
import { __resetTableDeleteControlForTests } from '../../../state/table-delete-control-store';
import type { ICommand } from '../../../core/commands';
import type { TableEntity } from '../../../types/table-entity';
import type { LevelManagerLike } from '../../../hooks/canvas/canvas-click-types';
import type { ViewTransform } from '../../../rendering/types/Types';
import { activeTableModel } from '../../../bim/table/table-worksheet-resolve';
import {
  setTableCellCursorById,
  tableWorksheetFields,
} from '../../../bim/table/__tests__/make-table-entity';

const executed: ICommand[] = [];

// Η εντολή εκτελείται **στ' αλήθεια**, ώστε η σκηνή να γραφτεί από την κανονική διαδρομή και να
// μετρηθεί το ΑΠΟΤΕΛΕΣΜΑ — όχι η πρόθεση. Ίδιο μοτίβο με το §40.9 anchor δίπλα.
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
const SOURCE_ID = 'table-source';
const TARGET_ID = 'table-target';
const { transform: TRANSFORM, viewport: VIEWPORT } = TABLE_TEST_VIEW;

/** Η κεφαλίδα (r0) και μια γραμμή δεδομένων: το ιεραρχικό στυλ τις κάνει **μετρήσιμα** άνισες. */
const HEADER_ROW = 0;
const DATA_ROW = 2;

interface Harness {
  readonly source: () => TableEntity;
  readonly target: () => TableEntity;
  readonly levelManager: LevelManagerLike;
}

/**
 * Ο ελάχιστος πιστός κόσμος: **δύο** πίνακες στην ίδια σκηνή.
 *
 * Δύο και όχι ένας, επειδή το cross-table είναι η προδιαγραφή (§2.2) **και** η μόνη διαδρομή που
 * περνά από την τρύπα του §29: μέσα στον ίδιο πίνακα το `mousedown` περνούσε ούτως ή άλλως.
 */
/**
 * 🔴 **Η ΠΗΓΗ ΠΡΕΠΕΙ ΝΑ ΕΙΝΑΙ ΟΝΤΩΣ ΔΙΑΦΟΡΕΤΙΚΗ — αλλιώς το anchor είναι πράσινο και κενό.**
 *
 * Η πρώτη γραφή έβαφε κεφαλίδα → δεδομένα βασιζόμενη στο ότι το ιεραρχικό στυλ τις ξεχωρίζει.
 * **Μετρήθηκε ότι δεν τις ξεχωρίζει** στον προεπιλεγμένο πίνακα: οι δύο επιλυμένες μορφές ήταν
 * ταυτόσημες, άρα η «ελάχιστη υλοποίηση» (Α2) σωστά δεν έγραφε **τίποτα** — και τρία anchors
 * περνούσαν χωρίς να έχει βαφτεί ούτε ένα κελί.
 *
 * Εδώ η πηγή αποκτά **ρητή** παράκαμψη σε τρία ορθογώνια πεδία (βάρος, χρώμα, ύψος), οπότε το
 * βάψιμο **οφείλει** να γράψει κάτι και η ισότητα από κάτω είναι πραγματική απόδειξη.
 */
function withStampedSourceCell(entity: TableEntity): TableEntity {
  return {
    ...entity,
    ...tableWorksheetFields({
      ...activeTableModel(entity),
      cells: [
        ...activeTableModel(entity).cells,
        [
          `r${HEADER_ROW}`,
          'c0',
          {
            kind: 'text' as const,
            value: 'ΠΗΓΗ',
            styleOverride: { bold: true, textColorHex: '#ff0000', textHeightMm: 5 },
          },
        ],
      ],
    }),
  } as TableEntity;
}

function createHarness(): Harness {
  let scene = {
    entities: [
      withStampedSourceCell(buildTableEntity({ x: 0, y: 0 }, {}, SOURCE_ID, 'layer-0')),
      // Μακριά, ώστε τα δύο πλαίσια να μην τέμνονται ποτέ — αλλιώς το «ποιος είναι από πάνω»
      // θα ήταν η μεταβλητή που μετράει, αντί για το βάψιμο.
      buildTableEntity({ x: 0, y: -500 }, {}, TARGET_ID, 'layer-0'),
    ],
  } as unknown as ReturnType<LevelManagerLike['getLevelScene']>;

  const levelManager = {
    currentLevelId: LEVEL_ID,
    getLevelScene: () => scene,
    setLevelScene: (_id: string, next: typeof scene) => { scene = next; },
    floorplans: {},
  } as unknown as LevelManagerLike;

  const find = (id: string) => (): TableEntity =>
    scene!.entities.find((e) => e.id === id) as TableEntity;

  return { source: find(SOURCE_ID), target: find(TARGET_ID), levelManager };
}

/**
 * Το wiring της παραγωγής, **με ανοιχτή συνεδρία στον πίνακα-πηγή**.
 *
 * Το `entity` δίνεται στο mount και δεν ανανεώνεται: έτσι είναι και στην παραγωγή ανάμεσα σε δύο
 * αποδόσεις — και το test οφείλει να δουλεύει εκεί, όχι σε ιδανικό κόσμο.
 */
function PainterWiringHarness(props: {
  readonly entity: TableEntity;
  readonly levelManager: LevelManagerLike;
}): React.ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const transformRef = useRef<ViewTransform>(TRANSFORM);

  useTableModeCanvasWiring({
    entity: props.entity,
    levelManager: props.levelManager,
    getSelectedEntityIds: () => [],
    containerRef,
    transformRef,
  });

  return <div ref={containerRef} data-testid="canvas" />;
}

describe('🔴 ADR-768 Βήμα 5 — το πινέλο μορφοποίησης βάφει στην πραγματική αλυσίδα', () => {
  let harness: Harness;
  let canvas: HTMLElement;
  let unmount: () => void;

  function resetAll(): void {
    executed.length = 0;
    __resetTableCellCursorStoreForTests();
    __resetTableFormatPainterForTests();
    __resetTableFormatPaintTargetForTests();
    __resetTableCanvasLockdownForTests();
    __resetTableIndicatorCursorForTests();
    __resetTableIndicatorHoverForTests();
    __resetTableInsertControlForTests();
    __resetTableDeleteControlForTests();
  }

  beforeEach(() => {
    resetAll();
    harness = createHarness();
    // Ο δρομέας ζει στον πίνακα-**πηγή**: αυτό είναι που κάνει τη λειτουργία πίνακα ενεργή, και
    // ταυτόχρονα η προϋπόθεση που απαιτεί το `armTableFormatPainter`.
    act(() => {
      setTableCellCursorById(SOURCE_ID, { rowId: 'r0', colId: 'c0', anchorColId: 'c0' }, 'nav');
    });

    const view = render(
      <PainterWiringHarness entity={harness.source()} levelManager={harness.levelManager} />,
    );
    unmount = view.unmount;
    canvas = view.getByTestId('canvas');
    canvas.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: VIEWPORT.width, height: VIEWPORT.height }) as DOMRect;
  });

  afterEach(() => {
    unmount?.();
    resetAll();
  });

  function dispatchAt(type: string, point: { readonly x: number; readonly y: number }): void {
    act(() => {
      canvas.dispatchEvent(new MouseEvent(type, {
        bubbles: true, cancelable: true, button: 0, clientX: point.x, clientY: point.y,
      }));
    });
  }

  /** Οπλίζει με τη μορφή της **κεφαλίδας** του πίνακα-πηγή — η χειρονομία του κουμπιού, αυτούσια. */
  function armFromHeader(mode: 'once' | 'locked'): void {
    const live = harness.source();
    const brush = captureTableFormatBrush(
      activeTableModel(live),
      resolveTableStyle(live),
      { firstRow: HEADER_ROW, lastRow: HEADER_ROW, firstCol: 0, lastCol: 0 },
      ALL_TABLE_FORMAT_FACETS,
    );
    if (!brush) throw new Error('το πινέλο δεν φόρτωσε από την κεφαλίδα');
    act(() => {
      armTableFormatPainter(brush, mode);
    });
  }

  /** Το σημείο ενός κελιού **δεδομένων** του πίνακα-στόχου. */
  function targetCellPoint(): { readonly x: number; readonly y: number } {
    return tableCellScreenPoint(harness.target(), DATA_ROW, 0);
  }

  /** Η **επιλυμένη** μορφή ενός κελιού — ό,τι βλέπει ο χρήστης, όχι η αποθηκευμένη παράκαμψη. */
  function formatOf(entity: TableEntity, row: number): unknown {
    return readTableCellFormat(activeTableModel(entity), resolveTableStyle(entity), {
      rowId: `r${row}`,
      colId: 'c0',
    });
  }

  it('🔴 Η ΑΛΥΣΙΔΑ: hover γράφει τον στόχο, το πάτημα βάφει — ΣΕ ΑΛΛΟΝ ΠΙΝΑΚΑ', () => {
    const before = formatOf(harness.target(), DATA_ROW);
    armFromHeader('once');

    // 1. Η κίνηση: ο ΕΝΑΣ γραφέας απαντά «αυτό το κελί θα βαφτεί».
    dispatchAt('mousemove', targetCellPoint());
    expect(getTableFormatPaintTarget()).toEqual({
      entityId: TARGET_ID, rowId: `r${DATA_ROW}`, colId: 'c0',
    });

    // 2. Το πάτημα: περνά την τρύπα του §29, καταναλώνεται, βάφει.
    dispatchAt('mousedown', targetCellPoint());

    // 3. Το ΑΠΟΤΕΛΕΣΜΑ — η μορφή του στόχου ταυτίζεται πλέον με της πηγής.
    expect(formatOf(harness.target(), DATA_ROW)).not.toEqual(before);
    expect(formatOf(harness.target(), DATA_ROW)).toEqual(formatOf(harness.source(), HEADER_ROW));
  });

  it('🔴 ΕΝΑ βήμα αναίρεσης για μία εφαρμογή (Α5)', () => {
    armFromHeader('once');
    dispatchAt('mousemove', targetCellPoint());
    dispatchAt('mousedown', targetCellPoint());

    expect(executed).toHaveLength(1);
  });

  it('🔴 βάψιμο ΧΩΡΙΣ αλλαγή ⇒ ΚΑΝΕΝΑ βήμα αναίρεσης (Α5, το δεύτερο μισό)', () => {
    armFromHeader('once');
    dispatchAt('mousemove', targetCellPoint());
    dispatchAt('mousedown', targetCellPoint());
    executed.length = 0;

    // Δεύτερο βάψιμο του ΙΔΙΟΥ κελιού με την ίδια μορφή: το `paintTableFormat` επιστρέφει το
    // ίδιο μοντέλο by-reference, άρα καμία εντολή. Αλλιώς το `Ctrl+Z` θα «δεν έκανε τίποτα».
    armFromHeader('once');
    dispatchAt('mousemove', targetCellPoint());
    dispatchAt('mousedown', targetCellPoint());

    expect(executed).toHaveLength(0);
  });

  it('🔴 ο δρομέας ΜΕΤΑΚΙΝΕΙΤΑΙ στο βαμμένο κελί (Excel), σε κατάσταση `nav`', () => {
    armFromHeader('once');
    dispatchAt('mousemove', targetCellPoint());
    dispatchAt('mousedown', targetCellPoint());

    const cursor = getTableCellCursor();
    expect(cursor?.entityId).toBe(TARGET_ID);
    expect(cursor?.position.rowId).toBe(`r${DATA_ROW}`);
    // `nav` και **κανένα πρόχειρο**: το βάψιμο δεν είναι πρόσκληση για γραφή.
    expect(cursor?.mode).toBe('nav');
  });

  it('🔴 «μία χρήση»: το πινέλο ΣΒΗΝΕΙ μετά το πρώτο βάψιμο', () => {
    armFromHeader('once');
    dispatchAt('mousemove', targetCellPoint());
    dispatchAt('mousedown', targetCellPoint());

    expect(getTableFormatPainterState()).toBe('idle');
  });

  it('🔴 «κλειδωμένο»: το πινέλο ΕΠΙΒΙΩΝΕΙ και βάφει δεύτερη φορά', () => {
    armFromHeader('locked');
    dispatchAt('mousemove', targetCellPoint());
    dispatchAt('mousedown', targetCellPoint());
    expect(getTableFormatPainterState()).toBe('locked');

    // Δεύτερο κελί, ίδια συνεδρία πινέλου — αυτό είναι όλο το νόημα του διπλού κλικ (Α1).
    const second = tableCellScreenPoint(harness.target(), DATA_ROW + 1, 0);
    dispatchAt('mousemove', second);
    dispatchAt('mousedown', second);

    expect(formatOf(harness.target(), DATA_ROW + 1)).toEqual(formatOf(harness.source(), HEADER_ROW));
    expect(getTableFormatPainterState()).toBe('locked');
  });

  it('🔴 ΧΩΡΙΣ οπλισμένο πινέλο δεν γράφεται στόχος — και τίποτα δεν βάφεται', () => {
    const before = formatOf(harness.target(), DATA_ROW);

    dispatchAt('mousemove', targetCellPoint());
    expect(getTableFormatPaintTarget()).toBeNull();

    dispatchAt('mousedown', targetCellPoint());

    expect(formatOf(harness.target(), DATA_ROW)).toEqual(before);
    expect(executed).toHaveLength(0);
  });
});
