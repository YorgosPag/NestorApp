/**
 * ADR-920 §14.11 Π5 — a diagram PDF's ΕΓΣΑ'87 coordinate table → the plot outline, corroborated, never guessed.
 *
 *   Π  one table: corners + labels, exact area, written area AND printed sides agree
 *   Σ  column order does not matter (easting vs northing told apart by magnitude); a closing «Α» row is dropped
 *   Δ  a table printed in two columns is joined — and its parts stay candidates
 *   Ο  no table ⇒ `no-coordinate-table`; nothing readable ⇒ `unreadable`; local (non-ΕΓΣΑ) numbers are no table
 */

import type { PdfPositionedPage, PdfTextItem } from '@/lib/pdf/pdf-page-text';

import { readPdfPlotOutline } from '../pdf-coordinate-table';

const E0 = 384_500;
const N0 = 4_201_200;
const fixed = (n: number): string => n.toFixed(2);

/** One text line: each cell its own pdf.js item at the given x. */
function line(y: number, cells: readonly (readonly [string, number])[]): PdfTextItem[] {
  return cells.map(([s, x]) => ({ s, x, y, w: s.length * 5, h: 8 }));
}

const TITLE = line(40, [['ΤΟΠΟΓΡΑΦΙΚΟ ΔΙΑΓΡΑΜΜΑ ΟΙΚΟΠΕΔΟΥ ΙΔΙΟΚΤΗΣΙΑΣ', 50]]);
const HEADER = line(60, [['ΠΙΝΑΚΑΣ ΣΥΝΤΕΤΑΓΜΕΝΩΝ ΚΟΡΥΦΩΝ ΕΓΣΑ 87', 50]]);

function page(...lines: PdfTextItem[][]): PdfPositionedPage {
  return { page: 1, width: 595, height: 842, items: [TITLE, HEADER, ...lines].flat() };
}

/** A row `label X Y [S]` starting at column x (the line gives the y). */
function row(x: number, label: string, dx: number, dy: number, side?: number, swap = false): [string, number][] {
  const e = fixed(E0 + dx);
  const n = fixed(N0 + dy);
  const [first, second] = swap ? [n, e] : [e, n];
  return [[label, x], [first, x + 30], [second, x + 110], ...(side !== undefined ? [[fixed(side), x + 190] as [string, number]] : [])];
}

const RECT = [['Α', 0, 0, 30], ['Β', 30, 0, 20], ['Γ', 30, 20, 30], ['Δ', 0, 20, 20]] as const;

describe('Π — one table', () => {
  it('reads the ring, its labels, and both corroborations', () => {
    const reading = readPdfPlotOutline([page(
      ...RECT.map(([label, dx, dy, side], i) => line(100 + 10 * i, row(50, label, dx, dy, side))),
      line(160, [['Ε = 600,00 τ.μ.', 50]]),
    )]);
    expect(reading.status).toBe('tables');
    if (reading.status !== 'tables') return;
    expect(reading.areaStatementsM2).toEqual([600]);
    const [table] = reading.tables;
    expect(table.candidate.id).toBe('pdf:1:0');
    expect(table.candidate.areaM2).toBeCloseTo(600, 6);
    expect(table.candidate.corners.map((c) => c.label)).toEqual(['Α', 'Β', 'Γ', 'Δ']);
    expect(table.candidate.ringWorldMm[0]).toEqual({ x: E0 * 1000, y: N0 * 1000 });
    expect(table.corroboration).toEqual({ writtenAreaM2: 600, area: 'agrees', sidesPrinted: 4, sidesAgreeing: 4 });
  });

  it('a written area that does not match is reported as disagreeing — not hidden', () => {
    const reading = readPdfPlotOutline([page(
      ...RECT.map(([label, dx, dy], i) => line(100 + 10 * i, row(50, label, dx, dy))),
      line(160, [['E = 612,40 m2', 50]]),
    )]);
    if (reading.status !== 'tables') throw new Error(reading.status);
    expect(reading.tables[0].corroboration).toMatchObject({ area: 'disagrees', writtenAreaM2: 612.4, sidesPrinted: 0 });
  });
});

describe('Σ — order and closure', () => {
  it('reads Y-before-X tables and drops a closing repeat of the first corner', () => {
    const rows = [...RECT, ['Α', 0, 0, 0] as const];
    const reading = readPdfPlotOutline([page(...rows.map(([label, dx, dy], i) => line(100 + 10 * i, row(50, label, dx, dy, undefined, true))))]);
    if (reading.status !== 'tables') throw new Error(reading.status);
    expect(reading.tables[0].candidate.corners).toHaveLength(4);
    expect(reading.tables[0].candidate.areaM2).toBeCloseTo(600, 6);
  });
});

describe('Δ — a table printed in two columns', () => {
  const HEX = [['Α', 0, 0], ['Β', 40, 0], ['Γ', 50, 20], ['Δ', 40, 40], ['Ε', 0, 40], ['Ζ', -10, 20]] as const;

  it('joins the columns into the full ring, and keeps the parts as candidates', () => {
    const lines = [0, 1, 2].map((i) => line(100 + 10 * i, [
      ...row(50, HEX[i][0], HEX[i][1], HEX[i][2]),
      ...row(300, HEX[i + 3][0], HEX[i + 3][1], HEX[i + 3][2]),
    ]));
    const reading = readPdfPlotOutline([page(...lines, line(160, [['Ε = 2000,00 τ.μ.', 50]]))]);
    if (reading.status !== 'tables') throw new Error(reading.status);
    const full = reading.tables.find((t) => t.candidate.corners.length === 6);
    expect(full?.candidate.areaM2).toBeCloseTo(2000, 6);
    expect(full?.corroboration.area).toBe('agrees');
    expect(reading.tables.filter((t) => t.candidate.corners.length === 3)).toHaveLength(2);
  });
});

describe('Ο — no table is a named answer', () => {
  it('readable text without corner coordinates', () => {
    expect(readPdfPlotOutline([page(line(100, [['ΚΛΙΜΑΚΑ 1:200 ΗΜΕΡΟΜΗΝΙΑ 12/10/2026', 50]]))])).toEqual({ status: 'no-coordinate-table' });
  });

  it('local (non-ΕΓΣΑ) coordinates are not a georeference', () => {
    const local = [['Α', '100.00', '200.00'], ['Β', '130.00', '200.00'], ['Γ', '130.00', '220.00']];
    const lines = local.map(([l, x, y], i) => line(100 + 10 * i, [[l, 50], [x, 80], [y, 160]]));
    expect(readPdfPlotOutline([page(...lines)])).toEqual({ status: 'no-coordinate-table' });
  });

  it('nothing readable (a scan)', () => {
    expect(readPdfPlotOutline([{ page: 1, width: 595, height: 842, items: [] }])).toEqual({ status: 'unreadable' });
  });
});
