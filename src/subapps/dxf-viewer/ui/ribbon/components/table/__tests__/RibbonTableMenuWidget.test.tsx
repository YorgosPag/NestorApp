/**
 * ADR-739 §39 — το συμβόλαιο του επιλογέα μεγέθους, από άκρη σε άκρη.
 *
 * Ο store είναι **πραγματικός** zustand: μόνο το ribbon dispatch mockάρεται. Έτσι το test
 * απαντά στην ερώτηση που έχει σημασία — «γράφτηκε πράγματι το μέγεθος;» — και όχι «κλήθηκε
 * κάποιο mock;».
 */

import { fireEvent, render, screen, within } from '@testing-library/react';
import { RibbonTableMenuWidget } from '../RibbonTableMenuWidget';
import { useTableOptionsStore } from '../../../../../state/table-options-store';
import { activeTableModel } from '../../../../../bim/table/table-worksheet-resolve';
import {
  DEFAULT_TABLE_COLUMN_COUNT,
  DEFAULT_TABLE_DATA_ROW_COUNT,
  DEFAULT_TABLE_COLUMN_WIDTH_MM,
  buildTableEntity,
} from '../../../../../bim/table/build-table-entity';
import {
  TABLE_SIZE_GRID_COLUMNS,
  TABLE_SIZE_GRID_ROWS,
  totalRowsToDataRowCount,
} from '../table-size-menu-model';

// Το `t` επιστρέφει το κλειδί: τα assertions κοιτούν ΔΟΜΗ και ΚΑΤΑΣΤΑΣΗ, ποτέ κείμενο —
// έτσι μια αλλαγή διατύπωσης στα locale δεν βάφει κόκκινα τα tests συμπεριφοράς.
jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockOnToolChange = jest.fn();
jest.mock('../../../context/RibbonCommandContext', () => ({
  useRibbonDispatch: () => ({
    onToolChange: mockOnToolChange,
    activeTool: 'select',
    getCommandRecommendation: () => true,
  }),
}));

/** Η κυψελίδα «5 στήλες × 2 γραμμές» — 0-based (col 4, row 1). */
const CELL_5x2 = { col: 4, row: 1 };

function openMenu() {
  render(<RibbonTableMenuWidget />);
  fireEvent.click(screen.getByRole('button', { expanded: false }));
}

function cellAt(col: number, row: number): HTMLElement {
  const grid = screen.getByRole('grid');
  const cell = grid.querySelector<HTMLElement>(`[data-col="${col}"][data-row="${row}"]`);
  if (!cell) throw new Error(`Δεν βρέθηκε κυψελίδα ${col},${row}`);
  return cell;
}

beforeEach(() => {
  mockOnToolChange.mockClear();
  useTableOptionsStore.setState({
    columnCount: DEFAULT_TABLE_COLUMN_COUNT,
    dataRowCount: DEFAULT_TABLE_DATA_ROW_COUNT,
    columnWidthMm: DEFAULT_TABLE_COLUMN_WIDTH_MM,
  });
});

describe('RibbonTableMenuWidget — ο trigger', () => {
  it('δηλώνει ότι ανοίγει popup και ξεκινά κλειστός, χωρίς πλέγμα στο DOM', () => {
    render(<RibbonTableMenuWidget />);
    const trigger = screen.getByRole('button', { expanded: false });
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    expect(screen.queryByRole('grid')).toBeNull();
  });

  it('ΔΕΝ οπλίζει το εργαλείο με σκέτο κλικ — αυτό ήταν η παλιά συμπεριφορά', () => {
    render(<RibbonTableMenuWidget />);
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    expect(mockOnToolChange).not.toHaveBeenCalled();
  });
});

describe('RibbonTableMenuWidget — το πλέγμα', () => {
  it('ανοίγει με πλήρες πλέγμα 10×8', () => {
    openMenu();
    const grid = screen.getByRole('grid');
    expect(within(grid).getAllByRole('gridcell')).toHaveLength(
      TABLE_SIZE_GRID_COLUMNS * TABLE_SIZE_GRID_ROWS,
    );
  });

  it('το hover στην (5,2) φωτίζει ΑΚΡΙΒΩΣ 10 κυψελίδες', () => {
    openMenu();
    fireEvent.mouseEnter(cellAt(CELL_5x2.col, CELL_5x2.row));
    const selected = screen
      .getByRole('grid')
      .querySelectorAll('[aria-selected="true"]');
    expect(selected).toHaveLength(10); // 5 στήλες × 2 γραμμές
  });

  it('η λεζάντα είναι ζωντανή περιοχή που περιγράφει το πλέγμα', () => {
    openMenu();
    const grid = screen.getByRole('grid');
    const captionId = grid.getAttribute('aria-describedby');
    expect(captionId).toBeTruthy();
    expect(document.getElementById(captionId as string))
      .toHaveAttribute('aria-live', 'polite');
  });
});

describe('RibbonTableMenuWidget — το συμβόλαιο του κλικ', () => {
  it('γράφει το μέγεθος στον store ΚΑΙ οπλίζει το εργαλείο', () => {
    openMenu();
    fireEvent.click(cellAt(CELL_5x2.col, CELL_5x2.row));

    const state = useTableOptionsStore.getState();
    expect(state.columnCount).toBe(5);
    expect(state.dataRowCount).toBe(totalRowsToDataRowCount(2)); // 0 γραμμές δεδομένων
    expect(mockOnToolChange).toHaveBeenCalledWith('table');
  });

  it('ο store γράφεται ΠΡΙΝ το onToolChange — αλλιώς το φάντασμα δείχνει το παλιό μέγεθος', () => {
    let columnsWhenToolArmed = -1;
    mockOnToolChange.mockImplementation(() => {
      columnsWhenToolArmed = useTableOptionsStore.getState().columnCount;
    });

    openMenu();
    fireEvent.click(cellAt(CELL_5x2.col, CELL_5x2.row));

    expect(columnsWhenToolArmed).toBe(5);
  });

  it('κλείνει το μενού μετά την επιλογή', () => {
    openMenu();
    fireEvent.click(cellAt(CELL_5x2.col, CELL_5x2.row));
    expect(screen.queryByRole('grid')).toBeNull();
  });

  it('ο πίνακας που θα γεννηθεί είναι ΕΝΤΕΛΩΣ ΚΕΝΟΣ — ο φρουρός της απόφασης 2026-08-04', () => {
    openMenu();
    fireEvent.click(cellAt(CELL_5x2.col, CELL_5x2.row));

    const { columnCount, dataRowCount } = useTableOptionsStore.getState();
    const entity = buildTableEntity({ x: 0, y: 0 }, { columnCount, dataRowCount }, 'tbl', 'layer_0');
    expect(activeTableModel(entity).cells).toHaveLength(0);
    expect(activeTableModel(entity).merges).toHaveLength(0);
    expect(activeTableModel(entity).columns).toHaveLength(5);
    expect(activeTableModel(entity).rows).toHaveLength(2);
  });
});

describe('RibbonTableMenuWidget — πληκτρολόγιο', () => {
  it('roving tabindex: ακριβώς μία κυψελίδα είναι εστιάσιμη', () => {
    openMenu();
    const focusable = screen.getByRole('grid').querySelectorAll('[tabindex="0"]');
    expect(focusable).toHaveLength(1);
  });

  it('βέλη + Enter δεσμεύουν το μέγεθος στο οποίο έφτασε η εστίαση', () => {
    openMenu();
    const grid = screen.getByRole('grid');
    // Αρχική εστίαση = το τρέχον μέγεθος (3 στήλες, σύνολο 5) ⇒ col 2, row 4.
    fireEvent.keyDown(grid, { key: 'ArrowRight' });
    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    fireEvent.keyDown(grid, { key: 'Enter' });

    const state = useTableOptionsStore.getState();
    expect(state.columnCount).toBe(4); // 3 + 1
    expect(state.dataRowCount).toBe(totalRowsToDataRowCount(6)); // 5 + 1 σύνολο
    expect(mockOnToolChange).toHaveBeenCalledWith('table');
  });

  it('το Tab ΔΕΝ ακυρώνεται — πρέπει να βγάζει από το πλέγμα', () => {
    openMenu();
    const event = fireEvent.keyDown(screen.getByRole('grid'), { key: 'Tab' });
    expect(event).toBe(true); // δεν έγινε preventDefault
  });
});

describe('RibbonTableMenuWidget — το πλάτος στήλης', () => {
  it('το πεδίο υπάρχει στο ανοιχτό μενού και γράφει στον store', () => {
    openMenu();
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '55' } });
    expect(useTableOptionsStore.getState().columnWidthMm).toBe(55);
  });

  it('άδειασμα του πεδίου δεν αφήνει NaN να διαρρεύσει', () => {
    openMenu();
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '' } });
    expect(Number.isFinite(useTableOptionsStore.getState().columnWidthMm)).toBe(true);
  });
});
