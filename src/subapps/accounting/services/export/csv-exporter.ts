/**
 * @fileoverview CSV Serializer — Financial Reports (Phase 2e)
 * @description Vanilla JS CSV with UTF-8 BOM for Excel compatibility. Pure document → Blob: the pipeline
 *   (`report-export.ts`) owns flattening, filename and download.
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-30
 * @see DECISIONS-PHASE-2.md §2e (Q8 — export formats) · ADR-584 §9
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, zero dependencies
 */

import type { CellValue } from './report-table-adapter';
import type { ReportDocument, ReportSerializer } from './report-export';

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

// ============================================================================
// SERIALIZER
// ============================================================================

/**
 * CSV with UTF-8 BOM, in the language of `t`. Numbers stay raw (machine-readable); headers and labels are translated.
 */
function serializeCsv({ table, title, periodLine }: ReportDocument): Blob {
  const lines = [
    escapeCell(title),
    escapeCell(periodLine),
    '',
    table.columns.map((column) => escapeCell(column.header)).join(','),
    ...table.rows.map((row) => row.cells.map(escapeCell).join(',')),
  ];
  return new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
}

export const csvReportSerializer: ReportSerializer = { extension: 'csv', serialize: serializeCsv };
