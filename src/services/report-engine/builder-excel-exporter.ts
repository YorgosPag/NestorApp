/**
 * @module services/report-engine/builder-excel-exporter
 * @enterprise ADR-268 Phase 3 — Report Builder Excel Export
 *
 * Produces a 4-sheet enterprise Excel workbook with real formulas.
 * REUSES: ExcelJS patterns from report-excel-exporter.ts
 *
 * Sheets:
 * 1. Σύνοψη — KPI formulas + metadata + filters
 * 2. Δεδομένα — Auto-filters, freeze panes, conditional formatting, outline groups
 * 3. Ανάλυση — Grouped aggregations with COUNTIFS/SUMIFS (only if groupBy)
 * 4. Raw Data — Unformatted for BI import
 *
 * @see ADR-268 §11 Phase 3, SPEC-003-export.md, QA.md Q57-Q72
 */

import ExcelJS from 'exceljs';
import { designTokens } from '@/styles/design-tokens';
import { triggerBlobDownload } from '@/services/gantt-export/gantt-export-utils';
import { formatDateShort } from '@/lib/intl-utils';
import type { BuilderExportParams } from './builder-export-types';
import { buildFiltersText, buildExportFilename } from './builder-export-types';
import { buildAnalysisSheet } from './builder-excel-analysis';
import type {
  FieldDefinition,
} from '@/config/report-builder/report-builder-types';
import { nowISO } from '@/lib/date-local';

// ============================================================================
// STYLE CONSTANTS
// ============================================================================

const toArgb = (hex: string): string => `FF${hex.replace('#', '').toUpperCase()}`;

const NAVY_FILL: ExcelJS.Fill = {
  type: 'pattern', pattern: 'solid',
  fgColor: { argb: toArgb('#1E3A5F') },
};

const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true, color: { argb: 'FFFFFFFF' }, size: 11,
};

const GREEN_BG: ExcelJS.Fill = {
  type: 'pattern', pattern: 'solid',
  fgColor: { argb: toArgb('#DCFCE7') },
};

const OVERDUE_FONT: Partial<ExcelJS.Font> = {
  color: { argb: toArgb(designTokens.colors.red['600']) }, bold: true,
};

const BORDER_THIN: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' }, bottom: { style: 'thin' },
  left: { style: 'thin' }, right: { style: 'thin' },
};

const GROUP_FILL: ExcelJS.Fill = {
  type: 'pattern', pattern: 'solid',
  fgColor: { argb: toArgb('#F1F5F9') },
};

// ============================================================================
// HELPERS
// ============================================================================

function getFieldDefs(params: BuilderExportParams): FieldDefinition[] {
  return params.columns
    .map((key) => params.domainDefinition.fields.find((f) => f.key === key))
    .filter((f): f is FieldDefinition => f !== undefined);
}

function getCellValue(
  row: Record<string, unknown>,
  field: FieldDefinition,
  refs: Record<string, Record<string, string>>,
): string | number {
  const val = row[field.key];
  if (val === null || val === undefined) return '';

  if (field.refDomain) {
    return refs[field.refDomain]?.[String(val)] ?? String(val);
  }
  if ((field.type === 'number' || field.type === 'currency' || field.type === 'percentage') && typeof val === 'number') {
    return val;
  }
  if (field.type === 'boolean') return val ? 'Ναι' : 'Όχι';
  return String(val);
}

function getRawValue(row: Record<string, unknown>, field: FieldDefinition): string | number {
  const val = row[field.key];
  if (val === null || val === undefined) return '';
  if (typeof val === 'number') return val;
  if (typeof val === 'boolean') return val ? 1 : 0;
  return String(val);
}

function colLetter(index: number): string {
  let letter = '';
  let n = index;
  while (n >= 0) {
    letter = String.fromCharCode((n % 26) + 65) + letter;
    n = Math.floor(n / 26) - 1;
  }
  return letter;
}

function getExcelFormat(field: FieldDefinition): string | undefined {
  if (field.type === 'currency' || field.format === 'currency') return '€#,##0.00';
  if (field.type === 'percentage' || field.format === 'percentage') return '0.0"%"';
  if (field.type === 'number' || field.format === 'number') return '#,##0';
  if (field.type === 'date' || field.format === 'date') return 'DD/MM/YYYY';
  return undefined;
}

// ============================================================================
// SHEET 1: ΣΥΝΟΨΗ (Summary) — KPI formulas + metadata
// ============================================================================

function buildSummarySheet(
  workbook: ExcelJS.Workbook,
  params: BuilderExportParams,
  dataSheetName: string,
  fields: FieldDefinition[],
): void {
  const sheet = workbook.addWorksheet('Σύνοψη');
  sheet.columns = [
    { header: 'Μετρική', key: 'metric', width: 35 },
    { header: 'Τιμή', key: 'value', width: 30 },
  ];

  // Header
  const headerRow = sheet.getRow(1);
  headerRow.font = HEADER_FONT;
  headerRow.fill = NAVY_FILL;
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 24;

  // Metadata
  const titleRow = sheet.addRow({ metric: params.domainDefinition.labelKey, value: '' });
  titleRow.font = { bold: true, size: 14 };
  titleRow.height = 28;

  sheet.addRow({ metric: 'Ημερομηνία', value: formatDateShort(new Date()) });
  sheet.addRow({
    metric: 'Φίλτρα',
    value: buildFiltersText(params.filters, params.domainDefinition),
  });
  sheet.addRow({ metric: 'Χρήστης', value: params.userName });
  sheet.addRow({ metric: '', value: '' }); // spacer

  // KPI formulas referencing Data sheet
  const dataRowCount = params.results.rows.length;
  const lastDataRow = dataRowCount + 1; // +1 for header

  // Record count
  const countRow = sheet.addRow({ metric: 'Πλήθος Εγγραφών', value: '' });
  countRow.getCell('value').value = {
    formula: `COUNTA(${dataSheetName}!A2:A${lastDataRow})`,
    result: dataRowCount,
  } as ExcelJS.CellFormulaValue;
  countRow.border = BORDER_THIN;
  countRow.getCell('metric').font = { bold: true };

  // Numeric field formulas (SUM, AVG, MAX, MIN)
  const numericFields = fields.filter((f) =>
    f.type === 'currency' || f.type === 'number' || f.type === 'percentage',
  );

  for (const field of numericFields) {
    const colIdx = fields.indexOf(field);
    const col = colLetter(colIdx);
    const range = `${dataSheetName}!${col}2:${col}${lastDataRow}`;
    const fmt = getExcelFormat(field);

    const sumRow = sheet.addRow({ metric: `Σύνολο: ${field.labelKey}`, value: '' });
    sumRow.getCell('value').value = { formula: `SUM(${range})`, result: 0 } as ExcelJS.CellFormulaValue;
    if (fmt) sumRow.getCell('value').numFmt = fmt;
    sumRow.border = BORDER_THIN;
    sumRow.getCell('metric').font = { bold: true };

    const avgRow = sheet.addRow({ metric: `Μέσος Όρος: ${field.labelKey}`, value: '' });
    avgRow.getCell('value').value = { formula: `AVERAGE(${range})`, result: 0 } as ExcelJS.CellFormulaValue;
    if (fmt) avgRow.getCell('value').numFmt = fmt;
    avgRow.border = BORDER_THIN;
    avgRow.getCell('metric').font = { bold: true };

    const maxRow = sheet.addRow({ metric: `Μέγιστο: ${field.labelKey}`, value: '' });
    maxRow.getCell('value').value = { formula: `MAX(${range})`, result: 0 } as ExcelJS.CellFormulaValue;
    if (fmt) maxRow.getCell('value').numFmt = fmt;
    maxRow.border = BORDER_THIN;
    maxRow.getCell('metric').font = { bold: true };

    const minRow = sheet.addRow({ metric: `Ελάχιστο: ${field.labelKey}`, value: '' });
    minRow.getCell('value').value = { formula: `MIN(${range})`, result: 0 } as ExcelJS.CellFormulaValue;
    if (fmt) minRow.getCell('value').numFmt = fmt;
    minRow.border = BORDER_THIN;
    minRow.getCell('metric').font = { bold: true };
  }

  // Protect (lock formulas)
  sheet.protect('', { selectLockedCells: true, selectUnlockedCells: true });
}

// ============================================================================
// SHEET 2: ΔΕΔΟΜΕΝΑ (Data) — Full table with formatting
// ============================================================================

function buildDataSheet(
  workbook: ExcelJS.Workbook,
  params: BuilderExportParams,
  fields: FieldDefinition[],
): void {
  const sheet = workbook.addWorksheet('Δεδομένα');

  // Column definitions
  sheet.columns = fields.map((f) => ({
    header: f.labelKey,
    key: f.key,
    width: f.type === 'text' ? 25 : f.type === 'currency' ? 15 : 18,
  }));

  // Header style
  const headerRow = sheet.getRow(1);
  headerRow.font = HEADER_FONT;
  headerRow.fill = NAVY_FILL;
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 24;

  // Compute median for currency fields
  const medians = new Map<string, number>();
  for (const field of fields) {
    if (field.type === 'currency') {
      const values = params.results.rows
        .map((r) => r[field.key])
        .filter((v): v is number => typeof v === 'number')
        .sort((a, b) => a - b);
      if (values.length > 0) {
        const mid = Math.floor(values.length / 2);
        medians.set(field.key, values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2);
      }
    }
  }

  // Data rows
  const today = nowISO().slice(0, 10);

  for (const dataRow of params.results.rows) {
    const rowData: Record<string, string | number> = {};
    for (const f of fields) {
      rowData[f.key] = getCellValue(dataRow, f, params.results.resolvedRefs);
    }
    const excelRow = sheet.addRow(rowData);
    excelRow.border = BORDER_THIN;

    // Apply formatting per column
    for (const field of fields) {
      const cell = excelRow.getCell(field.key);
      const fmt = getExcelFormat(field);
      if (fmt) cell.numFmt = fmt;

      // Conditional: currency > median → green bg
      const median = medians.get(field.key);
      if (median !== undefined && typeof cell.value === 'number' && cell.value > median) {
        cell.fill = GREEN_BG;
      }

      // Conditional: overdue dates → red text
      if (field.type === 'date' && typeof dataRow[field.key] === 'string') {
        const dateStr = dataRow[field.key] as string;
        if (dateStr < today) {
          cell.font = OVERDUE_FONT;
        }
      }
    }
  }

  // Outline groups (if grouped)
  if (params.groupingResult && params.filteredGroups) {
    applyOutlineGroups(sheet, params, fields);
  }

  // Auto-filter
  const lastRow = params.results.rows.length + 1;
  const lastCol = colLetter(fields.length - 1);
  sheet.autoFilter = { from: 'A1', to: `${lastCol}${lastRow}` };

  // Freeze panes (Row 1 + Column A)
  sheet.views = [{ state: 'frozen', xSplit: 1, ySplit: 1, activeCell: 'B2' }];

  // Named range via table
  sheet.addTable({
    name: 'ReportData',
    ref: `A1:${lastCol}${lastRow}`,
    headerRow: true,
    columns: fields.map((f) => ({ name: f.labelKey, filterButton: true })),
    rows: params.results.rows.map((row) =>
      fields.map((f) => getCellValue(row, f, params.results.resolvedRefs)),
    ),
  });

  // Print setup
  sheet.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    printArea: `A1:${lastCol}${lastRow}`,
  };
}

function applyOutlineGroups(
  sheet: ExcelJS.Worksheet,
  params: BuilderExportParams,
  fields: FieldDefinition[],
): void {
  const groups = params.filteredGroups ?? [];
  if (groups.length === 0) return;

  // Build a set of group-key values from the first group field
  const groupField = fields[0]?.key;
  if (!groupField) return;

  let currentGroupKey: string | null = null;
  const rows = params.results.rows;

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2; // +1 header, +1 zero-indexed
    const rowVal = String(rows[i][groupField] ?? '');

    const groupMatch = groups.find((g) => {
      const detail = g.children.some(
        (c) => !('groupKey' in c) && String((c as Record<string, unknown>)[groupField] ?? '') === rowVal,
      );
      return detail;
    });

    if (groupMatch && groupMatch.groupKey !== currentGroupKey) {
      currentGroupKey = groupMatch.groupKey;
    }

    if (currentGroupKey) {
      const excelRow = sheet.getRow(rowNum);
      excelRow.outlineLevel = 1;
    }
  }
}

// Analysis sheet: extracted to builder-excel-analysis.ts for Google SRP

// ============================================================================
// SHEET 4: RAW DATA — Unformatted for BI import
// ============================================================================

function buildRawSheet(
  workbook: ExcelJS.Workbook,
  params: BuilderExportParams,
  fields: FieldDefinition[],
): void {
  const sheet = workbook.addWorksheet('Raw Data');

  sheet.columns = fields.map((f) => ({
    header: f.labelKey,
    key: f.key,
    width: 18,
  }));

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, size: 11 };
  headerRow.height = 20;

  for (const dataRow of params.results.rows) {
    const rowData: Record<string, string | number> = {};
    for (const f of fields) {
      rowData[f.key] = getRawValue(dataRow, f);
    }
    sheet.addRow(rowData);
  }

  // Auto-filter
  const lastRow = params.results.rows.length + 1;
  const lastCol = colLetter(fields.length - 1);
  sheet.autoFilter = { from: 'A1', to: `${lastCol}${lastRow}` };
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

export async function exportBuilderToExcel(params: BuilderExportParams): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = params.userName || 'Nestor Report Builder';
  workbook.created = new Date();

  const fields = getFieldDefs(params);
  const dataSheetName = 'Δεδομένα';

  // Build sheets in display order (formulas reference by name, order irrelevant)
  buildSummarySheet(workbook, params, dataSheetName, fields);
  buildDataSheet(workbook, params, fields);
  buildAnalysisSheet(workbook, params, dataSheetName, fields);
  buildRawSheet(workbook, params, fields);

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const filename = buildExportFilename(params.domain, 'xlsx');
  triggerBlobDownload(blob, filename);
}
