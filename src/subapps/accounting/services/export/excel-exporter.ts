/**
 * @fileoverview Excel Serializer — Financial Reports (Phase 2e)
 * @description ExcelJS-based workbook with styled headers and auto-width columns. Pure document → Blob: the
 *   pipeline (`report-export.ts`) owns flattening, filename and download.
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-30
 * @see DECISIONS-PHASE-2.md §2e (Q8 — export formats) · ADR-584 §9
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import type ExcelJS from 'exceljs';
import { canonicalMimeForFilename } from '@/config/file-types/classification-registry';
import { PRODUCT_NAME } from '@/constants/product-identity';
import { cellFormatOf } from './report-table-adapter';
import type { CellValue, FlatTableData, ReportValueFormat } from './report-table-adapter';
import type { ReportDocument, ReportSerializer } from './report-export';

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

/**
 * Μορφή αριθμού Excel ανά μορφή κελιού. Τα ποσοστά είναι 0-100 (όχι κλάσμα) ⇒ κυριολεκτικό «%», όχι το `0.0%`
 * του Excel που θα πολλαπλασίαζε επί 100. Ως 2026-10-30 ΚΑΘΕ αριθμός έπαιρνε `#,##0.00` (πλήθη «12,00»).
 */
const NUM_FMT: Record<ReportValueFormat, string> = {
  currency: '#,##0.00',
  count: '#,##0',
  percent: '0.0"%"',
};

/**
 * Η προέκταση είναι η ΜΙΑ δήλωση· το MIME το δίνει το μητρώο τύπων αρχείου (ADR-296, CHECK 3.7), όπως στο
 * `lib/export/excel-workbook.ts` — ποτέ δεύτερη σταθερά `…spreadsheetml.sheet` εδώ.
 */
const EXTENSION = 'xlsx';

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

/** Τίτλος (συγχωνευμένος σε όλο το πλάτος) · γραμμή περιόδου · κενή γραμμή. */
function writeHeading(worksheet: ExcelJS.Worksheet, { title, periodLine, table }: ReportDocument): void {
  const titleRow = worksheet.addRow([title]);
  titleRow.font = TITLE_FONT;
  worksheet.mergeCells(1, 1, 1, table.columns.length);
  worksheet.addRow([periodLine]);
  worksheet.addRow([]);
}

function writeTable(worksheet: ExcelJS.Worksheet, { columns, rows }: FlatTableData): void {
  const headerRow = worksheet.addRow(columns.map((column) => column.header));
  headerRow.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FF374151' } },
    };
  });

  for (const row of rows) {
    const excelRow = worksheet.addRow(row.cells.map(cellToExcelValue));
    if (row.section) excelRow.font = { bold: true };

    // Number formatting by the cell's format (column role / row format) — not by position
    excelRow.eachCell((cell, colNumber) => {
      const format = cellFormatOf(columns[colNumber - 1], row);
      if (typeof cell.value === 'number' && format !== null) {
        cell.numFmt = NUM_FMT[format];
        cell.alignment = { horizontal: 'right' };
      }
    });
  }
}

function writeSummary(worksheet: ExcelJS.Worksheet, { table, t }: ReportDocument): void {
  if (table.summaryMetrics.length === 0) return;
  worksheet.addRow([]);
  const summaryHeaderRow = worksheet.addRow([
    t('reports.exportDocument.summaryMetrics'),
    t('reports.table.value'),
    t('reports.table.changePercent'),
  ]);
  summaryHeaderRow.font = { bold: true };

  for (const metric of table.summaryMetrics) {
    const pct = metric.change?.percentage ?? null;
    const metricRow = worksheet.addRow([metric.label, metric.value, pct ?? '—']);
    metricRow.getCell(2).numFmt = NUM_FMT[metric.format];
    if (pct !== null) metricRow.getCell(3).numFmt = NUM_FMT.percent;
  }
}

// ============================================================================
// SERIALIZER
// ============================================================================

async function serializeExcel(doc: ReportDocument): Promise<Blob> {
  const ExcelJSLib = (await import('exceljs')).default;
  const workbook = new ExcelJSLib.Workbook();
  workbook.creator = PRODUCT_NAME;
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(doc.title.slice(0, 31));
  writeHeading(worksheet, doc);
  writeTable(worksheet, doc.table);
  writeSummary(worksheet, doc);
  autoSizeColumns(worksheet);

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: canonicalMimeForFilename(`.${EXTENSION}`) });
}

export const excelReportSerializer: ReportSerializer = { extension: EXTENSION, serialize: serializeExcel };
