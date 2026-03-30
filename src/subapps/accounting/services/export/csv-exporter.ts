/**
 * @fileoverview CSV Exporter — Financial Reports (Phase 2e)
 * @description Vanilla JS CSV export with UTF-8 BOM for Excel compatibility
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-30
 * @see DECISIONS-PHASE-2.md §2e (Q8 — export formats)
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, zero dependencies
 */

import type { ReportType, ReportDataMap, ResolvedPeriods } from '../../types/reports';
import { flattenReportForExport } from './report-table-adapter';
import type { CellValue } from './report-table-adapter';
import { triggerBlobDownload } from '@/services/gantt-export/gantt-export-utils';

// ============================================================================
// HELPERS
// ============================================================================

/** Escape a CSV cell: wrap in quotes if contains comma, quote, or newline */
function escapeCell(value: CellValue): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildFilename(reportType: ReportType, period: ResolvedPeriods): string {
  const date = period.current.from.replace(/-/g, '');
  return `${reportType}_${date}.csv`;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Export a financial report as CSV with UTF-8 BOM.
 * Synchronous — no async needed.
 */
export function exportReportCsv(
  reportType: ReportType,
  data: ReportDataMap[ReportType],
  period: ResolvedPeriods,
  title: string
): void {
  const tableData = flattenReportForExport(reportType, data);

  // Build CSV lines
  const lines: string[] = [];

  // Title + period metadata
  lines.push(escapeCell(title));
  lines.push(`Period: ${period.current.from} to ${period.current.to}`);
  lines.push('');

  // Headers
  lines.push(tableData.headers.map(escapeCell).join(','));

  // Data rows
  for (const row of tableData.rows) {
    lines.push(row.map(escapeCell).join(','));
  }

  // UTF-8 BOM + content
  const csvContent = '\uFEFF' + lines.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
  const filename = buildFilename(reportType, period);

  triggerBlobDownload(blob, filename);
}
