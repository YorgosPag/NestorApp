/**
 * ADR-739 Φάση Α — unit tests της μηχανής διάταξης πίνακα.
 *
 * Ο μετρητής κειμένου είναι **ενεθειμένος και ντετερμινιστικός** (`0.6 × ύψος` ανά
 * χαρακτήρα): ο πραγματικός (`measureTextAdvanceWorld`) πέφτει σε διαφορετική βαθμίδα
 * ανάλογα με το αν έχει φορτωθεί γραμματοσειρά ή υπάρχει DOM, άρα τα αριθμητικά πλάτη
 * δεν θα ήταν συγκρίσιμα μεταξύ περιβαλλόντων. Η ένεση υπάρχει γι' αυτό — **όχι** ως
 * δεύτερη υλοποίηση μέτρησης (N.18).
 */

import { layoutTable, visibleRowRange } from '../table-layout';
import { createTableModel } from '../table-model-helpers';
import {
  BUILTIN_TABLE_STYLE_IDS,
  BUILTIN_TABLE_STYLES,
  DETAIL_SHEET_BASELINE_INSET_MM,
  DETAIL_SHEET_HEADER_HEIGHT_MM,
  DETAIL_SHEET_RULE,
  DETAIL_SHEET_ROW_HEIGHT_MM,
  DETAIL_SHEET_RULE_HEX,
  DETAIL_SHEET_TEXT_HEIGHT_MM,
} from '../table-style-presets';
import type { TableStyle } from '../table-style';
import type { TableTextMeasurer } from '../table-layout-types';
import type { TableCell, TableColumn, TableRow } from '../../../types/table';

// ── Εργαλεία ────────────────────────────────────────────────────────────────

/** Ντετερμινιστικός μετρητής: κάθε χαρακτήρας 0.6 × ύψος· bold δεν αλλάζει πλάτος. */
const measureText: TableTextMeasurer = (text, heightMm) => text.length * heightMm * 0.6;

function styleById(id: string): TableStyle {
  const style = BUILTIN_TABLE_STYLES.find((s) => s.id === id);
  if (!style) throw new Error(`missing preset: ${id}`);
  return style;
}

const STANDARD = styleById(BUILTIN_TABLE_STYLE_IDS.STANDARD);
const DETAIL_SHEET = styleById(BUILTIN_TABLE_STYLE_IDS.DETAIL_SHEET);

function col(id: string, sizing: TableColumn['sizing'], align: TableColumn['align'] = 'left'): TableColumn {
  return { id, sizing, valueType: 'text', align };
}

function row(id: string, rowClass: TableRow['rowClass'] = 'data', extra?: Partial<TableRow>): TableRow {
  return { id, rowClass, ...extra };
}

function text(value: string): TableCell {
  return { kind: 'text', value };
}

// ── Μέγεθος στηλών ──────────────────────────────────────────────────────────

describe('layoutTable — μέγεθος στηλών (Figma Auto Layout)', () => {
  it('fixed: κρατά το δηλωμένο πλάτος', () => {
    const model = createTableModel({
      columns: [col('a', { kind: 'fixed', widthMm: 40 })],
      rows: [row('r1')],
    });
    expect(layoutTable(model, STANDARD, { measureText }).columns[0].widthMm).toBe(40);
  });

  it('hug: παίρνει το πλατύτερο περιεχόμενο + τα δύο περιθώρια', () => {
    const model = createTableModel({
      columns: [col('a', { kind: 'hug' })],
      rows: [row('r1'), row('r2')],
      cells: [
        ['r1', 'a', text('AB')],
        ['r2', 'a', text('ABCDE')],
      ],
    });
    const layout = layoutTable(model, STANDARD, { measureText });
    const textMm = 5 * STANDARD.rowClasses.data.textHeightMm * 0.6;
    expect(layout.columns[0].widthMm).toBeCloseTo(textMm + STANDARD.rowClasses.data.margins.hMm * 2, 6);
  });

  it('hug: κενή στήλη πέφτει στο ελάχιστο του στυλ, ποτέ σε μηδέν', () => {
    const model = createTableModel({ columns: [col('a', { kind: 'hug' })], rows: [row('r1')] });
    expect(layoutTable(model, STANDARD, { measureText }).columns[0].widthMm)
      .toBe(STANDARD.minColumnWidthMm);
  });

  it('fill: μοιράζεται το υπόλοιπο κατά βάρος', () => {
    const model = createTableModel({
      columns: [
        col('fixed', { kind: 'fixed', widthMm: 40 }),
        col('a', { kind: 'fill', weight: 1 }),
        col('b', { kind: 'fill', weight: 3 }),
      ],
      rows: [row('r1')],
    });
    const layout = layoutTable(model, STANDARD, { measureText, availableWidthMm: 140 });
    expect(layout.columns[1].widthMm).toBeCloseTo(25, 6); // (140-40) × 1/4
    expect(layout.columns[2].widthMm).toBeCloseTo(75, 6); // (140-40) × 3/4
    expect(layout.widthMm).toBeCloseTo(140, 6);
  });

  it('fill χωρίς δηλωμένο διαθέσιμο πλάτος: υποχωρεί στο ελάχιστο αντί για μηδέν', () => {
    const model = createTableModel({
      columns: [col('a', { kind: 'fill', weight: 1 })],
      rows: [row('r1')],
    });
    expect(layoutTable(model, STANDARD, { measureText }).columns[0].widthMm)
      .toBe(STANDARD.minColumnWidthMm);
  });

  it('fill σε ξεχειλισμένο πίνακα: ελάχιστο, ποτέ αρνητικό πλάτος', () => {
    const model = createTableModel({
      columns: [col('fixed', { kind: 'fixed', widthMm: 200 }), col('a', { kind: 'fill', weight: 1 })],
      rows: [row('r1')],
    });
    expect(layoutTable(model, STANDARD, { measureText, availableWidthMm: 50 }).columns[1].widthMm)
      .toBe(STANDARD.minColumnWidthMm);
  });

  it('συγχωνευμένο κελί ΔΕΝ φουσκώνει τη στήλη-άγκυρα (hug)', () => {
    const columns = [col('a', { kind: 'hug' }), col('b', { kind: 'hug' })];
    const rows = [row('title', 'title'), row('r1')];
    const cells: readonly (readonly [string, string, TableCell])[] = [
      ['title', 'a', text('ΠΟΛΥ ΜΑΚΡΥΣ ΤΙΤΛΟΣ')],
      ['r1', 'a', text('ΑΒ')],
      ['r1', 'b', text('ΓΔ')],
    ];
    const merged = layoutTable(
      createTableModel({ columns, rows, cells, merges: [{ anchorRowId: 'title', anchorColId: 'a', rowSpan: 1, colSpan: 2 }] }),
      STANDARD,
      { measureText },
    );
    const unmerged = layoutTable(createTableModel({ columns, rows, cells }), STANDARD, { measureText });
    expect(merged.columns[0].widthMm).toBeLessThan(unmerged.columns[0].widthMm);
  });
});

// ── Ύψη γραμμών ─────────────────────────────────────────────────────────────

describe('layoutTable — ύψη γραμμών', () => {
  it('χρησιμοποιεί το ρητό ύψος της γραμμής, αλλιώς το προεπιλεγμένο του στυλ', () => {
    const model = createTableModel({
      columns: [col('a', { kind: 'fixed', widthMm: 10 })],
      rows: [row('r1'), row('r2', 'data', { heightMm: 20 })],
    });
    const layout = layoutTable(model, STANDARD, { measureText });
    expect(layout.rows[0].heightMm).toBe(STANDARD.defaultRowHeightMm);
    expect(layout.rows[1].heightMm).toBe(20);
    expect(layout.rows[1].yMm).toBe(STANDARD.defaultRowHeightMm);
    expect(layout.heightMm).toBe(STANDARD.defaultRowHeightMm + 20);
  });
});

// ── Κελιά + στοίχιση ────────────────────────────────────────────────────────

describe('layoutTable — κελιά και στοίχιση', () => {
  const model = createTableModel({
    columns: [col('a', { kind: 'fixed', widthMm: 40 }, 'left'), col('b', { kind: 'fixed', widthMm: 40 }, 'right')],
    rows: [row('r1')],
    cells: [['r1', 'a', text('X')], ['r1', 'b', text('9')]],
  });

  it('κενό κελί δεν παράγει καθόλου κείμενο (κανένα glyph να ζωγραφιστεί)', () => {
    const empty = createTableModel({
      columns: [col('a', { kind: 'fixed', widthMm: 10 })],
      rows: [row('r1')],
    });
    expect(layoutTable(empty, STANDARD, { measureText }).cells[0].text).toBeUndefined();
  });

  it('η στήλη καθορίζει την οριζόντια στοίχιση όταν το κελί δεν έχει άποψη', () => {
    const layout = layoutTable(model, STANDARD, { measureText });
    expect(layout.cells[0].text?.hAlign).toBe('left');
    expect(layout.cells[1].text?.hAlign).toBe('right');
  });

  it('η παράκαμψη του κελιού νικά τη στήλη', () => {
    const overridden = createTableModel({
      columns: [col('a', { kind: 'fixed', widthMm: 40 }, 'left')],
      rows: [row('r1')],
      cells: [['r1', 'a', { kind: 'text', value: 'X', styleOverride: { align: 'MR' } }]],
    });
    expect(layoutTable(overridden, STANDARD, { measureText }).cells[0].text?.hAlign).toBe('right');
  });

  /**
   * ADR-739 §16.4 — ο μηχανισμός της απορρόφησης του ADR-622. Η κεφαλίδα έχει μηδενικό
   * κατακόρυφο περιθώριο (κείμενο στην κορυφή), τα δεδομένα κάθονται `INSET` χαμηλότερα.
   * Μαζί με το κοντύτερο ύψος κεφαλίδας, αυτά τα δύο αναπαράγουν το `y - ROW_H*0.2` του
   * παλιού πίνακα **χωρίς καμία ειδική περίπτωση στη μηχανή**.
   */
  it('στοίχιση «πάνω»: κεφαλίδα στην κορυφή, δεδομένα INSET χαμηλότερα (σύμβαση ADR-622)', () => {
    const sheet = createTableModel({
      columns: [col('a', { kind: 'fixed', widthMm: 40 })],
      rows: [row('h', 'header', { heightMm: DETAIL_SHEET_HEADER_HEIGHT_MM }), row('r1')],
      cells: [['h', 'a', text('H')], ['r1', 'a', text('X')]],
    });
    const layout = layoutTable(sheet, DETAIL_SHEET, { measureText });
    const [header, data] = layout.cells;
    expect(header.text?.position.y).toBeCloseTo(DETAIL_SHEET_TEXT_HEIGHT_MM, 6);
    expect(data.text?.position.y).toBeCloseTo(
      DETAIL_SHEET_HEADER_HEIGHT_MM + DETAIL_SHEET_BASELINE_INSET_MM + DETAIL_SHEET_TEXT_HEIGHT_MM,
      6,
    );
  });

  it('η αλγεβρική ταυτότητα του ADR-622: baseline γραμμής N === 7.5N + 2.6', () => {
    const sheet = createTableModel({
      columns: [col('a', { kind: 'fixed', widthMm: 40 })],
      rows: [
        row('h', 'header', { heightMm: DETAIL_SHEET_HEADER_HEIGHT_MM }),
        ...Array.from({ length: 5 }, (_, i) => row(`d${i}`)),
      ],
      cells: Array.from({ length: 5 }, (_, i) => [`d${i}`, 'a', text('X')] as const),
    });
    const layout = layoutTable(sheet, DETAIL_SHEET, { measureText });
    layout.cells
      .filter((c) => c.rowId !== 'h')
      .forEach((cell, i) => {
        const n = i + 1; // ο ADR-622 μετρά τις γραμμές δεδομένων από το 1
        expect(cell.text?.position.y).toBeCloseTo(
          DETAIL_SHEET_ROW_HEIGHT_MM * n + DETAIL_SHEET_TEXT_HEIGHT_MM,
          6,
        );
      });
  });
});

// ── Συγχωνεύσεις ────────────────────────────────────────────────────────────

describe('layoutTable — συγχωνεύσεις', () => {
  const model = createTableModel({
    columns: [
      col('a', { kind: 'fixed', widthMm: 30 }),
      col('b', { kind: 'fixed', widthMm: 30 }),
      col('c', { kind: 'fixed', widthMm: 30 }),
    ],
    rows: [row('r1'), row('r2')],
    cells: [['r1', 'a', text('ΣΥΓΧΩΝΕΥΜΕΝΟ')]],
    merges: [{ anchorRowId: 'r1', anchorColId: 'a', rowSpan: 2, colSpan: 2 }],
  });
  const layout = layoutTable(model, STANDARD, { measureText });

  it('τα καλυμμένα κελιά δεν υπάρχουν καθόλου ως γεωμετρία', () => {
    const keys = layout.cells.map((c) => `${c.rowId}/${c.colId}`);
    expect(keys).toContain('r1/a');
    expect(keys).not.toContain('r1/b');
    expect(keys).not.toContain('r2/a');
    expect(keys).not.toContain('r2/b');
    expect(keys).toContain('r1/c'); // εκτός εύρους συγχώνευσης
  });

  it('το ορθογώνιο της άγκυρας καλύπτει όλο το εύρος', () => {
    const anchor = layout.cells.find((c) => c.rowId === 'r1' && c.colId === 'a');
    expect(anchor?.rect.w).toBe(60);
    expect(anchor?.rect.h).toBe(STANDARD.defaultRowHeightMm * 2);
    expect(anchor?.rowSpan).toBe(2);
    expect(anchor?.colSpan).toBe(2);
  });

  it('συγχώνευση 1×1 αγνοείται — δεν είναι συγχώνευση', () => {
    const trivial = createTableModel({
      columns: [col('a', { kind: 'fixed', widthMm: 10 }), col('b', { kind: 'fixed', widthMm: 10 })],
      rows: [row('r1')],
      merges: [{ anchorRowId: 'r1', anchorColId: 'a', rowSpan: 1, colSpan: 1 }],
    });
    expect(layoutTable(trivial, STANDARD, { measureText }).cells).toHaveLength(2);
  });

  it('συγχώνευση με άγνωστη άγκυρα αγνοείται αντί να ρίξει τη διάταξη', () => {
    const stale = createTableModel({
      columns: [col('a', { kind: 'fixed', widthMm: 10 })],
      rows: [row('r1')],
      merges: [{ anchorRowId: 'ΣΒΗΣΜΕΝΗ', anchorColId: 'a', rowSpan: 2, colSpan: 2 }],
    });
    expect(() => layoutTable(stale, STANDARD, { measureText })).not.toThrow();
    expect(layoutTable(stale, STANDARD, { measureText }).cells).toHaveLength(1);
  });
});

// ── Περιγράμματα ────────────────────────────────────────────────────────────

describe('layoutTable — περιγράμματα', () => {
  it('κάθε ακμή του πλέγματος παράγεται ΜΙΑ φορά, ενωμένη σε όλο το μήκος της', () => {
    const model = createTableModel({
      columns: [col('a', { kind: 'fixed', widthMm: 10 }), col('b', { kind: 'fixed', widthMm: 10 })],
      rows: [row('r1'), row('r2'), row('r3')],
    });
    const { borders } = layoutTable(model, STANDARD, { measureText });
    // 4 οριζόντιες ακμές (3 γραμμές) + 3 κατακόρυφες (2 στήλες) = 7 συνολικά τμήματα,
    // παρότι το πλέγμα έχει 6 κελιά × 4 ακμές = 24 ακμές κελιών.
    expect(borders).toHaveLength(7);
    const horizontals = borders.filter((b) => b.a.y === b.b.y);
    expect(horizontals).toHaveLength(4);
    for (const h of horizontals) {
      expect(h.a.x).toBe(0);
      expect(h.b.x).toBe(20); // ενωμένη σε όλο το πλάτος
    }
  });

  it('οι αόρατες ακμές δεν φτάνουν ποτέ σε backend', () => {
    const model = createTableModel({
      columns: [col('a', { kind: 'fixed', widthMm: 10 })],
      rows: [row('r1'), row('r2')],
    });
    const { borders } = layoutTable(model, DETAIL_SHEET, { measureText });
    expect(borders).toHaveLength(0); // το στυλ φύλλου δεν έχει καθόλου πλέγμα
    expect(borders.every((b) => b.spec.visible)).toBe(true);
  });

  it('οι εσωτερικές ακμές μιας συγχώνευσης λείπουν (αλλιώς η συγχώνευση θα ήταν αόρατη)', () => {
    const model = createTableModel({
      columns: [col('a', { kind: 'fixed', widthMm: 10 }), col('b', { kind: 'fixed', widthMm: 10 })],
      rows: [row('r1')],
      merges: [{ anchorRowId: 'r1', anchorColId: 'a', rowSpan: 1, colSpan: 2 }],
    });
    const { borders } = layoutTable(model, STANDARD, { measureText });
    // Η κατακόρυφη στο x=10 θα υπήρχε χωρίς τη συγχώνευση.
    expect(borders.some((b) => b.a.x === 10 && b.b.x === 10)).toBe(false);
  });

  it('η γραμμή-σύνολο: το borderTop της γραμμής νικά την κλάση της', () => {
    const model = createTableModel({
      columns: [col('a', { kind: 'fixed', widthMm: 10 })],
      rows: [row('r1'), row('total', 'data', { borderTop: DETAIL_SHEET_RULE })],
    });
    const { borders } = layoutTable(model, DETAIL_SHEET, { measureText });
    expect(borders).toHaveLength(1);
    expect(borders[0].spec.colorHex).toBe(DETAIL_SHEET_RULE_HEX);
    expect(borders[0].a.y).toBe(DETAIL_SHEET_ROW_HEIGHT_MM);
  });

  it('η αλλαγή κλάσης γραμμής δίνει τη γραμμή κάτω από την κεφαλίδα', () => {
    const model = createTableModel({
      columns: [col('a', { kind: 'fixed', widthMm: 10 })],
      rows: [row('h', 'header'), row('r1')],
    });
    const { borders } = layoutTable(model, DETAIL_SHEET, { measureText });
    expect(borders).toHaveLength(1);
    expect(borders[0].spec).toEqual(DETAIL_SHEET.rowClasses.header.borders.bottom);
    expect(borders[0].a.y).toBe(DETAIL_SHEET_ROW_HEIGHT_MM);
  });
});

// ── Άδειος πίνακας ──────────────────────────────────────────────────────────

describe('layoutTable — εκφυλισμένες περιπτώσεις', () => {
  it('χωρίς γραμμές ή χωρίς στήλες: μηδενική γεωμετρία, ποτέ σφάλμα', () => {
    const noRows = createTableModel({ columns: [col('a', { kind: 'hug' })], rows: [] });
    const noCols = createTableModel({ columns: [], rows: [row('r1')] });
    for (const model of [noRows, noCols]) {
      const layout = layoutTable(model, STANDARD, { measureText });
      expect(layout.widthMm).toBe(0);
      expect(layout.heightMm).toBe(0);
      expect(layout.cells).toHaveLength(0);
      expect(layout.borders).toHaveLength(0);
    }
  });
});

// ── Ορατές γραμμές (το μάθημα του ADR-735) ──────────────────────────────────

describe('visibleRowRange — δυαδική αναζήτηση ορατών γραμμών', () => {
  const model = createTableModel({
    columns: [col('a', { kind: 'fixed', widthMm: 10 })],
    rows: Array.from({ length: 100 }, (_, i) => row(`r${i}`)),
  });
  const layout = layoutTable(model, STANDARD, { measureText });
  const h = STANDARD.defaultRowHeightMm;

  it('επιστρέφει μόνο τις γραμμές που τέμνουν το παράθυρο', () => {
    const { start, end } = visibleRowRange(layout, h * 10, h * 13);
    expect(start).toBe(10);
    expect(end).toBe(13);
  });

  it('παράθυρο που πέφτει στη μέση γραμμών τις περιλαμβάνει και τις δύο', () => {
    const { start, end } = visibleRowRange(layout, h * 4.5, h * 5.5);
    expect(start).toBe(4);
    expect(end).toBe(6);
  });

  it('παράθυρο εκτός πίνακα δίνει κενό εύρος', () => {
    expect(visibleRowRange(layout, h * 500, h * 600)).toEqual({ start: 100, end: 100 });
    expect(visibleRowRange(layout, -50, -10)).toEqual({ start: 0, end: 0 });
  });

  it('εκφυλισμένο παράθυρο (bottom ≤ top) δίνει κενό εύρος', () => {
    expect(visibleRowRange(layout, h * 5, h * 5)).toEqual({ start: 0, end: 0 });
  });

  it('συμφωνεί με τη γραμμική σάρωση σε κάθε παράθυρο — η επιτάχυνση δεν αλλάζει απάντηση', () => {
    for (let top = 0; top < h * 12; top += h / 3) {
      const bottom = top + h * 2.4;
      const { start, end } = visibleRowRange(layout, top, bottom);
      const linear = layout.rows
        .map((r, i) => ({ r, i }))
        .filter(({ r }) => r.yMm < bottom && r.yMm + r.heightMm > top)
        .map(({ i }) => i);
      expect([start, end]).toEqual([linear[0] ?? start, (linear[linear.length - 1] ?? start - 1) + 1]);
    }
  });
});
