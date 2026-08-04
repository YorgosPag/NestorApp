/**
 * ADR-739 §39 — το λεξιλόγιο του επιλογέα μεγέθους.
 *
 * Το κρίσιμο test εδώ είναι η **ισοδυναμία με τον builder**: αν κάποιος αλλάξει το `buildRows`,
 * σπάει εδώ και όχι στην οθόνη του χρήστη.
 */

import {
  MAX_TABLE_COLUMN_COUNT,
  TABLE_FIXED_ROW_COUNT,
  buildTableEntity,
} from '../../../../../bim/table/build-table-entity';
import {
  MAX_TOTAL_TABLE_ROWS,
  MIN_TOTAL_TABLE_ROWS,
  TABLE_SIZE_GRID_COLUMNS,
  TABLE_SIZE_GRID_ROWS,
  dataRowCountToTotalRows,
  gridCellToSize,
  isCellInSelection,
  sanitizeMenuSize,
  toMenuSize,
  totalRowsToDataRowCount,
} from '../table-size-menu-model';

const ORIGIN = { x: 0, y: 0 };

describe('table-size-menu-model — πλέγμα → μέγεθος', () => {
  it('η κυψελίδα (4,1) δίνει «5×2» — η λεζάντα του Word', () => {
    expect(gridCellToSize(4, 1)).toEqual({ columnCount: 5, totalRowCount: 2 });
  });

  it('η πρώτη σειρά ΔΕΝ δίνει σύνολο 1 — κόβεται στο δάπεδο των σταθερών γραμμών', () => {
    expect(gridCellToSize(4, 0).totalRowCount).toBe(MIN_TOTAL_TABLE_ROWS);
    expect(MIN_TOTAL_TABLE_ROWS).toBe(TABLE_FIXED_ROW_COUNT);
  });

  it('η τελευταία κυψελίδα του πλέγματος δίνει 10×8', () => {
    const size = gridCellToSize(TABLE_SIZE_GRID_COLUMNS - 1, TABLE_SIZE_GRID_ROWS - 1);
    expect(size).toEqual({ columnCount: 10, totalRowCount: 8 });
  });

  it('οι διαστάσεις του πλέγματος είναι οι 10×8 του Word', () => {
    expect(TABLE_SIZE_GRID_COLUMNS).toBe(10);
    expect(TABLE_SIZE_GRID_ROWS).toBe(8);
  });

  it('η φωτισμένη περιοχή είναι ακριβώς το ορθογώνιο του μεγέθους', () => {
    const size = { columnCount: 5, totalRowCount: 2 };
    let lit = 0;
    for (let row = 0; row < TABLE_SIZE_GRID_ROWS; row++) {
      for (let col = 0; col < TABLE_SIZE_GRID_COLUMNS; col++) {
        if (isCellInSelection(col, row, size)) lit++;
      }
    }
    expect(lit).toBe(10); // 5 στήλες × 2 γραμμές
    expect(isCellInSelection(4, 1, size)).toBe(true);
    expect(isCellInSelection(5, 1, size)).toBe(false);
    expect(isCellInSelection(4, 2, size)).toBe(false);
  });
});

describe('table-size-menu-model — σύνολο ⇄ δεδομένα', () => {
  it('το ελάχιστο σύνολο αντιστοιχεί σε μηδέν γραμμές δεδομένων', () => {
    expect(totalRowsToDataRowCount(MIN_TOTAL_TABLE_ROWS)).toBe(0);
    expect(totalRowsToDataRowCount(9)).toBe(7);
  });

  it('ποτέ αρνητικές γραμμές δεδομένων, ακόμη και με σύνολο κάτω από το δάπεδο', () => {
    expect(totalRowsToDataRowCount(0)).toBe(0);
    expect(totalRowsToDataRowCount(1)).toBe(0);
  });

  it('round-trip: σύνολο → δεδομένα → σύνολο', () => {
    for (let total = MIN_TOTAL_TABLE_ROWS; total <= 9; total++) {
      expect(dataRowCountToTotalRows(totalRowsToDataRowCount(total))).toBe(total);
    }
  });

  it('το toMenuSize μεταφράζει την κατάσταση του store', () => {
    expect(toMenuSize(3, 3)).toEqual({ columnCount: 3, totalRowCount: 5 });
  });
});

describe('table-size-menu-model — καθαρισμός', () => {
  it('μη-πεπερασμένες τιμές δεν διαρρέουν ποτέ', () => {
    const size = sanitizeMenuSize({ columnCount: NaN, totalRowCount: Infinity });
    expect(Number.isFinite(size.columnCount)).toBe(true);
    expect(Number.isFinite(size.totalRowCount)).toBe(true);
  });

  it('φράσσει στα άκρα του builder, χωρίς κυριολεκτικές τιμές στο test', () => {
    const huge = sanitizeMenuSize({ columnCount: 999_999, totalRowCount: 999_999 });
    expect(huge.columnCount).toBe(MAX_TABLE_COLUMN_COUNT);
    expect(huge.totalRowCount).toBe(MAX_TOTAL_TABLE_ROWS);
  });

  it('σύνολο κάτω από το δάπεδο ανεβαίνει στο ελάχιστο', () => {
    expect(sanitizeMenuSize({ columnCount: 5, totalRowCount: 1 }).totalRowCount)
      .toBe(MIN_TOTAL_TABLE_ROWS);
  });

  it('μηδέν στήλες γίνονται μία — πίνακας χωρίς πλάτος είναι αόρατη οντότητα', () => {
    expect(sanitizeMenuSize({ columnCount: 0, totalRowCount: 4 }).columnCount).toBe(1);
  });
});

describe('table-size-menu-model — ισοδυναμία με τον builder (ο φρουρός)', () => {
  it('όσες γραμμές λέει η λεζάντα, τόσες γεννά ο builder', () => {
    for (let total = MIN_TOTAL_TABLE_ROWS; total <= 9; total++) {
      const entity = buildTableEntity(
        ORIGIN,
        { dataRowCount: totalRowsToDataRowCount(total) },
        `tbl_${total}`,
        'layer_0',
      );
      expect(entity.model.rows).toHaveLength(total);
    }
  });

  it('όσες στήλες λέει η λεζάντα, τόσες γεννά ο builder', () => {
    const size = gridCellToSize(4, 1); // 5×2
    const entity = buildTableEntity(
      ORIGIN,
      { columnCount: size.columnCount, dataRowCount: totalRowsToDataRowCount(size.totalRowCount) },
      'tbl_5x2',
      'layer_0',
    );
    expect(entity.model.columns).toHaveLength(5);
    expect(entity.model.rows).toHaveLength(2);
  });

  it('ο πίνακας γεννιέται ΕΝΤΕΛΩΣ ΚΕΝΟΣ — καμία κεφαλίδα, καμία συγχώνευση', () => {
    const entity = buildTableEntity(ORIGIN, { columnCount: 5, dataRowCount: 0 }, 'tbl', 'layer_0');
    expect(entity.model.cells).toHaveLength(0);
    expect(entity.model.merges).toHaveLength(0);
  });
});
