/**
 * CSV serializer for Spend Analytics export (ADR-331 §2.6, D6).
 * Pure function — denormalized single-sheet `[Section, Key, V1, V2, V3]` layout.
 * @module lib/export/analytics-csv
 * @see ADR-331 Phase B2
 */

import type { SpendAnalyticsResult } from '@/services/procurement/aggregators/spendAnalyticsAggregator';

type CsvCell = string | number | null | undefined;

function escapeCsv(value: CsvCell): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function row(...cells: CsvCell[]): string {
  return cells.map(escapeCsv).join(',');
}

function appendKpiRows(lines: string[], result: SpendAnalyticsResult): void {
  const { kpis } = result.current;
  const { deltas } = result.comparison;
  lines.push(row('KPI', 'Total POs', kpis.totalPOs));
  lines.push(row('KPI', 'Committed Amount', kpis.committedAmount));
  lines.push(row('KPI', 'Delivered Amount', kpis.deliveredAmount));
  lines.push(row('KPI', 'Active Suppliers', kpis.activeSuppliers));
  lines.push(row('Delta %', 'Total POs', deltas.totalPOs));
  lines.push(row('Delta %', 'Committed Amount', deltas.committedAmount));
  lines.push(row('Delta %', 'Delivered Amount', deltas.deliveredAmount));
  lines.push(row('Delta %', 'Active Suppliers', deltas.activeSuppliers));
}

function appendBreakdownRows(lines: string[], result: SpendAnalyticsResult): void {
  for (const c of result.current.byCategory) {
    lines.push(row('By Category', c.code, c.total));
  }
  for (const v of result.current.byVendor) {
    lines.push(row('By Vendor', v.supplierName, v.supplierId, v.total, v.poCount));
  }
  for (const p of result.current.byProject) {
    lines.push(row('By Project', p.projectId, p.total));
  }
  for (const m of result.current.monthlyTrend) {
    lines.push(row('Monthly Trend', m.month, m.total));
  }
  for (const b of result.current.budgetVsActual) {
    lines.push(row('Budget vs Actual', b.categoryCode, b.budget, b.committed, b.delivered));
  }
}

export function formatSpendAnalyticsCsv(result: SpendAnalyticsResult): string {
  const lines: string[] = [];
  lines.push(row('Section', 'Key', 'Value1', 'Value2', 'Value3'));
  lines.push(row('Filters', 'From', result.filters.from));
  lines.push(row('Filters', 'To', result.filters.to));
  lines.push(row('Comparison', 'Previous From', result.comparison.previousFrom));
  lines.push(row('Comparison', 'Previous To', result.comparison.previousTo));
  appendKpiRows(lines, result);
  appendBreakdownRows(lines, result);
  return `${lines.join('\r\n')}\r\n`;
}
