/**
 * BIM Schedule Export — XLSX Exporter (ADR-363 §6 Phase 8).
 *
 * exceljs-backed .xlsx generation. Pattern mirror από
 * `services/gantt-export/gantt-excel-exporter.ts`:
 *   - Dynamic import (`await import('exceljs')`) — defers ~600KB από main bundle
 *   - Header style + autoFilter + column width hints
 *   - numFmt per column for native Excel numeric typing
 *
 * Layout:
 *   Sheet 1 ("Πίνακας")  — title row + blank + headers + data rows
 *
 * SSoT:
 *   - Numeric cells written σαν `number` (όχι string) μέσω
 *     `formatCellForXlsx` — Excel can sum/sort the columns
 *   - `numFmt` resolved από `xlsxNumFmtFor(valueType)` — αποθηκεύεται στο
 *     workbook (CSV-equivalent display, native Excel formatting)
 *   - Greek strings safe — exceljs writes UTF-16 internally
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §6 Phase 8
 */

import type ExcelJS from 'exceljs';
import { triggerExportDownload } from '@/lib/exports/trigger-export-download';
import type {
  Schedule,
  ScheduleColumnDef,
  ScheduleExportOptions,
} from '../types';
import type { HeaderTranslator } from './csv-exporter';
import { formatCellForXlsx, xlsxNumFmtFor } from './value-formatters';

// ─── Style constants ─────────────────────────────────────────────────────────

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF1E40AF' }, // blue-800
};

const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: 'FFFFFFFF' },
};

const TITLE_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  size: 14,
  color: { argb: 'FF1E293B' }, // slate-800
};

// ─── Column width hint ──────────────────────────────────────────────────────

function widthFor(col: ScheduleColumnDef): number {
  if (col.widthHint !== undefined) return col.widthHint;
  // Heuristic per value type
  switch (col.valueType) {
    case 'text':              return 22;
    case 'number':            return 12;
    case 'dimension-mm-to-m': return 12;
    case 'dimension-mm-to-cm':return 10;
    case 'area-m2':           return 12;
    case 'volume-m3':         return 14;
    case 'count':             return 10;
  }
}

function alignmentFor(col: ScheduleColumnDef): Partial<ExcelJS.Alignment> {
  return { horizontal: col.align, vertical: 'middle' };
}

// ─── Workbook build ──────────────────────────────────────────────────────────

async function buildWorkbook(
  schedule: Schedule,
  options: ScheduleExportOptions,
  translateHeader: HeaderTranslator,
): Promise<ExcelJS.Workbook> {
  const ExcelJSLib = (await import('exceljs')).default;
  const workbook = new ExcelJSLib.Workbook();
  workbook.creator = 'Nestor Pagonis · BIM Schedule';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Πίνακας');

  // Row 1: title
  const titleCell = sheet.getCell('A1');
  titleCell.value = options.title;
  titleCell.font = TITLE_FONT;
  sheet.mergeCells(1, 1, 1, Math.max(schedule.columns.length, 1));

  // Row 2: blank spacer (Excel renders empty row)

  // Row 3: headers
  const HEADER_ROW_INDEX = 3;
  const headerRow = sheet.getRow(HEADER_ROW_INDEX);
  schedule.columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = translateHeader(col.i18nKey);
    cell.font = HEADER_FONT;
    cell.fill = HEADER_FILL;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  // Column widths + numFmt + alignment
  schedule.columns.forEach((col, i) => {
    const column = sheet.getColumn(i + 1);
    column.width = widthFor(col);
    column.alignment = alignmentFor(col);
    const fmt = xlsxNumFmtFor(col.valueType);
    if (fmt !== undefined) column.numFmt = fmt;
  });

  // Data rows (start at row 4)
  schedule.rows.forEach((row, rowIndex) => {
    const dataRow = sheet.getRow(HEADER_ROW_INDEX + 1 + rowIndex);
    schedule.columns.forEach((col, colIndex) => {
      const raw = row.cells[col.key] ?? null;
      dataRow.getCell(colIndex + 1).value = formatCellForXlsx(raw, col.valueType);
    });
  });

  // Auto-filter on header row
  if (schedule.columns.length > 0 && schedule.rows.length > 0) {
    sheet.autoFilter = {
      from: { row: HEADER_ROW_INDEX, column: 1 },
      to: { row: HEADER_ROW_INDEX + schedule.rows.length, column: schedule.columns.length },
    };
  }

  return workbook;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Generate an xlsx Blob από schedule. Pure helper used by both download
 * trigger + tests (tests can assert blob.size > 0 without DOM).
 */
export async function scheduleToXlsxBlob(
  schedule: Schedule,
  options: ScheduleExportOptions,
  translateHeader: HeaderTranslator,
): Promise<Blob> {
  const workbook = await buildWorkbook(schedule, options, translateHeader);
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/**
 * Trigger browser download as .xlsx. Filename gets `.xlsx` extension.
 */
export async function downloadScheduleAsXlsx(
  schedule: Schedule,
  options: ScheduleExportOptions,
  translateHeader: HeaderTranslator,
): Promise<void> {
  const blob = await scheduleToXlsxBlob(schedule, options, translateHeader);
  triggerExportDownload({ blob, filename: `${options.filename}.xlsx` });
}
