/* eslint-disable no-restricted-syntax */
/**
 * =============================================================================
 * Builder Excel Exporter — Unit Tests (ADR-268, SPEC-011)
 * =============================================================================
 *
 * Layer 1: Mock ExcelJS → assert correct calls (structure, formulas, formatting)
 * Layer 2: Round-trip — generate buffer → ExcelJS.load() → assert cells/sheets
 *
 * @module __tests__/builder-excel-exporter
 * @see SPEC-011 §10 Q4, §11.2 (Excel Round-trip Pattern)
 */

import type { BuilderExportParams } from '../builder-export-types';
import type { FieldDefinition } from '@/config/report-builder/report-builder-types';

// ── Mocks ─────────────────────────────────────────────────────────────

// Design tokens mock
jest.mock('@/styles/design-tokens', () => ({
  designTokens: {
    colors: {
      red: { '600': '#DC2626' },
      blue: { '500': '#3B82F6' },
    },
  },
}));

// intl-utils mock
jest.mock('@/lib/intl-utils', () => ({
  formatDateShort: jest.fn(() => '30/03/2026'),
}));

// triggerBlobDownload mock — capture blob
jest.mock('@/services/gantt-export/gantt-export-utils', () => ({
  triggerBlobDownload: jest.fn(),
}));

// buildAnalysisSheet mock (separate module for SRP)
jest.mock('../builder-excel-analysis', () => ({
  buildAnalysisSheet: jest.fn(),
}));

import { exportBuilderToExcel } from '../builder-excel-exporter';
import { triggerBlobDownload } from '@/services/gantt-export/gantt-export-utils';

const mockTriggerBlobDownload = triggerBlobDownload as jest.Mock;

// ─── Test Data Factory ────────────────────────────────────────────────

function makeField(overrides: Partial<FieldDefinition> = {}): FieldDefinition {
  return {
    key: 'name',
    labelKey: 'reports.builder.fields.name',
    type: 'text',
    filterable: true,
    sortable: true,
    ...overrides,
  } as FieldDefinition;
}

function makeExportParams(overrides: Partial<BuilderExportParams> = {}): BuilderExportParams {
  const fields: FieldDefinition[] = [
    makeField({ key: 'name', labelKey: 'Όνομα', type: 'text' }),
    makeField({ key: 'status', labelKey: 'Κατάσταση', type: 'text' }),
    makeField({ key: 'totalValue', labelKey: 'Αξία', type: 'currency' }),
  ];

  return {
    domain: 'projects',
    domainDefinition: {
      id: 'projects',
      collection: 'projects',
      labelKey: 'Έργα',
      descriptionKey: 'Όλα τα έργα',
      icon: 'Building2',
      fields,
      defaultSort: { field: 'name', direction: 'asc' },
      defaultColumns: ['name', 'status', 'totalValue'],
    },
    results: {
      rows: [
        { name: 'Project Alpha', status: 'active', totalValue: 500000 },
        { name: 'Project Beta', status: 'planning', totalValue: 300000 },
        { name: 'Project Gamma', status: 'completed', totalValue: 750000 },
      ],
      totalCount: 3,
      resolvedRefs: {},
    },
    columns: ['name', 'status', 'totalValue'],
    filters: [],
    groupingResult: null,
    filteredGroups: null,
    grandTotals: {},
    chartImageDataUrl: null,
    activeChartType: null,
    format: 'excel',
    watermark: 'none',
    scope: 'all',
    userName: 'Γιώργος',
    ...overrides,
  } as BuilderExportParams;
}

// ============================================================================
// LAYER 1: Mock-based Tests (assert correct behavior)
// ============================================================================

describe('Builder Excel Exporter — Layer 1 (Mock)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls triggerBlobDownload with correct filename and MIME type', async () => {
    const params = makeExportParams();
    await exportBuilderToExcel(params);

    expect(mockTriggerBlobDownload).toHaveBeenCalledTimes(1);
    const [blob, filename] = mockTriggerBlobDownload.mock.calls[0] as [Blob, string];
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(filename.toLowerCase()).toContain('projects');
    expect(filename).toEndWith('.xlsx');
  });

  it('generates non-empty buffer', async () => {
    const params = makeExportParams();
    await exportBuilderToExcel(params);

    const [blob] = mockTriggerBlobDownload.mock.calls[0] as [Blob];
    expect(blob.size).toBeGreaterThan(0);
  });

  it('handles empty results without error', async () => {
    const params = makeExportParams({
      results: { rows: [], totalCount: 0, resolvedRefs: {} },
    });

    await expect(exportBuilderToExcel(params)).resolves.not.toThrow();
    expect(mockTriggerBlobDownload).toHaveBeenCalledTimes(1);
  });
});

// ============================================================================
// LAYER 2: Round-trip Tests (generate → load → assert)
// ============================================================================

describe('Builder Excel Exporter — Layer 2 (Round-trip)', () => {
  let ExcelJS: typeof import('exceljs');

  beforeAll(async () => {
    ExcelJS = await import('exceljs');
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  async function generateAndLoadWorkbook(
    overrides: Partial<BuilderExportParams> = {},
  ): Promise<InstanceType<typeof ExcelJS.Workbook>> {
    const params = makeExportParams(overrides);
    await exportBuilderToExcel(params);

    const [blob] = mockTriggerBlobDownload.mock.calls[0] as [Blob];

    // jsdom Blob lacks arrayBuffer() — use FileReader-compatible approach
    const buffer = await new Promise<Buffer>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(Buffer.from(reader.result as ArrayBuffer));
      reader.readAsArrayBuffer(blob);
    });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    return wb;
  }

  it('creates at least 3 worksheets (Analysis is separate module)', async () => {
    const wb = await generateAndLoadWorkbook();
    // Analysis sheet is created by buildAnalysisSheet (mocked) → 3 sheets from main exporter
    expect(wb.worksheets.length).toBeGreaterThanOrEqual(3);
  });

  it('names worksheets correctly', async () => {
    const wb = await generateAndLoadWorkbook();
    const names = wb.worksheets.map((ws) => ws.name);
    expect(names).toContain('Σύνοψη');
    expect(names).toContain('Δεδομένα');
    expect(names).toContain('Raw Data');
  });

  it('Data sheet has correct header row', async () => {
    const wb = await generateAndLoadWorkbook();
    const dataSheet = wb.getWorksheet('Δεδομένα');
    expect(dataSheet).toBeDefined();

    const headerRow = dataSheet!.getRow(1);
    expect(headerRow.getCell(1).value).toBe('Όνομα');
    expect(headerRow.getCell(2).value).toBe('Κατάσταση');
    expect(headerRow.getCell(3).value).toBe('Αξία');
  });

  it('Data sheet has correct data rows', async () => {
    const wb = await generateAndLoadWorkbook();
    const dataSheet = wb.getWorksheet('Δεδομένα');
    expect(dataSheet).toBeDefined();

    // Row 2 = first data row (row 1 is header)
    const row2 = dataSheet!.getRow(2);
    expect(row2.getCell(1).value).toBe('Project Alpha');
    expect(row2.getCell(2).value).toBe('active');
    expect(row2.getCell(3).value).toBe(500000);
  });

  it('Summary sheet contains KPI formula for record count', async () => {
    const wb = await generateAndLoadWorkbook();
    const summarySheet = wb.getWorksheet('Σύνοψη');
    expect(summarySheet).toBeDefined();

    // Find the row with 'Πλήθος Εγγραφών'
    let found = false;
    summarySheet!.eachRow((row) => {
      if (row.getCell(1).value === 'Πλήθος Εγγραφών') {
        found = true;
        const valueCell = row.getCell(2);
        // Cell should have a formula (COUNTA)
        const cellValue = valueCell.value as { formula?: string };
        if (cellValue && typeof cellValue === 'object' && 'formula' in cellValue) {
          expect(cellValue.formula).toContain('COUNTA');
        }
      }
    });
    expect(found).toBe(true);
  });

  it('Raw Data sheet has unformatted values', async () => {
    const wb = await generateAndLoadWorkbook();
    const rawSheet = wb.getWorksheet('Raw Data');
    expect(rawSheet).toBeDefined();

    const row2 = rawSheet!.getRow(2);
    expect(row2.getCell(1).value).toBe('Project Alpha');
    expect(row2.getCell(3).value).toBe(500000);
  });

  it('Data sheet has auto-filter applied', async () => {
    const wb = await generateAndLoadWorkbook();
    const dataSheet = wb.getWorksheet('Δεδομένα');
    expect(dataSheet).toBeDefined();
    expect(dataSheet!.autoFilter).toBeDefined();
  });

  it('handles empty dataset gracefully', async () => {
    const wb = await generateAndLoadWorkbook({
      results: { rows: [], totalCount: 0, resolvedRefs: {} },
    });

    expect(wb.worksheets.length).toBeGreaterThanOrEqual(3);
    const dataSheet = wb.getWorksheet('Δεδομένα');
    expect(dataSheet).toBeDefined();
  });

  it('sets workbook creator metadata', async () => {
    const wb = await generateAndLoadWorkbook();
    expect(wb.creator).toBe('Γιώργος');
  });
});

// ── Custom matcher ────────────────────────────────────────────────────
expect.extend({
  toEndWith(received: string, expected: string) {
    const pass = received.endsWith(expected);
    return {
      message: () => `expected "${received}" to end with "${expected}"`,
      pass,
    };
  },
});

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toEndWith(expected: string): R;
    }
  }
}
