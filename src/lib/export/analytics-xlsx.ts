/**
 * Excel multi-sheet workbook builder for Spend Analytics (ADR-331 §2.6, D6).
 * Uses ExcelJS SSoT (already installed @4.4.0 — replaces ADR-proposed xlsx@0.18 to avoid duplicate dep).
 * Sheets: Overview · By Vendor · By Category · By Project · Monthly Trend · Budget vs Actual.
 * @module lib/export/analytics-xlsx
 * @see ADR-331 Phase B2
 */

import ExcelJS from 'exceljs';
import type { SpendAnalyticsResult } from '@/services/procurement/aggregators/spendAnalyticsAggregator';

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

const TITLE_FONT: Partial<ExcelJS.Font> = { bold: true, size: 14 };
const CURRENCY_FMT = '#,##0.00';

function styleHeaderRow(headerRow: ExcelJS.Row): void {
  headerRow.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
}

function autoSize(ws: ExcelJS.Worksheet): void {
  ws.columns.forEach((col) => {
    let max = 10;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = String(cell.value ?? '').length;
      if (len > max) max = len;
    });
    col.width = Math.min(max + 2, 40);
  });
}

function setCurrencyColumns(ws: ExcelJS.Worksheet, letters: string[]): void {
  for (const letter of letters) {
    ws.getColumn(letter).numFmt = CURRENCY_FMT;
  }
}

function buildOverviewSheet(wb: ExcelJS.Workbook, result: SpendAnalyticsResult): void {
  const ws = wb.addWorksheet('Overview');
  ws.addRow([`Period: ${result.filters.from} → ${result.filters.to}`]).font = TITLE_FONT;
  ws.addRow([`Comparison: ${result.comparison.previousFrom} → ${result.comparison.previousTo}`]).font = { italic: true };
  ws.addRow([]);
  styleHeaderRow(ws.addRow(['KPI', 'Current', 'Δ %']));
  const { kpis } = result.current;
  const { deltas } = result.comparison;
  ws.addRow(['Total POs', kpis.totalPOs, deltas.totalPOs]);
  ws.addRow(['Committed Amount', kpis.committedAmount, deltas.committedAmount]);
  ws.addRow(['Delivered Amount', kpis.deliveredAmount, deltas.deliveredAmount]);
  ws.addRow(['Active Suppliers', kpis.activeSuppliers, deltas.activeSuppliers]);
  setCurrencyColumns(ws, ['B']);
  autoSize(ws);
}

function buildByVendorSheet(wb: ExcelJS.Workbook, result: SpendAnalyticsResult): void {
  const ws = wb.addWorksheet('By Vendor');
  styleHeaderRow(ws.addRow(['Rank', 'Supplier Name', 'Supplier ID', 'Total', 'PO Count']));
  result.current.byVendor.forEach((v, i) => {
    ws.addRow([i + 1, v.supplierName, v.supplierId, v.total, v.poCount]);
  });
  setCurrencyColumns(ws, ['D']);
  autoSize(ws);
}

function buildByCategorySheet(wb: ExcelJS.Workbook, result: SpendAnalyticsResult): void {
  const ws = wb.addWorksheet('By Category');
  styleHeaderRow(ws.addRow(['Category', 'Total']));
  for (const c of result.current.byCategory) {
    ws.addRow([c.code, c.total]);
  }
  setCurrencyColumns(ws, ['B']);
  autoSize(ws);
}

function buildByProjectSheet(wb: ExcelJS.Workbook, result: SpendAnalyticsResult): void {
  const ws = wb.addWorksheet('By Project');
  styleHeaderRow(ws.addRow(['Project ID', 'Total']));
  for (const p of result.current.byProject) {
    ws.addRow([p.projectId, p.total]);
  }
  setCurrencyColumns(ws, ['B']);
  autoSize(ws);
}

function buildMonthlyTrendSheet(wb: ExcelJS.Workbook, result: SpendAnalyticsResult): void {
  const ws = wb.addWorksheet('Monthly Trend');
  styleHeaderRow(ws.addRow(['Month', 'Total']));
  for (const m of result.current.monthlyTrend) {
    ws.addRow([m.month, m.total]);
  }
  setCurrencyColumns(ws, ['B']);
  autoSize(ws);
}

function buildBudgetVsActualSheet(wb: ExcelJS.Workbook, result: SpendAnalyticsResult): void {
  const ws = wb.addWorksheet('Budget vs Actual');
  styleHeaderRow(ws.addRow(['Category', 'Budget', 'Committed', 'Delivered']));
  for (const b of result.current.budgetVsActual) {
    ws.addRow([b.categoryCode, b.budget, b.committed, b.delivered]);
  }
  setCurrencyColumns(ws, ['B', 'C', 'D']);
  autoSize(ws);
}

export async function buildSpendAnalyticsWorkbook(result: SpendAnalyticsResult): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Nestor App';
  wb.created = new Date();
  buildOverviewSheet(wb, result);
  buildByVendorSheet(wb, result);
  buildByCategorySheet(wb, result);
  buildByProjectSheet(wb, result);
  buildMonthlyTrendSheet(wb, result);
  buildBudgetVsActualSheet(wb, result);
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}
