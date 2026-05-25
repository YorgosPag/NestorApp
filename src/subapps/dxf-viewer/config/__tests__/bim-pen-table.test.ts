/**
 * ADR-375 — Pen Table tests.
 * Validates all 96 values are in the ISO catalog (pre-commit ratchet compliance).
 */
import { describe, it, expect } from '@jest/globals';
import { PEN_COUNT, SCALE_COLUMNS, PEN_TABLE_MM } from '../bim-pen-table';
import { isIsoBaselineLineweight } from '../lineweight-iso-catalog';

describe('PEN_TABLE_MM', () => {
  it('has exactly PEN_COUNT rows', () => {
    expect(PEN_TABLE_MM).toHaveLength(PEN_COUNT);
  });

  it('each row has exactly SCALE_COLUMNS entries', () => {
    for (const row of PEN_TABLE_MM) {
      expect(row).toHaveLength(SCALE_COLUMNS.length);
    }
  });

  it('all 96 values are in the ISO catalog', () => {
    for (let pen = 0; pen < PEN_TABLE_MM.length; pen++) {
      for (let col = 0; col < PEN_TABLE_MM[pen].length; col++) {
        const mm = PEN_TABLE_MM[pen][col];
        expect(isIsoBaselineLineweight(mm))
          .toBe(true);
      }
    }
  });

  it('all values are positive', () => {
    for (const row of PEN_TABLE_MM) {
      for (const mm of row) {
        expect(mm).toBeGreaterThan(0);
      }
    }
  });

  it('within each pen, larger scales (column 0) >= smaller scales (column 5)', () => {
    for (const row of PEN_TABLE_MM) {
      expect(row[0]).toBeGreaterThanOrEqual(row[SCALE_COLUMNS.length - 1]);
    }
  });

  it('later pens have >= line weight than earlier pens at same scale', () => {
    for (let col = 0; col < SCALE_COLUMNS.length; col++) {
      for (let pen = 1; pen < PEN_TABLE_MM.length; pen++) {
        expect(PEN_TABLE_MM[pen][col]).toBeGreaterThanOrEqual(PEN_TABLE_MM[pen - 1][col]);
      }
    }
  });
});

describe('SCALE_COLUMNS', () => {
  it('has 6 columns', () => {
    expect(SCALE_COLUMNS).toHaveLength(6);
  });

  it('contains 1:100', () => {
    expect(SCALE_COLUMNS).toContain('1:100');
  });
});
