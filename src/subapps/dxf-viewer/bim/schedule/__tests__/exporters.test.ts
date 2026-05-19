/**
 * Tests για bim/schedule/exporters (ADR-363 Phase 8 §6).
 *
 * Covers value-formatters + CSV + xlsx + PDF blob generation.
 * Uses ONLY pure variants (`scheduleToXxxBlob` / `scheduleToCsv`) — no
 * DOM-mocking required for download triggers.
 */

import {
  formatCellForDisplay,
  formatCellForXlsx,
  scheduleToCsv,
  scheduleToPdfBlob,
  scheduleToXlsxBlob,
  xlsxNumFmtFor,
} from '../exporters';
import type { HeaderTranslator } from '../exporters';
import type { Schedule, ScheduleExportOptions } from '../types';

// Mock Greek font loader — avoids ~687KB roboto base64 dynamic import in tests.
// Roboto is registered as a no-op; jsPDF falls back to Helvetica which is fine
// για bytes-non-empty smoke tests (Greek rendering not asserted at this layer).
jest.mock('@/services/pdf/greek-font-loader', () => ({
  registerGreekFont: jest.fn(async () => undefined),
}));

// Mock the download trigger SSoT — prevents real anchor click + URL.createObjectURL.
jest.mock('@/lib/exports/trigger-export-download', () => ({
  triggerExportDownload: jest.fn(),
}));

// ─── Fixture builders ────────────────────────────────────────────────────────

function makeSchedule(): Schedule {
  return {
    entityType: 'door',
    columns: [
      { key: 'id',          i18nKey: 'col.id',          valueType: 'text',              align: 'left'   },
      { key: 'width',       i18nKey: 'col.width',       valueType: 'dimension-mm-to-m', align: 'right'  },
      { key: 'handingText', i18nKey: 'col.handingText', valueType: 'text',              align: 'left'   },
    ],
    rows: [
      {
        entityId: 'opn_001',
        entityType: 'door',
        entityKind: 'door',
        floorId: 'floor-1',
        cells: { id: 'opn_001', width: 900, handingText: 'Δεξιά · Άνοιγμα προς τα μέσα' },
      },
      {
        entityId: 'opn_002',
        entityType: 'door',
        entityKind: 'sliding-door',
        floorId: 'floor-1',
        cells: { id: 'opn_002', width: 1800, handingText: 'Αριστερά · Άνοιγμα προς τα έξω' },
      },
    ],
    generatedAt: 1747700000000,
  };
}

const options: ScheduleExportOptions = {
  filename: 'door-schedule',
  title: 'Πίνακας Κουφωμάτων',
};

const translateHeader: HeaderTranslator = (key) => `[${key}]`;

// ─── value-formatters ────────────────────────────────────────────────────────

describe('formatCellForDisplay', () => {
  test('empty string for null', () => {
    expect(formatCellForDisplay(null, 'text')).toBe('');
  });
  test('mm→m with 3 decimals', () => {
    expect(formatCellForDisplay(900, 'dimension-mm-to-m')).toBe('0.900');
    expect(formatCellForDisplay(2100, 'dimension-mm-to-m')).toBe('2.100');
  });
  test('mm→cm with 1 decimal', () => {
    expect(formatCellForDisplay(170, 'dimension-mm-to-cm')).toBe('17.0');
  });
  test('area-m2 with 2 decimals', () => {
    expect(formatCellForDisplay(15.234, 'area-m2')).toBe('15.23');
  });
  test('volume-m3 with 3 decimals', () => {
    expect(formatCellForDisplay(3.7549, 'volume-m3')).toBe('3.755');
  });
  test('count rounds to integer', () => {
    expect(formatCellForDisplay(2.7, 'count')).toBe('3');
  });
  test('text passthrough', () => {
    expect(formatCellForDisplay('Δεξιά', 'text')).toBe('Δεξιά');
  });
  test('non-numeric value for numeric type returns empty', () => {
    expect(formatCellForDisplay('abc', 'number')).toBe('');
  });
});

describe('formatCellForXlsx', () => {
  test('null in → null out', () => {
    expect(formatCellForXlsx(null, 'text')).toBe(null);
  });
  test('mm→m returns native number divided by 1000', () => {
    expect(formatCellForXlsx(2100, 'dimension-mm-to-m')).toBe(2.1);
  });
  test('count returns integer', () => {
    expect(formatCellForXlsx(2.7, 'count')).toBe(3);
  });
  test('text returns string', () => {
    expect(formatCellForXlsx('abc', 'text')).toBe('abc');
  });
  test('area-m2 returns native number (no division)', () => {
    expect(formatCellForXlsx(15.5, 'area-m2')).toBe(15.5);
  });
});

describe('xlsxNumFmtFor', () => {
  test('returns undefined for text', () => {
    expect(xlsxNumFmtFor('text')).toBeUndefined();
  });
  test('returns 0.000 for mm-to-m', () => {
    expect(xlsxNumFmtFor('dimension-mm-to-m')).toBe('0.000');
  });
  test('returns 0 for count', () => {
    expect(xlsxNumFmtFor('count')).toBe('0');
  });
});

// ─── CSV ────────────────────────────────────────────────────────────────────

describe('scheduleToCsv', () => {
  test('starts with UTF-8 BOM character', () => {
    const csv = scheduleToCsv(makeSchedule(), options, translateHeader);
    expect(csv.charCodeAt(0)).toBe(0xFEFF);
  });

  test('contains title row + date row + blank + header row + data rows', () => {
    const csv = scheduleToCsv(makeSchedule(), options, translateHeader);
    const lines = csv.slice(1).split('\r\n'); // strip BOM
    expect(lines[0]).toContain('Πίνακας Κουφωμάτων');
    expect(lines[1]).toContain('Ημ. Εξαγωγής:');
    expect(lines[2]).toBe('');
    expect(lines[3]).toContain('[col.id]');
    expect(lines[3]).toContain('[col.width]');
    expect(lines[3]).toContain('[col.handingText]');
    expect(lines).toHaveLength(6); // title + date + blank + header + 2 data
  });

  test('escapes cells containing commas + quotes + newlines', () => {
    const schedule: Schedule = {
      entityType: 'wall',
      columns: [{ key: 'name', i18nKey: 'col.name', valueType: 'text', align: 'left' }],
      rows: [
        { entityId: 'w1', entityType: 'wall', cells: { name: 'foo, bar' } },
        { entityId: 'w2', entityType: 'wall', cells: { name: 'with "quote"' } },
        { entityId: 'w3', entityType: 'wall', cells: { name: 'line1\nline2' } },
      ],
      generatedAt: 0,
    };
    const csv = scheduleToCsv(schedule, options, translateHeader);
    expect(csv).toContain('"foo, bar"');
    expect(csv).toContain('"with ""quote"""');
    expect(csv).toContain('"line1\nline2"');
  });

  test('renders Greek handing label intact (no escape needed)', () => {
    const csv = scheduleToCsv(makeSchedule(), options, translateHeader);
    expect(csv).toContain('Δεξιά · Άνοιγμα προς τα μέσα');
  });

  test('numeric cells formatted via display formatter', () => {
    const csv = scheduleToCsv(makeSchedule(), options, translateHeader);
    expect(csv).toContain('0.900'); // 900mm → 0.900 m
    expect(csv).toContain('1.800'); // 1800mm → 1.800 m
  });
});

// ─── XLSX ───────────────────────────────────────────────────────────────────

describe('scheduleToXlsxBlob', () => {
  test('returns a non-empty Blob with correct MIME', async () => {
    const blob = await scheduleToXlsxBlob(makeSchedule(), options, translateHeader);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
    expect(blob.type).toContain('spreadsheetml.sheet');
  });

  test('empty schedule still produces a valid xlsx blob', async () => {
    const empty: Schedule = {
      entityType: 'wall',
      columns: [{ key: 'id', i18nKey: 'col.id', valueType: 'text', align: 'left' }],
      rows: [],
      generatedAt: 0,
    };
    const blob = await scheduleToXlsxBlob(empty, options, translateHeader);
    expect(blob.size).toBeGreaterThan(0);
  });
});

// ─── PDF ────────────────────────────────────────────────────────────────────

describe('scheduleToPdfBlob', () => {
  test('returns a non-empty Blob with PDF MIME', async () => {
    const blob = await scheduleToPdfBlob(makeSchedule(), options, translateHeader);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
    expect(blob.type).toContain('pdf');
  });

  test('empty schedule still produces a valid pdf blob', async () => {
    const empty: Schedule = {
      entityType: 'wall',
      columns: [{ key: 'id', i18nKey: 'col.id', valueType: 'text', align: 'left' }],
      rows: [],
      generatedAt: 0,
    };
    const blob = await scheduleToPdfBlob(empty, options, translateHeader);
    expect(blob.size).toBeGreaterThan(0);
  });
});
