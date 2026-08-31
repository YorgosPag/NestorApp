/**
 * ADR-739 §39 — «Εισαγωγή πίνακα…»: τα άκρα που δεν χωρούν στο πλέγμα 10×8.
 *
 * Τα όρια ελέγχονται με τις **εισαγόμενες** σταθερές του builder, ποτέ με κυριολεκτικές τιμές:
 * αν αύριο αλλάξει το `MAX_TABLE_COLUMN_COUNT`, ο διάλογος το ακολουθεί χωρίς αλλαγή test.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { TableInsertDialog } from '../TableInsertDialog';
import {
  MAX_TABLE_COLUMN_COUNT,
  MAX_TABLE_COLUMN_WIDTH_MM,
  DEFAULT_TABLE_COLUMN_WIDTH_MM,
} from '../../../../../bim/table/build-table-entity';
import { MIN_TABLE_COLUMN_WIDTH_MM } from '../../../../../types/table-entity';
import { MAX_TABLE_COLUMNS, MAX_TOTAL_TABLE_ROWS, MIN_TOTAL_TABLE_ROWS } from '../table-size-menu-model';
import { MAX_TABLE_GRID_CELLS } from '../../../../../bim/table/table-capacity';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const INITIAL_SIZE = { columnCount: 3, totalRowCount: 5 };
const mockConfirm = jest.fn();
const mockOpenChange = jest.fn();

function renderDialog() {
  render(
    <TableInsertDialog
      open
      onOpenChange={mockOpenChange}
      initialSize={INITIAL_SIZE}
      initialColumnWidthMm={DEFAULT_TABLE_COLUMN_WIDTH_MM}
      onConfirm={mockConfirm}
    />,
  );
}

/** Τα τρία αριθμητικά πεδία, με τη σειρά που εμφανίζονται: στήλες, γραμμές, πλάτος. */
function fields(): HTMLElement[] {
  return screen.getAllByRole('spinbutton');
}

function confirm() {
  fireEvent.click(screen.getByText('ribbon.commands.tableMenu.dialogConfirm'));
}

beforeEach(() => {
  mockConfirm.mockClear();
  mockOpenChange.mockClear();
});

describe('TableInsertDialog — αρχική κατάσταση', () => {
  it('ανοίγει ως διάλογος με τα τρία πεδία γεμάτα από την τρέχουσα κατάσταση', () => {
    renderDialog();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    const [columns, rows, width] = fields();
    expect(columns).toHaveValue(3);
    expect(rows).toHaveValue(5);
    expect(width).toHaveValue(DEFAULT_TABLE_COLUMN_WIDTH_MM);
  });

  it('μιλά ΣΥΝΟΛΑ, όπως το πλέγμα — το πεδίο γραμμών έχει δάπεδο 2', () => {
    renderDialog();
    expect(fields()[1]).toHaveAttribute('min', String(MIN_TOTAL_TABLE_ROWS));
    expect(fields()[1]).toHaveAttribute('max', String(MAX_TOTAL_TABLE_ROWS));
  });

  it('το πεδίο πλάτους φέρει τα όρια του builder, όχι όρια γραμμών', () => {
    renderDialog();
    expect(fields()[2]).toHaveAttribute('min', String(MIN_TABLE_COLUMN_WIDTH_MM));
    expect(fields()[2]).toHaveAttribute('max', String(MAX_TABLE_COLUMN_WIDTH_MM));
  });
});

describe('TableInsertDialog — υποβολή', () => {
  it('έγκυρες τιμές περνούν αυτούσιες, με τις γραμμές σε σύνολα', () => {
    renderDialog();
    const [columns, rows, width] = fields();
    fireEvent.change(columns, { target: { value: '12' } });
    fireEvent.change(rows, { target: { value: '30' } });
    fireEvent.change(width, { target: { value: '45' } });
    confirm();

    expect(mockConfirm).toHaveBeenCalledWith({ columnCount: 12, totalRowCount: 30 }, 45);
    expect(mockOpenChange).toHaveBeenCalledWith(false);
  });

  it('το Enter υποβάλλει χωρίς να χρειάζεται το κουμπί', () => {
    renderDialog();
    fireEvent.change(fields()[0], { target: { value: '7' } });
    fireEvent.keyDown(fields()[0], { key: 'Enter' });
    expect(mockConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ columnCount: 7 }),
      expect.any(Number),
    );
  });
});

describe('TableInsertDialog — τα άκρα κόβονται, δεν πετούν σφάλμα', () => {
  it('🔴 ADR-833 Φ5Β — τεράστιο πλήθος στηλών κόβεται στο ΓΙΝΟΜΕΝΟ που θα γεννηθεί', () => {
    renderDialog();
    fireEvent.change(fields()[0], { target: { value: '999999' } });
    confirm();
    const { columnCount, totalRowCount } = mockConfirm.mock.calls[0][0];
    expect(columnCount * totalRowCount).toBeLessThanOrEqual(MAX_TABLE_GRID_CELLS);
    expect(columnCount).toBeLessThanOrEqual(MAX_TABLE_COLUMNS);
    expect(columnCount).toBeGreaterThan(1);
  });

  it('μία γραμμή ανεβαίνει στο ελάχιστο — ο τίτλος και η κεφαλίδα υπάρχουν πάντα', () => {
    renderDialog();
    fireEvent.change(fields()[1], { target: { value: '1' } });
    confirm();
    expect(mockConfirm.mock.calls[0][0].totalRowCount).toBe(MIN_TOTAL_TABLE_ROWS);
  });

  it('μηδενικό πλάτος ανεβαίνει στο ελάχιστο', () => {
    renderDialog();
    fireEvent.change(fields()[2], { target: { value: '0' } });
    confirm();
    expect(mockConfirm.mock.calls[0][1]).toBe(MIN_TABLE_COLUMN_WIDTH_MM);
  });

  it('άδεια πεδία δεν παράγουν ποτέ NaN', () => {
    renderDialog();
    fields().forEach((field) => fireEvent.change(field, { target: { value: '' } }));
    confirm();

    const [size, width] = mockConfirm.mock.calls[0];
    expect(Number.isFinite(size.columnCount)).toBe(true);
    expect(Number.isFinite(size.totalRowCount)).toBe(true);
    expect(Number.isFinite(width)).toBe(true);
  });
});

describe('TableInsertDialog — ακύρωση', () => {
  it('το «Άκυρο» κλείνει χωρίς να δεσμεύσει τίποτα', () => {
    renderDialog();
    fireEvent.click(screen.getByText('ribbon.commands.tableMenu.dialogCancel'));
    expect(mockConfirm).not.toHaveBeenCalled();
    expect(mockOpenChange).toHaveBeenCalledWith(false);
  });
});
