/**
 * @module services/report-engine/builder-excel-analysis
 * @enterprise ADR-268 Phase 3 — Excel Analysis Sheet Builder
 *
 * Extracted from builder-excel-exporter.ts for Google SRP (<500 lines).
 * Builds Sheet 3 "Ανάλυση" with COUNTIFS/SUMIFS/AVERAGEIFS formulas.
 */

import ExcelJS from 'exceljs';
import { designTokens } from '@/styles/design-tokens';
import type { BuilderExportParams } from './builder-export-types';
import type { FieldDefinition } from '@/config/report-builder/report-builder-types';

// ============================================================================
// STYLE CONSTANTS
// ============================================================================

const toArgb = (hex: string): string => `FF${hex.replace('#', '').toUpperCase()}`;

const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true, color: { argb: 'FFFFFFFF' }, size: 11,
};

const BLUE_FILL: ExcelJS.Fill = {
  type: 'pattern', pattern: 'solid',
  fgColor: { argb: toArgb(designTokens.colors.blue['500']) },
};

const TOTAL_FILL: ExcelJS.Fill = {
  type: 'pattern', pattern: 'solid',
  fgColor: { argb: toArgb('#1E3A5F') },
};

const BORDER_THIN: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' }, bottom: { style: 'thin' },
  left: { style: 'thin' }, right: { style: 'thin' },
};

// ============================================================================
// HELPERS
// ============================================================================

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
// SHEET 3: ΑΝΑΛΥΣΗ (Analysis) — Grouped aggregations with formulas
// ============================================================================

export function buildAnalysisSheet(
  workbook: ExcelJS.Workbook,
  params: BuilderExportParams,
  dataSheetName: string,
  fields: FieldDefinition[],
): void {
  if (!params.groupingResult || !params.filteredGroups) return;

  const sheet = workbook.addWorksheet('Ανάλυση');
  const groups = params.filteredGroups;

  const groupField = params.groupingResult.groups[0]?.groupField;
  if (!groupField) return;
  const groupFieldIdx = fields.findIndex((f) => f.key === groupField);
  if (groupFieldIdx < 0) return;
  const groupCol = colLetter(groupFieldIdx);
  const dataRowCount = params.results.rows.length + 1;

  const numericFields = fields.filter((f) =>
    f.type === 'currency' || f.type === 'number' || f.type === 'percentage',
  );

  // Headers
  const headers = ['Ομάδα', 'Πλήθος', ...numericFields.map((f) => f.labelKey), '% Συνόλου'];
  sheet.columns = headers.map((h, i) => ({
    header: h,
    key: `col${i}`,
    width: i === 0 ? 30 : 18,
  }));

  const headerRow = sheet.getRow(1);
  headerRow.font = HEADER_FONT;
  headerRow.fill = BLUE_FILL;
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 24;

  // Group rows with formulas
  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi];
    const rowNum = gi + 2;
    const row = sheet.getRow(rowNum);

    row.getCell(1).value = group.groupKey;
    row.getCell(1).font = { bold: true };

    // COUNTIFS
    const countFormula = `COUNTIFS(${dataSheetName}!${groupCol}2:${groupCol}${dataRowCount},A${rowNum})`;
    row.getCell(2).value = { formula: countFormula, result: group.rowCount } as ExcelJS.CellFormulaValue;
    row.getCell(2).numFmt = '#,##0';

    // SUMIFS per numeric field
    for (let ni = 0; ni < numericFields.length; ni++) {
      const nf = numericFields[ni];
      const nfCol = colLetter(fields.indexOf(nf));
      const cellIdx = 3 + ni;
      const sumFormula = `SUMIFS(${dataSheetName}!${nfCol}2:${nfCol}${dataRowCount},${dataSheetName}!${groupCol}2:${groupCol}${dataRowCount},A${rowNum})`;
      row.getCell(cellIdx).value = { formula: sumFormula, result: 0 } as ExcelJS.CellFormulaValue;
      const fmt = getExcelFormat(nf);
      if (fmt) row.getCell(cellIdx).numFmt = fmt;
    }

    // % of Total
    const pctIdx = 3 + numericFields.length;
    const pctFormula = `B${rowNum}/SUM(B2:B${groups.length + 1})*100`;
    row.getCell(pctIdx).value = { formula: pctFormula, result: 0 } as ExcelJS.CellFormulaValue;
    row.getCell(pctIdx).numFmt = '0.0"%"';

    row.border = BORDER_THIN;
  }

  // Grand Total
  const totalRowNum = groups.length + 2;
  const totalRow = sheet.getRow(totalRowNum);
  totalRow.getCell(1).value = 'ΓΕΝΙΚΟ ΣΥΝΟΛΟ';
  totalRow.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  totalRow.fill = TOTAL_FILL;
  totalRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };

  totalRow.getCell(2).value = { formula: `SUM(B2:B${groups.length + 1})`, result: params.groupingResult.totalRowCount } as ExcelJS.CellFormulaValue;

  for (let ni = 0; ni < numericFields.length; ni++) {
    const cellIdx = 3 + ni;
    const sumCol = colLetter(cellIdx - 1);
    totalRow.getCell(cellIdx).value = { formula: `SUM(${sumCol}2:${sumCol}${groups.length + 1})`, result: 0 } as ExcelJS.CellFormulaValue;
    const fmt = getExcelFormat(numericFields[ni]);
    if (fmt) totalRow.getCell(cellIdx).numFmt = fmt;
  }

  totalRow.getCell(3 + numericFields.length).value = '100%';
  totalRow.border = BORDER_THIN;

  // Named range
  const lastCol = colLetter(headers.length - 1);
  sheet.addTable({
    name: 'AnalysisData',
    ref: `A1:${lastCol}${totalRowNum}`,
    headerRow: true,
    columns: headers.map((h) => ({ name: h, filterButton: true })),
    rows: Array.from({ length: groups.length + 1 }, (_, i) => {
      const r = sheet.getRow(i + 2);
      return headers.map((_, ci) => r.getCell(ci + 1).value ?? '');
    }),
  });

  // Protect formulas
  sheet.protect('', { selectLockedCells: true, selectUnlockedCells: true });

  // Print setup
  sheet.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
  };
}
