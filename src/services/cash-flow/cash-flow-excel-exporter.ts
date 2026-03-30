/**
 * @fileoverview Cash Flow Forecast Excel Exporter — ADR-268 Phase 8
 * @description 4-sheet workbook: Summary, Monthly Projection, PDC Calendar, Forecast vs Actual.
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, <500 lines
 */

import ExcelJS from 'exceljs';
import type {
  ScenarioProjection,
  PDCCalendarDay,
  ActualVsForecast,
  CashFlowConfig,
} from './cash-flow.types';

// =============================================================================
// EXPORT PARAMS
// =============================================================================

export interface CashFlowExcelParams {
  projection: ScenarioProjection;
  config: CashFlowConfig;
  pdcCalendar: PDCCalendarDay[];
  actuals: ActualVsForecast[];
  userName: string;
}

// =============================================================================
// COLORS
// =============================================================================

const NAVY = '1E3A5F';
const WHITE = 'FFFFFF';
const GREEN_BG = 'DCFCE7';
const RED_BG = 'FEE2E2';
const SLATE_50 = 'F8FAFC';

// =============================================================================
// MAIN EXPORT
// =============================================================================

export async function exportCashFlowToExcel(params: CashFlowExcelParams): Promise<void> {
  const { projection, config, pdcCalendar, actuals, userName } = params;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = userName;
  workbook.created = new Date();

  buildSummarySheet(workbook, projection, config);
  buildProjectionSheet(workbook, projection);
  buildPDCSheet(workbook, pdcCalendar);
  buildActualsSheet(workbook, actuals);

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBuffer(buffer, projection.scenario);
}

// =============================================================================
// SHEET 1: SUMMARY
// =============================================================================

function buildSummarySheet(
  wb: ExcelJS.Workbook,
  projection: ScenarioProjection,
  config: CashFlowConfig,
): void {
  const ws = wb.addWorksheet('Summary');

  ws.columns = [
    { width: 30 },
    { width: 25 },
  ];

  // Title
  const titleRow = ws.addRow(['Cash Flow Forecast — Summary']);
  styleTitle(titleRow);

  ws.addRow([]);

  // KPIs
  ws.addRow(['Scenario', `${projection.scenario} (${(projection.collectionRate * 100).toFixed(0)}%)`]);
  ws.addRow(['Initial Balance', config.initialBalance]);
  ws.addRow(['Total Forecast Inflow', projection.totalInflow]);
  ws.addRow(['Total Forecast Outflow', projection.totalOutflow]);
  ws.addRow(['Ending Balance', projection.endingBalance]);
  ws.addRow(['Lowest Balance', projection.lowestBalance]);
  ws.addRow(['Lowest Balance Month', projection.lowestBalanceMonth]);
  ws.addRow(['Cash Runway (months)', projection.cashRunwayMonths]);

  ws.addRow([]);
  ws.addRow(['Generated', new Date().toISOString()]);
  ws.addRow(['User', wb.creator]);

  // Format currency cells
  for (let i = 4; i <= 9; i++) {
    const cell = ws.getRow(i).getCell(2);
    cell.numFmt = '#,##0.00 €';
  }
}

// =============================================================================
// SHEET 2: MONTHLY PROJECTION
// =============================================================================

function buildProjectionSheet(wb: ExcelJS.Workbook, projection: ScenarioProjection): void {
  const ws = wb.addWorksheet('Monthly Projection');

  const headers = [
    'Month', 'Opening', 'Installments', 'Cheques', 'Cheque Count',
    'Total Inflow', 'POs', 'Invoices', 'EFKA', 'Recurring',
    'Total Outflow', 'Net Cash Flow', 'Closing Balance',
  ];

  const headerRow = ws.addRow(headers);
  styleHeader(headerRow);

  for (const month of projection.months) {
    const row = ws.addRow([
      month.label,
      month.openingBalance,
      month.installmentsDue,
      month.chequesMaturingAmount,
      month.chequesMaturingCount,
      month.totalInflow,
      month.purchaseOrders,
      month.invoicesDue,
      month.efka,
      month.recurringPayments,
      month.totalOutflow,
      month.netCashFlow,
      month.closingBalance,
    ]);

    // Currency format for columns B-M (except E=count)
    for (let c = 2; c <= 13; c++) {
      if (c === 5) continue; // cheque count
      row.getCell(c).numFmt = '#,##0.00 €';
    }

    // Conditional: negative closing balance → red bg
    if (month.closingBalance < 0) {
      row.getCell(13).fill = {
        type: 'pattern', pattern: 'solid', fgColor: { argb: RED_BG },
      };
    }

    // Green for inflow, red for outflow
    row.getCell(6).fill = {
      type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN_BG },
    };
    row.getCell(11).fill = {
      type: 'pattern', pattern: 'solid', fgColor: { argb: RED_BG },
    };
  }

  // Freeze pane
  ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];

  // Auto-filter
  ws.autoFilter = { from: 'A1', to: `M${projection.months.length + 1}` };

  // Column widths
  ws.columns.forEach((col) => { col.width = 16; });
  if (ws.columns[0]) ws.columns[0].width = 12;
}

// =============================================================================
// SHEET 3: PDC CALENDAR
// =============================================================================

function buildPDCSheet(wb: ExcelJS.Workbook, pdcCalendar: PDCCalendarDay[]): void {
  const ws = wb.addWorksheet('PDC Calendar');

  const headerRow = ws.addRow(['Date', 'Cheque Count', 'Total Amount']);
  styleHeader(headerRow);

  for (const day of pdcCalendar) {
    const row = ws.addRow([day.date, day.chequeCount, day.totalAmount]);
    row.getCell(3).numFmt = '#,##0.00 €';
  }

  ws.columns = [{ width: 14 }, { width: 14 }, { width: 18 }];
}

// =============================================================================
// SHEET 4: FORECAST VS ACTUAL
// =============================================================================

function buildActualsSheet(wb: ExcelJS.Workbook, actuals: ActualVsForecast[]): void {
  const ws = wb.addWorksheet('Forecast vs Actual');

  const headers = [
    'Month', 'Forecast In', 'Actual In', 'Variance In', 'Var %',
    'Forecast Out', 'Actual Out', 'Variance Out', 'Var %',
  ];

  const headerRow = ws.addRow(headers);
  styleHeader(headerRow);

  for (const row of actuals) {
    const dataRow = ws.addRow([
      row.label,
      row.forecastInflow,
      row.actualInflow,
      row.inflowVariance,
      row.inflowVariancePct / 100,
      row.forecastOutflow,
      row.actualOutflow,
      row.outflowVariance,
      row.outflowVariancePct / 100,
    ]);

    for (let c = 2; c <= 8; c++) {
      if (c === 5 || c === 9) continue;
      dataRow.getCell(c).numFmt = '#,##0.00 €';
    }
    dataRow.getCell(5).numFmt = '0.0%';
    dataRow.getCell(9).numFmt = '0.0%';
  }

  ws.columns.forEach((col) => { col.width = 15; });
  if (ws.columns[0]) ws.columns[0].width = 12;
}

// =============================================================================
// STYLE HELPERS
// =============================================================================

function styleTitle(row: ExcelJS.Row): void {
  row.font = { bold: true, size: 14, color: { argb: NAVY } };
}

function styleHeader(row: ExcelJS.Row): void {
  row.eachCell((cell) => {
    cell.font = { bold: true, size: 9, color: { argb: WHITE } };
    cell.fill = {
      type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY },
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      bottom: { style: 'thin', color: { argb: NAVY } },
    };
  });
}

// =============================================================================
// DOWNLOAD HELPER
// =============================================================================

function downloadBuffer(buffer: ExcelJS.Buffer, scenario: string): void {
  const dateStr = new Date().toISOString().substring(0, 10).replace(/-/g, '');
  const filename = `Nestor_CashFlow_${scenario}_${dateStr}.xlsx`;

  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
