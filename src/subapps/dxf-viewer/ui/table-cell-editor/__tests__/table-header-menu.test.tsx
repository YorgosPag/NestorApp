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
import { CoordinateTransforms } from '../../../rendering/core/CoordinateTransforms';
import { buildTableEntity } from '../../../bim/table/build-table-entity';
import {
  computeTableEntityGeometryLive,
  tableFrameToWorld,
  tablePxPerMm,
} from '../../../bim/table/table-entity-geometry';
import { tableIndicatorBandsMm } from '../../../bim/table/table-indicator-geometry';
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
const VIEWPORT = { width: 1200, height: 800 };
const TRANSFORM: ViewTransform = { scale: 1, offsetX: 0, offsetY: 0 };

interface Harness {
  readonly entity: () => TableEntity;
  readonly levelManager: LevelManagerLike;
  readonly containerRef: { current: HTMLDivElement | null };
  readonly transformRef: { current: ViewTransform };
}

function createHarness(): Harness {
  const table = buildTableEntity({ x: 0, y: 0 }, {}, 'table-1', 'layer-0');
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

/** Το σημείο **οθόνης** που πέφτει στο κέντρο της ζώνης μιας στήλης / γραμμής. */
function bandScreenPoint(
  entity: TableEntity,
  axis: 'column' | 'row',
  index: number,
): { readonly x: number; readonly y: number } {
  const geometry = computeTableEntityGeometryLive(entity);
  const bands = tableIndicatorBandsMm(tablePxPerMm(geometry.mmToWorld, TRANSFORM.scale));
  const { columns, rows } = geometry.layout;

  const u = axis === 'column'
    ? columns[index].xMm + columns[index].widthMm / 2
    : -bands.rowBandMm / 2;
  const v = axis === 'column'
    ? -bands.columnBandMm / 2
    : rows[index].yMm + rows[index].heightMm / 2;

  const world = tableFrameToWorld(entity, u, v, geometry.mmToWorld);
  return CoordinateTransforms.worldToScreen(world, TRANSFORM, VIEWPORT);
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
    const point = bandScreenPoint(harness.entity(), 'column', 1);
    expect(getTableHeaderMenuPort()?.getHit(point.x, point.y)).toBeNull();
  });

  it('🔴 βρίσκει τη ΣΩΣΤΗ στήλη από συντεταγμένες οθόνης (screen → world → frame → ζώνη)', () => {
    openCursor(harness);
    mount(harness);
    const point = bandScreenPoint(harness.entity(), 'column', 1);
    expect(getTableHeaderMenuPort()?.getHit(point.x, point.y)).toEqual({
      axis: 'column',
      colId: harness.entity().model.columns[1].id,
      index: 1,
    });
  });

  it('🔴 βρίσκει τη ΣΩΣΤΗ γραμμή — η αριστερή ζώνη δεν συγχέεται με την πάνω', () => {
    openCursor(harness);
    mount(harness);
    const point = bandScreenPoint(harness.entity(), 'row', 2);
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
    clickAt(bandScreenPoint(harness.entity(), 'column', 1));

    const model = harness.entity().model;
    const cursor = getTableCellCursor();
    expect(cursor?.selection).toEqual({
      from: { rowId: model.rows[0].id, colId: model.columns[1].id },
      to: { rowId: model.rows[model.rows.length - 1].id, colId: model.columns[1].id },
    });
    // Το ενεργό κελί πάει στην ΑΡΧΗ του άξονα (Excel): εκεί αρχίζει η πληκτρολόγηση.
    expect(cursor?.position.rowId).toBe(model.rows[0].id);
    expect(cursor?.position.colId).toBe(model.columns[1].id);
  });

  it('🔴 κλικ στον αριθμό «3» ⇒ μαρκάρεται ΟΛΗ η γραμμή', () => {
    openCursor(harness);
    mountPointer();
    clickAt(bandScreenPoint(harness.entity(), 'row', 2));

    const model = harness.entity().model;
    expect(getTableCellCursor()?.selection).toEqual({
      from: { rowId: model.rows[2].id, colId: model.columns[0].id },
      to: { rowId: model.rows[2].id, colId: model.columns[model.columns.length - 1].id },
    });
  });

  it('κλικ ΜΕΣΑ στο πλέγμα μένει ό,τι ήταν: μετακίνηση κελιού, καμία περιοχή', () => {
    openCursor(harness);
    mountPointer();
    const geometry = computeTableEntityGeometryLive(harness.entity());
    const cell = geometry.layout.cells[4];
    const world = tableFrameToWorld(
      harness.entity(),
      cell.rect.x + cell.rect.w / 2,
      cell.rect.y + cell.rect.h / 2,
      geometry.mmToWorld,
    );
    clickAt(CoordinateTransforms.worldToScreen(world, TRANSFORM, VIEWPORT));

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
describe('🔴 το μενού είναι ΜΕΛΟΣ της συνεδρίας επεξεργασίας', () => {
  const noop = (): void => {};
  const menuProps = {
    onInsertBefore: noop,
    onInsertAfter: noop,
    onDelete: noop,
    onClosed: noop,
    resolveState: () => ({ label: 'B', canInsert: true, canDelete: true }),
  };

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

/** Ο χρήστης μπήκε στον πίνακα (διπλό κλικ / `Enter`) — χωρίς αυτό δεν υπάρχουν ζώνες. */
function openCursor(harness: Harness): void {
  const model = harness.entity().model;
  setTableCellCursor('table-1', tableCursorAt(model.rows[0].id, model.columns[0].id), 'nav');
}
