/**
 * @fileoverview Excel Exporter — Financial Reports (Phase 2e)
 * @description ExcelJS-based export with styled headers and auto-width columns
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-30
 * @see DECISIONS-PHASE-2.md §2e (Q8 — export formats)
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import ExcelJS from 'exceljs';
import type { ReportType, ReportDataMap, ResolvedPeriods } from '../../types/reports';
import { flattenReportForExport } from './report-table-adapter';
import type { CellValue } from './report-table-adapter';
import { triggerBlobDownload } from '@/services/gantt-export/gantt-export-utils';

// ============================================================================
// CONSTANTS
// ============================================================================

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF1F2937' },
};

const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: 'FFFFFFFF' },
  size: 11,
};

const TITLE_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  size: 14,
};

// ============================================================================
// HELPERS
// ============================================================================

function cellToExcelValue(value: CellValue): string | number {
  if (value === null || value === undefined) return '';
  return value;
}

function autoSizeColumns(worksheet: ExcelJS.Worksheet): void {
  worksheet.columns.forEach((column) => {
    let maxWidth = 10;
    column.eachCell?.({ includeEmpty: false }, (cell) => {
      const cellLength = String(cell.value ?? '').length;
      if (cellLength > maxWidth) maxWidth = cellLength;
    });
    column.width = Math.min(maxWidth + 2, 40);
  });
}

function buildFilename(reportType: ReportType, period: ResolvedPeriods): string {
  const date = period.current.from.replace(/-/g, '');
  return `${reportType}_${date}.xlsx`;
}

// ============================================================================
// PUBLIC API
// ============================================================================

export async function exportReportExcel(
  reportType: ReportType,
  data: ReportDataMap[ReportType],
  period: ResolvedPeriods,
  title: string
): Promise<void> {
  const tableData = flattenReportForExport(reportType, data);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Nestor App';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(title.slice(0, 31));

  // Title row
  const titleRow = worksheet.addRow([title]);
  titleRow.font = TITLE_FONT;
  worksheet.mergeCells(1, 1, 1, tableData.headers.length);

  // Period row
  worksheet.addRow([`Period: ${period.current.from} — ${period.current.to}`]);
  worksheet.addRow([]);

  // Header row
  const headerRow = worksheet.addRow(tableData.headers);
  headerRow.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FF374151' } },
    };
  });

  // Data rows
  for (const row of tableData.rows) {
    const excelRow = worksheet.addRow(row.map(cellToExcelValue));

    // Number formatting for currency columns
    excelRow.eachCell((cell, colNumber) => {
      if (typeof cell.value === 'number' && colNumber > 1) {
        cell.numFmt = '#,##0.00';
        cell.alignment = { horizontal: 'right' };
      }
    });
  }

  // Summary section
  if (tableData.summaryMetrics.length > 0) {
    worksheet.addRow([]);
    const summaryHeaderRow = worksheet.addRow(['Summary Metrics', 'Value', 'Change %']);
    summaryHeaderRow.font = { bold: true };

    for (const metric of tableData.summaryMetrics) {
      const pct = metric.change?.percentage;
      worksheet.addRow([
        metric.label,
        metric.value,
        pct !== null && pct !== undefined ? `${pct.toFixed(1)}%` : '—',
      ]);
    }
  }

  autoSizeColumns(worksheet);

  // Generate and download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const filename = buildFilename(reportType, period);

  triggerBlobDownload(blob, filename);
}
