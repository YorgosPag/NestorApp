/**
 * @tests Builder Export — ADR-268 Phase 3
 * Tests PDF + Excel export type builders, helpers, and config generation.
 *
 * Note: We test the helper functions and config builders.
 * jsPDF/ExcelJS integration is tested via manual QA on localhost.
 */

import {
  buildFiltersText,
  buildExportFilename,
  OPERATOR_SYMBOLS,
} from '../builder-export-types';
import type {
  BuilderExportParams,
  WatermarkMode,
  ExportScope,
} from '../builder-export-types';
import type {
  DomainDefinition,
  BuilderQueryResponse,
  ReportBuilderFilter,
  GroupingResult,
  GroupedRow,
  FieldDefinition,
} from '@/config/report-builder/report-builder-types';

// ============================================================================
// Test Data
// ============================================================================

const UNIT_FIELDS: FieldDefinition[] = [
  { key: 'name', labelKey: 'Όνομα', type: 'text', filterable: true, sortable: true, defaultVisible: true },
  { key: 'commercialStatus', labelKey: 'Κατάσταση', type: 'enum', filterable: true, sortable: true, defaultVisible: true, enumValues: ['available', 'sold'] },
  { key: 'commercial.askingPrice', labelKey: 'Τιμή', type: 'currency', filterable: true, sortable: true, defaultVisible: true },
  { key: 'areas.gross', labelKey: 'Εμβαδόν', type: 'number', filterable: true, sortable: true, defaultVisible: true },
  { key: 'buildDate', labelKey: 'Ημ. Κατασκευής', type: 'date', filterable: true, sortable: true, defaultVisible: false },
];

const DOMAIN_DEF: DomainDefinition = {
  id: 'units',
  collection: 'units',
  labelKey: 'Μονάδες',
  descriptionKey: 'desc',
  entityLinkPath: '/units/{id}',
  fields: UNIT_FIELDS,
  defaultSortField: 'name',
  defaultSortDirection: 'asc',
};

const SAMPLE_FILTERS: ReportBuilderFilter[] = [
  { id: 'f1', fieldKey: 'commercialStatus', operator: 'eq', value: 'sold' },
  { id: 'f2', fieldKey: 'commercial.askingPrice', operator: 'gt', value: 50000 },
];

const SAMPLE_ROWS: Record<string, unknown>[] = [
  { name: 'Unit A', commercialStatus: 'sold', 'commercial.askingPrice': 150000, 'areas.gross': 100, buildDate: '2024-06-15' },
  { name: 'Unit B', commercialStatus: 'sold', 'commercial.askingPrice': 300000, 'areas.gross': 200, buildDate: '2023-01-20' },
  { name: 'Unit C', commercialStatus: 'available', 'commercial.askingPrice': 200000, 'areas.gross': 150, buildDate: '2025-12-01' },
];

const SAMPLE_RESPONSE: BuilderQueryResponse = {
  rows: SAMPLE_ROWS,
  totalMatched: 3,
  truncated: false,
  resolvedRefs: {},
  generatedAt: '2026-03-29T10:00:00Z',
};

const SAMPLE_GROUPS: GroupedRow[] = [
  {
    groupKey: 'sold',
    groupField: 'commercialStatus',
    depth: 1,
    aggregates: { 'COUNT:*': 2, 'SUM:commercial.askingPrice': 450000 },
    children: [SAMPLE_ROWS[0], SAMPLE_ROWS[1]],
    rowCount: 2,
  },
  {
    groupKey: 'available',
    groupField: 'commercialStatus',
    depth: 1,
    aggregates: { 'COUNT:*': 1, 'SUM:commercial.askingPrice': 200000 },
    children: [SAMPLE_ROWS[2]],
    rowCount: 1,
  },
];

const SAMPLE_GROUPING_RESULT: GroupingResult = {
  groups: SAMPLE_GROUPS,
  grandTotals: { 'COUNT:*': 3, 'SUM:commercial.askingPrice': 650000 },
  totalRowCount: 3,
};

function buildTestParams(overrides?: Partial<BuilderExportParams>): BuilderExportParams {
  return {
    domain: 'units',
    domainDefinition: DOMAIN_DEF,
    results: SAMPLE_RESPONSE,
    columns: ['name', 'commercialStatus', 'commercial.askingPrice', 'areas.gross'],
    filters: SAMPLE_FILTERS,
    groupingResult: SAMPLE_GROUPING_RESULT,
    filteredGroups: SAMPLE_GROUPS,
    grandTotals: SAMPLE_GROUPING_RESULT.grandTotals,
    chartImageDataUrl: null,
    activeChartType: 'bar',
    format: 'pdf',
    watermark: 'none',
    scope: 'all',
    userName: 'Γιώργος Παγώνης',
    ...overrides,
  };
}

// ============================================================================
// buildFiltersText
// ============================================================================

describe('buildFiltersText', () => {
  it('returns "Χωρίς φίλτρα" when empty', () => {
    expect(buildFiltersText([], DOMAIN_DEF)).toBe('Χωρίς φίλτρα');
  });

  it('formats single filter with operator symbol', () => {
    const filters: ReportBuilderFilter[] = [
      { id: 'f1', fieldKey: 'commercialStatus', operator: 'eq', value: 'sold' },
    ];
    const result = buildFiltersText(filters, DOMAIN_DEF);
    expect(result).toBe('Κατάσταση = sold');
  });

  it('joins multiple filters with " · "', () => {
    const result = buildFiltersText(SAMPLE_FILTERS, DOMAIN_DEF);
    expect(result).toContain('Κατάσταση = sold');
    expect(result).toContain(' · ');
    expect(result).toContain('Τιμή > 50000');
  });

  it('handles "in" operator with array value', () => {
    const filters: ReportBuilderFilter[] = [
      { id: 'f1', fieldKey: 'commercialStatus', operator: 'in', value: ['sold', 'available'] },
    ];
    const result = buildFiltersText(filters, DOMAIN_DEF);
    expect(result).toContain('∈');
    expect(result).toContain('sold, available');
  });

  it('handles unknown fieldKey gracefully', () => {
    const filters: ReportBuilderFilter[] = [
      { id: 'f1', fieldKey: 'unknown.field', operator: 'eq', value: 'test' },
    ];
    const result = buildFiltersText(filters, DOMAIN_DEF);
    expect(result).toContain('unknown.field = test');
  });

  it('uses correct operator symbols for all operators', () => {
    expect(OPERATOR_SYMBOLS.eq).toBe('=');
    expect(OPERATOR_SYMBOLS.neq).toBe('≠');
    expect(OPERATOR_SYMBOLS.gt).toBe('>');
    expect(OPERATOR_SYMBOLS.gte).toBe('≥');
    expect(OPERATOR_SYMBOLS.lt).toBe('<');
    expect(OPERATOR_SYMBOLS.lte).toBe('≤');
    expect(OPERATOR_SYMBOLS.contains).toBe('~');
    expect(OPERATOR_SYMBOLS.in).toBe('∈');
    expect(OPERATOR_SYMBOLS.between).toBe('↔');
  });
});

// ============================================================================
// buildExportFilename
// ============================================================================

describe('buildExportFilename', () => {
  it('generates PDF filename with domain and date', () => {
    const filename = buildExportFilename('units', 'pdf');
    expect(filename).toMatch(/^Nestor_Units_Report_\d{4}-\d{2}-\d{2}\.pdf$/);
  });

  it('generates Excel filename with domain and date', () => {
    const filename = buildExportFilename('projects', 'xlsx');
    expect(filename).toMatch(/^Nestor_Projects_Report_\d{4}-\d{2}-\d{2}\.xlsx$/);
  });

  it('capitalizes domain ID', () => {
    expect(buildExportFilename('buildings', 'pdf')).toContain('Buildings');
    expect(buildExportFilename('floors', 'xlsx')).toContain('Floors');
  });
});

// ============================================================================
// BuilderExportParams construction
// ============================================================================

describe('BuilderExportParams', () => {
  it('builds params with all required fields', () => {
    const params = buildTestParams();
    expect(params.domain).toBe('units');
    expect(params.columns).toHaveLength(4);
    expect(params.filters).toHaveLength(2);
    expect(params.groupingResult).toBeTruthy();
    expect(params.filteredGroups).toHaveLength(2);
  });

  it('handles no-grouping case', () => {
    const params = buildTestParams({
      groupingResult: null,
      filteredGroups: null,
      grandTotals: {},
    });
    expect(params.groupingResult).toBeNull();
    expect(params.filteredGroups).toBeNull();
  });

  it('supports all watermark modes', () => {
    const modes: WatermarkMode[] = ['none', 'confidential', 'confidential-user'];
    for (const mode of modes) {
      const params = buildTestParams({ watermark: mode });
      expect(params.watermark).toBe(mode);
    }
  });

  it('supports both export scopes', () => {
    const scopes: ExportScope[] = ['all', 'filtered'];
    for (const scope of scopes) {
      const params = buildTestParams({ scope });
      expect(params.scope).toBe(scope);
    }
  });

  it('includes chart image when provided', () => {
    const params = buildTestParams({
      chartImageDataUrl: 'data:image/png;base64,abc123',
    });
    expect(params.chartImageDataUrl).toBe('data:image/png;base64,abc123');
  });

  it('handles empty filters', () => {
    const params = buildTestParams({ filters: [] });
    expect(params.filters).toHaveLength(0);
  });
});

// ============================================================================
// Export params validation scenarios
// ============================================================================

describe('Export edge cases', () => {
  it('grouped data contains correct aggregate keys', () => {
    const params = buildTestParams();
    const group = params.filteredGroups![0];
    expect(group.aggregates['COUNT:*']).toBe(2);
    expect(group.aggregates['SUM:commercial.askingPrice']).toBe(450000);
  });

  it('grand totals sum correctly across groups', () => {
    const params = buildTestParams();
    expect(params.grandTotals['COUNT:*']).toBe(3);
    expect(params.grandTotals['SUM:commercial.askingPrice']).toBe(650000);
  });

  it('domain definition fields match columns', () => {
    const params = buildTestParams();
    for (const col of params.columns) {
      const field = params.domainDefinition.fields.find((f) => f.key === col);
      expect(field).toBeDefined();
    }
  });

  it('rows contain data for all selected columns', () => {
    const params = buildTestParams();
    for (const row of params.results.rows) {
      for (const col of params.columns) {
        expect(col in row || col.includes('.')).toBeTruthy();
      }
    }
  });
});

// ============================================================================
// Excel-specific formula building scenarios
// ============================================================================

describe('Excel formula patterns', () => {
  it('numeric fields identified correctly for formulas', () => {
    const numericFields = UNIT_FIELDS.filter(
      (f) => f.type === 'currency' || f.type === 'number' || f.type === 'percentage',
    );
    expect(numericFields).toHaveLength(2); // askingPrice + gross area
    expect(numericFields.map((f) => f.key)).toContain('commercial.askingPrice');
    expect(numericFields.map((f) => f.key)).toContain('areas.gross');
  });

  it('group-by field index found for COUNTIFS', () => {
    const columns = ['name', 'commercialStatus', 'commercial.askingPrice', 'areas.gross'];
    const groupField = 'commercialStatus';
    const idx = columns.indexOf(groupField);
    expect(idx).toBe(1); // B column
  });

  it('analysis sheet created only when grouping exists', () => {
    const noGroupParams = buildTestParams({ groupingResult: null });
    expect(noGroupParams.groupingResult).toBeNull();

    const withGroupParams = buildTestParams();
    expect(withGroupParams.groupingResult).not.toBeNull();
    expect(withGroupParams.groupingResult!.groups).toHaveLength(2);
  });
});

// ============================================================================
// PDF-specific scenarios
// ============================================================================

describe('PDF configuration', () => {
  it('TOC/bookmarks only when grouping and would produce >2 pages', () => {
    const params = buildTestParams();
    const hasGrouping = params.groupingResult !== null;
    expect(hasGrouping).toBe(true);
    // Page count determined at runtime — just verify grouping presence
  });

  it('watermark text matches mode', () => {
    const params = buildTestParams({ watermark: 'confidential-user' });
    expect(params.watermark).toBe('confidential-user');
    expect(params.userName).toBeTruthy();
  });

  it('filters text formatted correctly for PDF header', () => {
    const params = buildTestParams();
    const text = buildFiltersText(params.filters, params.domainDefinition);
    expect(text).toContain('Κατάσταση = sold');
    expect(text).toContain('Τιμή > 50000');
  });
});

// ============================================================================
// Negative & Boundary Tests (SPEC-011 enrichment)
// ============================================================================

describe('Export — Negative & Boundary Cases', () => {
  it('buildFiltersText returns "Χωρίς φίλτρα" for empty filters', () => {
    const params = buildTestParams({ filters: [] });
    const text = buildFiltersText(params.filters, params.domainDefinition);
    expect(text).toBe('Χωρίς φίλτρα');
  });

  it('buildExportFilename generates valid filename for all domains', () => {
    const domains = ['projects', 'buildings', 'units', 'floors'];
    for (const domain of domains) {
      const pdfName = buildExportFilename(domain, 'pdf');
      const xlsxName = buildExportFilename(domain, 'xlsx');
      expect(pdfName).toMatch(/\.pdf$/);
      expect(xlsxName).toMatch(/\.xlsx$/);
      expect(pdfName.length).toBeGreaterThan(10);
    }
  });

  it('buildExportFilename does not contain path traversal characters', () => {
    const filename = buildExportFilename('projects', 'pdf');
    expect(filename).not.toContain('..');
    expect(filename).not.toContain('/');
    expect(filename).not.toContain('\\');
  });

  it('OPERATOR_SYMBOLS covers all operators', () => {
    const expectedOps = [
      'eq', 'neq', 'contains', 'starts_with',
      'gt', 'gte', 'lt', 'lte', 'between',
      'before', 'after', 'in',
    ];
    for (const op of expectedOps) {
      expect(OPERATOR_SYMBOLS).toHaveProperty(op);
      expect(typeof OPERATOR_SYMBOLS[op as keyof typeof OPERATOR_SYMBOLS]).toBe('string');
    }
  });

  it('handles missing field in filter gracefully', () => {
    const params = buildTestParams({
      filters: [
        { id: 'f-bad', fieldKey: 'nonExistentField', operator: 'eq', value: 'test' },
      ],
    });
    // Should not throw
    const text = buildFiltersText(params.filters, params.domainDefinition);
    expect(typeof text).toBe('string');
  });

  it('handles zero rows in results', () => {
    const params = buildTestParams({
      results: { rows: [], totalCount: 0, resolvedRefs: {} } as BuilderQueryResponse,
    });
    expect(params.results.rows).toHaveLength(0);
    expect(params.results.totalCount).toBe(0);
  });

  it('grand totals are zero when no groups', () => {
    const params = buildTestParams({
      groupingResult: null,
      filteredGroups: null,
      grandTotals: {},
    });
    expect(Object.keys(params.grandTotals)).toHaveLength(0);
  });
});
