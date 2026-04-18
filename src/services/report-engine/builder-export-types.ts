/**
 * @module services/report-engine/builder-export-types
 * @enterprise ADR-268 Phase 3 — Export Type Definitions
 *
 * Shared types for builder PDF + Excel export.
 * Consumed by builder-pdf-exporter.ts and builder-excel-exporter.ts.
 */

import type {
  BuilderDomainId,
  DomainDefinition,
  BuilderQueryResponse,
  ReportBuilderFilter,
  GroupingResult,
  GroupedRow,
  BuilderChartType,
  FilterOperator,
  FieldDefinition,
} from '@/config/report-builder/report-builder-types';
import { nowISO } from '@/lib/date-local';

// ============================================================================
// Export Configuration Types
// ============================================================================

/** Watermark mode for PDF export */
export type WatermarkMode = 'none' | 'confidential' | 'confidential-user';

/** Export file format */
export type ExportFormat = 'pdf' | 'excel';

/** Export scope when cross-filter is active */
export type ExportScope = 'all' | 'filtered';

/** Parameters passed from UI to export functions */
export interface BuilderExportParams {
  domain: BuilderDomainId;
  domainDefinition: DomainDefinition;
  results: BuilderQueryResponse;
  columns: string[];
  filters: ReportBuilderFilter[];
  groupingResult: GroupingResult | null;
  filteredGroups: GroupedRow[] | null;
  grandTotals: Record<string, number>;
  chartImageDataUrl: string | null;
  activeChartType: BuilderChartType | null;
  format: ExportFormat;
  watermark: WatermarkMode;
  scope: ExportScope;
  userName: string;
}

// ============================================================================
// Operator Symbol Mapping (for PDF/Excel filter display)
// ============================================================================

export const OPERATOR_SYMBOLS: Record<FilterOperator, string> = {
  eq: '=',
  neq: '≠',
  contains: '~',
  starts_with: '~',
  gt: '>',
  gte: '≥',
  lt: '<',
  lte: '≤',
  between: '↔',
  before: '<',
  after: '>',
  in: '∈',
} as const;

// ============================================================================
// Helpers
// ============================================================================

/** Build human-readable filter summary: "Status = Πωλημένο · Τιμή > €50K" */
export function buildFiltersText(
  filters: ReportBuilderFilter[],
  domainDefinition: DomainDefinition,
): string {
  if (filters.length === 0) return 'Χωρίς φίλτρα';

  return filters
    .map((f) => {
      const field = domainDefinition.fields.find(
        (fd: FieldDefinition) => fd.key === f.fieldKey,
      );
      const label = field?.labelKey ?? f.fieldKey;
      const symbol = OPERATOR_SYMBOLS[f.operator];
      const val = Array.isArray(f.value) ? f.value.join(', ') : String(f.value);
      return `${label} ${symbol} ${val}`;
    })
    .join(' · ');
}

/** Generate domain-aware filename: Nestor_Units_Report_2026-03-29.pdf */
export function buildExportFilename(
  domainId: BuilderDomainId,
  extension: 'pdf' | 'xlsx',
): string {
  const domainLabel = domainId.charAt(0).toUpperCase() + domainId.slice(1);
  const today = nowISO().slice(0, 10);
  return `Nestor_${domainLabel}_Report_${today}.${extension}`;
}
