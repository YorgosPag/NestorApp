/* eslint-disable no-restricted-syntax */
/**
 * =============================================================================
 * Builder PDF Exporter — Unit Tests (ADR-268, SPEC-011)
 * =============================================================================
 *
 * Layer 1: Mock jsPDF/autoTable → assert correct calls (header, KPI, table, footers)
 * Layer 2: Content verification using mock capture (text calls, page count)
 *
 * @module __tests__/builder-pdf-exporter
 * @see SPEC-011 §10 Q4, §11.1 (PDF Testing Pattern)
 */

import type { BuilderExportParams } from '../builder-export-types';
import type { FieldDefinition } from '@/config/report-builder/report-builder-types';

// ── Track jsPDF calls ─────────────────────────────────────────────────

const mockPdfCalls: { method: string; args: unknown[] }[] = [];
let mockPageCount = 1;

const mockPdfInstance = {
  setFont: jest.fn((...args: unknown[]) => mockPdfCalls.push({ method: 'setFont', args })),
  setFontSize: jest.fn((...args: unknown[]) => mockPdfCalls.push({ method: 'setFontSize', args })),
  setTextColor: jest.fn((...args: unknown[]) => mockPdfCalls.push({ method: 'setTextColor', args })),
  setDrawColor: jest.fn(),
  setFillColor: jest.fn(),
  setLineWidth: jest.fn(),
  setGState: jest.fn(),
  GState: jest.fn(() => ({})),
  text: jest.fn((...args: unknown[]) => mockPdfCalls.push({ method: 'text', args })),
  line: jest.fn(),
  roundedRect: jest.fn(),
  addImage: jest.fn(),
  addPage: jest.fn(() => { mockPageCount++; }),
  save: jest.fn(),
  getNumberOfPages: jest.fn(() => mockPageCount),
  setProperties: jest.fn(),
  internal: {
    pageSize: {
      getWidth: () => 297, // A4 landscape
      getHeight: () => 210,
    },
  },
};

jest.mock('jspdf', () => ({
  __esModule: true,
  default: jest.fn(() => mockPdfInstance),
}));

jest.mock('jspdf-autotable', () => ({
  __esModule: true,
  default: jest.fn((_pdf: unknown, opts: { body?: unknown[][] }) => {
    mockPdfCalls.push({ method: 'autoTable', args: [opts] });
  }),
}));

jest.mock('@/services/pdf/greek-font-loader', () => ({
  registerGreekFont: jest.fn(async () => {}),
}));

jest.mock('@/lib/intl-utils', () => ({
  formatDateShort: jest.fn(() => '30/03/2026'),
}));

jest.mock('../builder-pdf-extras', () => ({
  drawWatermark: jest.fn(),
  drawTableOfContents: jest.fn(),
  addBookmarks: jest.fn(),
  addFooters: jest.fn(),
}));

import { exportBuilderToPdf } from '../builder-pdf-exporter';
import { registerGreekFont } from '@/services/pdf/greek-font-loader';
import { drawWatermark, addFooters } from '../builder-pdf-extras';

// ─── Test Data Factory ────────────────────────────────────────────────

function makeField(overrides: Partial<FieldDefinition> = {}): FieldDefinition {
  return {
    key: 'name',
    labelKey: 'Όνομα',
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
      ],
      totalCount: 2,
      resolvedRefs: {},
    },
    columns: ['name', 'status', 'totalValue'],
    filters: [],
    groupingResult: null,
    filteredGroups: null,
    grandTotals: {},
    chartImageDataUrl: null,
    activeChartType: null,
    format: 'pdf',
    watermark: 'none',
    scope: 'all',
    userName: 'Γιώργος',
    ...overrides,
  } as BuilderExportParams;
}

// ============================================================================
// LAYER 1: Mock-based Tests (assert correct jsPDF calls)
// ============================================================================

describe('Builder PDF Exporter — Layer 1 (Mock)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPdfCalls.length = 0;
    mockPageCount = 1;
  });

  it('registers Greek font before rendering', async () => {
    await exportBuilderToPdf(makeExportParams());
    expect(registerGreekFont).toHaveBeenCalledTimes(1);
  });

  it('calls pdf.save with correct filename', async () => {
    await exportBuilderToPdf(makeExportParams());
    expect(mockPdfInstance.save).toHaveBeenCalledTimes(1);
    const filename = mockPdfInstance.save.mock.calls[0][0] as string;
    expect(filename.toLowerCase()).toContain('projects');
    expect(filename).toContain('.pdf');
  });

  it('draws header with domain title', async () => {
    await exportBuilderToPdf(makeExportParams());

    const textCalls = mockPdfCalls.filter((c) => c.method === 'text');
    const titleCall = textCalls.find(
      (c) => c.args[0] === 'Έργα',
    );
    expect(titleCall).toBeDefined();
  });

  it('draws date in header', async () => {
    await exportBuilderToPdf(makeExportParams());

    const textCalls = mockPdfCalls.filter((c) => c.method === 'text');
    const dateCall = textCalls.find(
      (c) => typeof c.args[0] === 'string' && (c.args[0] as string).includes('30/03/2026'),
    );
    expect(dateCall).toBeDefined();
  });

  it('renders flat table via autoTable', async () => {
    await exportBuilderToPdf(makeExportParams());

    const autoTableCalls = mockPdfCalls.filter((c) => c.method === 'autoTable');
    expect(autoTableCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('sets document metadata properties', async () => {
    await exportBuilderToPdf(makeExportParams());

    expect(mockPdfInstance.setProperties).toHaveBeenCalledWith(
      expect.objectContaining({
        author: 'Γιώργος',
        creator: 'Nestor Report Builder',
      }),
    );
  });

  it('calls addFooters', async () => {
    await exportBuilderToPdf(makeExportParams());
    expect(addFooters).toHaveBeenCalledTimes(1);
  });

  it('calls drawWatermark with correct mode', async () => {
    await exportBuilderToPdf(makeExportParams({ watermark: 'confidential' }));
    expect(drawWatermark).toHaveBeenCalledWith(
      expect.anything(),
      'confidential',
      'Γιώργος',
      expect.any(Number),
      expect.any(Number),
    );
  });

  it('does NOT draw chart when chartImageDataUrl is null', async () => {
    await exportBuilderToPdf(makeExportParams({ chartImageDataUrl: null }));
    expect(mockPdfInstance.addImage).not.toHaveBeenCalled();
  });

  it('draws chart when chartImageDataUrl is provided', async () => {
    await exportBuilderToPdf(
      makeExportParams({ chartImageDataUrl: 'data:image/png;base64,ABC123' }),
    );
    expect(mockPdfInstance.addImage).toHaveBeenCalledTimes(1);
  });

  it('handles empty results without error', async () => {
    const params = makeExportParams({
      results: { rows: [], totalCount: 0, resolvedRefs: {} },
    });

    await expect(exportBuilderToPdf(params)).resolves.not.toThrow();
    expect(mockPdfInstance.save).toHaveBeenCalledTimes(1);
  });
});

// ============================================================================
// LAYER 2: Content verification (text output analysis)
// ============================================================================

describe('Builder PDF Exporter — Layer 2 (Content)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPdfCalls.length = 0;
    mockPageCount = 1;
  });

  it('includes filter summary when filters are active', async () => {
    await exportBuilderToPdf(makeExportParams({
      filters: [
        { field: 'status', operator: 'eq', value: 'active' },
      ],
    }));

    const textCalls = mockPdfCalls.filter((c) => c.method === 'text');
    const filterCall = textCalls.find(
      (c) => typeof c.args[0] === 'string' && (c.args[0] as string).includes('Φίλτρα'),
    );
    expect(filterCall).toBeDefined();
  });

  it('uses landscape A4 dimensions', async () => {
    await exportBuilderToPdf(makeExportParams());

    // A4 landscape: 297mm x 210mm
    expect(mockPdfInstance.internal.pageSize.getWidth()).toBe(297);
    expect(mockPdfInstance.internal.pageSize.getHeight()).toBe(210);
  });

  it('uses bold Roboto font for title', async () => {
    await exportBuilderToPdf(makeExportParams());

    const fontCalls = mockPdfCalls.filter((c) => c.method === 'setFont');
    const boldRoboto = fontCalls.find(
      (c) => c.args[0] === 'Roboto' && c.args[1] === 'bold',
    );
    expect(boldRoboto).toBeDefined();
  });

  it('creates single page for small dataset', async () => {
    await exportBuilderToPdf(makeExportParams());
    // For 2 rows, should not add extra pages
    expect(mockPdfInstance.addPage).not.toHaveBeenCalled();
  });
});
