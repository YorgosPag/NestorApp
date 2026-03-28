/**
 * Report Excel Exporter — Generic Enterprise Excel Generation
 *
 * Produces a 4-sheet workbook per ADR-265 specification:
 * 1. Executive Summary — KPI metric/value pairs
 * 2. Charts Data — Tabular data behind each chart
 * 3. Detail — Full data table with auto-filters and conditional formatting
 * 4. Raw Data — Unformatted export for BI tools
 *
 * Pattern: payment-excel-exporter.ts (ExcelJS + designTokens + triggerBlobDownload)
 *
 * @module services/report-engine/report-excel-exporter
 * @see ADR-265 §8.16 (Export Best Practices)
 */

import ExcelJS from 'exceljs';
import { designTokens } from '@/styles/design-tokens';
import { triggerBlobDownload } from '@/services/gantt-export/gantt-export-utils';
import { formatDateShort } from '@/lib/intl-utils';

// ============================================================================
// TYPES
// ============================================================================

export interface ExcelSummaryRow {
  metric: string;
  value: string | number;
  format?: 'currency' | 'percentage' | 'number';
}

export interface ExcelChartDataSection {
  chartTitle: string;
  headers: string[];
  rows: Array<Array<string | number>>;
}

export interface ExcelDetailColumn {
  header: string;
  key: string;
  width: number;
  format?: 'currency' | 'percentage' | 'date' | 'number';
}

export interface ReportExcelConfig {
  title: string;
  projectName?: string;
  companyName?: string;
  filename: string;

  /** Sheet 1: Executive Summary KPI rows */
  summaryRows: ExcelSummaryRow[];

  /** Sheet 2: Charts Data — tabular data behind each chart */
  chartsData?: ExcelChartDataSection[];

  /** Sheet 3: Detail — main data table */
  detailColumns: ExcelDetailColumn[];
  detailRows: Array<Record<string, string | number>>;

  /** Sheet 4: Raw Data (optional — uses detailColumns/detailRows if omitted) */
  rawColumns?: ExcelDetailColumn[];
  rawRows?: Array<Record<string, string | number>>;

  /** Highlight rows with overdue > 0 */
  highlightOverdue?: boolean;
  overdueColumnKey?: string;
}

// ============================================================================
// STYLE CONSTANTS
// ============================================================================

const toExcelArgb = (hexColor: string): string => {
  const normalized = hexColor.replace('#', '').toUpperCase();
  return `FF${normalized}`;
};

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: toExcelArgb(designTokens.colors.blue['500']) },
};

const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: toExcelArgb(designTokens.colors.background.primary) },
  size: 11,
};

const SUMMARY_HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: toExcelArgb(designTokens.colors.green['500']) },
};

const OVERDUE_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: toExcelArgb(designTokens.colors.error['50']) },
};

const SECTION_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: toExcelArgb(designTokens.colors.blue['50']) },
};

const BORDER_THIN: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' },
  bottom: { style: 'thin' },
  left: { style: 'thin' },
  right: { style: 'thin' },
};

// ============================================================================
// SHEET BUILDERS
// ============================================================================

function buildExecutiveSummarySheet(
  workbook: ExcelJS.Workbook,
  config: ReportExcelConfig,
): void {
  const sheet = workbook.addWorksheet('Σύνοψη');

  sheet.columns = [
    { header: 'Μετρική', key: 'metric', width: 35 },
    { header: 'Τιμή', key: 'value', width: 25 },
  ];

  // Header style
  const headerRow = sheet.getRow(1);
  headerRow.font = HEADER_FONT;
  headerRow.fill = SUMMARY_HEADER_FILL;
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 24;

  // Title row
  const titleRow = sheet.addRow({ metric: config.title, value: '' });
  titleRow.font = { bold: true, size: 13 };
  titleRow.height = 28;

  // Metadata
  if (config.companyName) {
    sheet.addRow({ metric: 'Εταιρεία', value: config.companyName });
  }
  if (config.projectName) {
    sheet.addRow({ metric: 'Έργο', value: config.projectName });
  }
  sheet.addRow({ metric: 'Ημερομηνία', value: formatDateShort(new Date()) });
  sheet.addRow({ metric: '', value: '' }); // spacer

  // KPI rows
  for (const item of config.summaryRows) {
    const row = sheet.addRow({ metric: item.metric, value: item.value });
    row.border = BORDER_THIN;
    row.getCell('metric').font = { bold: true };

    const valueCell = row.getCell('value');
    if (item.format === 'currency') {
      valueCell.numFmt = '#,##0.00';
      valueCell.alignment = { horizontal: 'right' };
    } else if (item.format === 'percentage') {
      valueCell.numFmt = '0.00"%"';
      valueCell.alignment = { horizontal: 'center' };
    } else if (item.format === 'number') {
      valueCell.numFmt = '#,##0';
      valueCell.alignment = { horizontal: 'right' };
    }
  }
}

function buildChartsDataSheet(
  workbook: ExcelJS.Workbook,
  config: ReportExcelConfig,
): void {
  if (!config.chartsData || config.chartsData.length === 0) return;

  const sheet = workbook.addWorksheet('Δεδομένα Γραφημάτων');
  let currentRow = 1;

  for (const section of config.chartsData) {
    // Section header (merged, bold, blue background)
    const sectionRow = sheet.getRow(currentRow);
    sectionRow.getCell(1).value = section.chartTitle;
    sectionRow.getCell(1).font = { bold: true, size: 11 };
    sectionRow.fill = SECTION_FILL;
    sectionRow.height = 22;

    if (section.headers.length > 1) {
      sheet.mergeCells(currentRow, 1, currentRow, section.headers.length);
    }
    currentRow++;

    // Column headers
    const colHeaderRow = sheet.getRow(currentRow);
    section.headers.forEach((h, i) => {
      const cell = colHeaderRow.getCell(i + 1);
      cell.value = h;
      cell.font = HEADER_FONT;
      cell.fill = HEADER_FILL;
      cell.alignment = { horizontal: 'center' };
    });
    colHeaderRow.height = 20;
    currentRow++;

    // Data rows
    for (const dataRow of section.rows) {
      const row = sheet.getRow(currentRow);
      dataRow.forEach((val, i) => {
        const cell = row.getCell(i + 1);
        cell.value = val;
        cell.border = BORDER_THIN;
        if (typeof val === 'number') {
          cell.numFmt = val % 1 !== 0 ? '#,##0.00' : '#,##0';
          cell.alignment = { horizontal: 'right' };
        }
      });
      currentRow++;
    }

    // Spacer row between sections
    currentRow++;
  }

  // Auto-width columns (estimate from content)
  const maxCols = Math.max(...config.chartsData.map(s => s.headers.length));
  for (let i = 1; i <= maxCols; i++) {
    const col = sheet.getColumn(i);
    col.width = 18;
  }
}

function buildDetailSheet(
  workbook: ExcelJS.Workbook,
  config: ReportExcelConfig,
): void {
  const sheet = workbook.addWorksheet('Αναλυτικά');

  sheet.columns = config.detailColumns.map(col => ({
    header: col.header,
    key: col.key,
    width: col.width,
  }));

  // Header style
  const headerRow = sheet.getRow(1);
  headerRow.font = HEADER_FONT;
  headerRow.fill = HEADER_FILL;
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 24;

  // Data rows
  for (const dataRow of config.detailRows) {
    const excelRow = sheet.addRow(dataRow);
    excelRow.border = BORDER_THIN;

    // Apply format per column
    for (const col of config.detailColumns) {
      const cell = excelRow.getCell(col.key);
      if (col.format === 'currency') {
        cell.numFmt = '#,##0.00';
        cell.alignment = { horizontal: 'right' };
      } else if (col.format === 'percentage') {
        cell.numFmt = '0.00"%"';
        cell.alignment = { horizontal: 'center' };
      } else if (col.format === 'date' && typeof cell.value === 'string') {
        cell.value = cell.value ? formatDateShort(cell.value) : '-';
      }
    }

    // Highlight overdue
    if (config.highlightOverdue && config.overdueColumnKey) {
      const overdueVal = dataRow[config.overdueColumnKey];
      if (typeof overdueVal === 'number' && overdueVal > 0) {
        excelRow.fill = OVERDUE_FILL;
        excelRow.getCell(config.overdueColumnKey).font = {
          bold: true,
          color: { argb: toExcelArgb(designTokens.colors.red['600']) },
        };
      }
    }
  }

  // Auto-filter
  const lastRow = config.detailRows.length + 1;
  const lastCol = String.fromCharCode(64 + config.detailColumns.length);
  sheet.autoFilter = { from: 'A1', to: `${lastCol}${lastRow}` };
}

function buildRawDataSheet(
  workbook: ExcelJS.Workbook,
  config: ReportExcelConfig,
): void {
  const columns = config.rawColumns ?? config.detailColumns;
  const rows = config.rawRows ?? config.detailRows;

  const sheet = workbook.addWorksheet('Raw Data');

  sheet.columns = columns.map(col => ({
    header: col.header,
    key: col.key,
    width: col.width,
  }));

  // Minimal header style (no color)
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, size: 11 };
  headerRow.height = 20;

  // Data rows — no formatting, no borders, raw export
  for (const dataRow of rows) {
    sheet.addRow(dataRow);
  }

  // Auto-filter
  const lastRow = rows.length + 1;
  const lastCol = String.fromCharCode(64 + columns.length);
  sheet.autoFilter = { from: 'A1', to: `${lastCol}${lastRow}` };
}

// ============================================================================
// MAIN EXPORT FUNCTION
// ============================================================================

/**
 * Export a report to Excel with 4 sheets:
 * 1. Σύνοψη (Executive Summary)
 * 2. Δεδομένα Γραφημάτων (Charts Data)
 * 3. Αναλυτικά (Detail)
 * 4. Raw Data
 */
export async function exportReportToExcel(config: ReportExcelConfig): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Nestor Pagonis';
  workbook.created = new Date();

  buildExecutiveSummarySheet(workbook, config);
  buildChartsDataSheet(workbook, config);
  buildDetailSheet(workbook, config);
  buildRawDataSheet(workbook, config);

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  triggerBlobDownload(blob, config.filename);
}
