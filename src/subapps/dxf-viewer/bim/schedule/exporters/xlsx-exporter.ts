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
import type {
  ExportableTable,
  ExportableTableSection,
  ScheduleColumnDef,
  ScheduleExportOptions,
} from '../types';
import type { HeaderTranslator } from './csv-exporter';
import { formatCellForXlsx, xlsxNumFmtFor } from './value-formatters';
import {
  createXlsxWorkbook,
  downloadXlsxBlob,
  xlsxWorkbookToBlob,
  xlsxWorksheetNames,
} from './xlsx-workbook';

/** Ό,τι γράφει ο δημιουργός στα μεταδεδομένα του βιβλίου αυτής της πόρτας. */
const WORKBOOK_CREATOR = 'Nestor Pagonis · BIM Schedule';

/**
 * Το όνομα του **μοναδικού** φύλλου της μονοπίνακης εξαγωγής.
 *
 * ⚠️ Δεν περνά από i18n **επίτηδες**: είναι δεδομένο που γράφεται μέσα στο αρχείο και
 * ταξιδεύει σε τρίτους, οπότε μια μετάφραση θα πάγωνε τη γλώσσα του εξαγωγέα μέσα στο
 * παραδοτέο — η ίδια επιλογή που κάνει το `types/table-worksheet.ts` §3 όταν αρνείται
 * να αποθηκεύσει `t('…')` ως όνομα φύλλου.
 */
const DEFAULT_SHEET_NAME = 'Πίνακας';

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
  if (col.widthChars !== undefined) return col.widthChars;
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

/** Write ONE table into ONE worksheet: title row, blank spacer, header row, data rows. */
function writeSheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  title: string,
  schedule: ExportableTable,
  translateHeader: HeaderTranslator,
): void {
  const sheet = workbook.addWorksheet(sheetName);

  // Row 1: title
  const titleCell = sheet.getCell('A1');
  titleCell.value = title;
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
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Generate ONE workbook holding several titled tables, one worksheet each (ADR-650 M7 —
 * the survey folder ships a single .xlsx with «Συντεταγμένες» / «Οικόπεδο» / «Όγκοι» tabs
 * rather than one file per table).
 */
export async function tablesToXlsxBlob(
  sections: readonly ExportableTableSection[],
  translateHeader: HeaderTranslator,
): Promise<Blob> {
  const workbook = await createXlsxWorkbook(WORKBOOK_CREATOR);
  // 🔴 ADR-833 §5.7.1 — τα ονόματα λύνονται με **ολόκληρο** το βιβλίο μπροστά, γιατί η
  // μοναδικότητα δεν είναι ιδιότητα ενός ονόματος. Μέχρι σήμερα ο καθαρισμός γινόταν ανά
  // ενότητα και δύο ίδιοι τίτλοι **έριχναν** τον `addWorksheet` με εξαίρεση.
  const names = xlsxWorksheetNames(sections.map((section) => section.title));
  sections.forEach((section, i) => {
    writeSheet(workbook, names[i], section.title, section.table, translateHeader);
  });
  return xlsxWorkbookToBlob(workbook);
}

/**
 * Generate an xlsx Blob από schedule. Pure helper used by both download
 * trigger + tests (tests can assert blob.size > 0 without DOM).
 */
export async function scheduleToXlsxBlob(
  schedule: ExportableTable,
  options: ScheduleExportOptions,
  translateHeader: HeaderTranslator,
): Promise<Blob> {
  const workbook = await createXlsxWorkbook(WORKBOOK_CREATOR);
  writeSheet(workbook, DEFAULT_SHEET_NAME, options.title, schedule, translateHeader);
  return xlsxWorkbookToBlob(workbook);
}

/**
 * Trigger browser download as .xlsx. Filename gets `.xlsx` extension.
 */
export async function downloadScheduleAsXlsx(
  schedule: ExportableTable,
  options: ScheduleExportOptions,
  translateHeader: HeaderTranslator,
): Promise<void> {
  const blob = await scheduleToXlsxBlob(schedule, options, translateHeader);
  downloadXlsxBlob(blob, options.filename);
}
