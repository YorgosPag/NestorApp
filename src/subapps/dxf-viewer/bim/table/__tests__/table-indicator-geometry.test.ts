/**
 * ADR-739 Φ.Δ βήμα 9 — **η ζώνη δείκτη ως γεωμετρία**: πού ζωγραφίζεται και τι πιάνεται.
 *
 * Το ουσιώδες test αυτής της σουίτας δεν είναι κανένα από τα προφανή: είναι το
 * «το κέντρο του **ζωγραφισμένου** ορθογωνίου πέφτει στην ίδια υποδιαίρεση». Αυτό είναι που
 * κάνει το module SSoT και όχι δεύτερο αντίγραφο — αν οι δύο εκφράσεις αποκλίνουν έστω κατά
 * έναν παράγοντα, το κουτί που πατάς δεν είναι το κουτί που βλέπεις.
 */

import {
  isTableIndicatorVisible,
  tableColumnTickRectMm,
  tableIndicatorBandsMm,
  tableIndicatorCornerRectMm,
  tableIndicatorHitAtFrame,
  tableRowTickRectMm,
} from '../table-indicator-geometry';
import { tableColumnTicks, tableRowTicks } from '../table-cell-reference';
import { TABLE_INDICATOR } from '../../../config/color-config';
import type { TableLayout, TableRectMm } from '../table-layout-types';

const COLUMNS = [
  { id: 'c0', xMm: 0, widthMm: 40 },
  { id: 'c1', xMm: 40, widthMm: 40 },
  { id: 'c2', xMm: 80, widthMm: 40 },
];
const ROWS = [
  { id: 'r0', yMm: 0, heightMm: 12 },
  { id: 'r1', yMm: 12, heightMm: 8 },
  { id: 'r2', yMm: 20, heightMm: 8 },
];

const LAYOUT: TableLayout = {
  widthMm: 120,
  heightMm: 28,
  columns: COLUMNS,
  rows: ROWS,
  cells: [],
  borders: [],
};

/** 4 px ανά mm — ο πίνακας είναι 480×112 px, δηλαδή άνετα πάνω από το κατώφλι LOD. */
const PX_PER_MM = 4;
const BANDS = tableIndicatorBandsMm(PX_PER_MM);

const center = (rect: TableRectMm) => ({ u: rect.x + rect.w / 2, v: rect.y + rect.h / 2 });

describe('tableIndicatorBandsMm', () => {
  it('μεταφράζει τα px της διεπαφής σε sheet-mm της τρέχουσας κλίμακας', () => {
    expect(BANDS.columnBandMm).toBeCloseTo(TABLE_INDICATOR.columnBandPx / PX_PER_MM);
    expect(BANDS.rowBandMm).toBeCloseTo(TABLE_INDICATOR.rowBandPx / PX_PER_MM);
  });

  it('η αριστερή ζώνη είναι πλατύτερη από την πάνω — χωρά τετραψήφιους αριθμούς', () => {
    expect(BANDS.rowBandMm).toBeGreaterThan(BANDS.columnBandMm);
  });
});

describe('isTableIndicatorVisible', () => {
  it('πίνακας-κουκκίδα ⇒ καμία ζώνη (το ΙΔΙΟ κατώφλι με τον ζωγράφο)', () => {
    expect(isTableIndicatorVisible(120, 28, 0.2)).toBe(false);
    expect(isTableIndicatorVisible(120, 28, PX_PER_MM)).toBe(true);
  });

  it('αρκεί ΜΙΑ διάσταση κάτω από το κατώφλι', () => {
    expect(isTableIndicatorVisible(120, 2, PX_PER_MM)).toBe(false);
  });
});

describe('tableIndicatorHitAtFrame', () => {
  it('🔴 το κέντρο του ΖΩΓΡΑΦΙΣΜΕΝΟΥ ορθογωνίου πέφτει στην ίδια στήλη', () => {
    const ticks = tableColumnTicks(COLUMNS, new Set());
    ticks.forEach((tick, index) => {
      const hit = tableIndicatorHitAtFrame(LAYOUT, center(tableColumnTickRectMm(tick, BANDS)), BANDS);
      expect(hit).toEqual({ axis: 'column', colId: COLUMNS[index].id, index });
    });
  });

  it('🔴 το ίδιο για κάθε αριθμό γραμμής', () => {
    const ticks = tableRowTicks(ROWS, new Set(), 0, ROWS.length);
    ticks.forEach((tick, index) => {
      const hit = tableIndicatorHitAtFrame(LAYOUT, center(tableRowTickRectMm(tick, BANDS)), BANDS);
      expect(hit).toEqual({ axis: 'row', rowId: ROWS[index].id, index });
    });
  });

  it('η γωνία δεν είναι εντολή — ο ζωγράφος την αφήνει κενή, το κλικ επιστρέφει null', () => {
    expect(tableIndicatorHitAtFrame(LAYOUT, center(tableIndicatorCornerRectMm(BANDS)), BANDS)).toBeNull();
  });

  it('μέσα στο πλέγμα δεν είναι ζώνη — εκεί απαντά το `tableCellAtFrame`', () => {
    expect(tableIndicatorHitAtFrame(LAYOUT, { u: 20, v: 5 }, BANDS)).toBeNull();
  });

  it('πάνω από τη ζώνη, δεξιά του πίνακα, κάτω από τον πίνακα ⇒ null', () => {
    expect(tableIndicatorHitAtFrame(LAYOUT, { u: 20, v: -BANDS.columnBandMm - 1 }, BANDS)).toBeNull();
    expect(tableIndicatorHitAtFrame(LAYOUT, { u: 200, v: -1 }, BANDS)).toBeNull();
    expect(tableIndicatorHitAtFrame(LAYOUT, { u: -1, v: 200 }, BANDS)).toBeNull();
  });

  it('η ζώνη γραμμών δεν διεκδικεί το πλάτος της ζώνης στηλών και αντίστροφα', () => {
    // Σημείο αριστερά του πλέγματος, στο ύψος της πρώτης γραμμής ⇒ γραμμή, όχι στήλη.
    const hit = tableIndicatorHitAtFrame(LAYOUT, { u: -1, v: 6 }, BANDS);
    expect(hit).toEqual({ axis: 'row', rowId: 'r0', index: 0 });
  });
});
