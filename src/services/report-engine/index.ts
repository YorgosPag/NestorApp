/**
 * Report Engine — Barrel Exports
 *
 * @module services/report-engine
 * @see ADR-265 (Enterprise Reports System)
 */

// ── Calculators (pure functions) ────────────────────────────────────────────
export {
  computeEVM,
  computeBudgetAtCompletion,
  computeActualCost,
  computeEarnedValue,
  computePlannedValue,
  generateSCurveData,
  getTrafficLight,
} from './evm-calculator';
export type { EVMResult, SCurveDataPoint, TrafficLight } from './evm-calculator';

export {
  computeAgingBuckets,
  computeAgingForEntity,
  computeDaysOverdue,
  classifyIntoBucket,
} from './aging-calculator';
export type { AgingBucketResult, AgingAnalysis, AgingBucketKey } from './aging-calculator';

// ── Data Aggregator (server-only) ───────────────────────────────────────────
export { ReportDataAggregator } from './report-data-aggregator';
export type {
  ReportFilter,
  ReportDataEnvelope,
  ReportDomain,
  ContactsReportData,
  TopBuyerItem,
  ProjectsReportData,
  ProjectProgressItem,
  BuildingProgressItem,
  PricePerSqmItem,
  BOQVarianceItem,
  SalesReportData,
  CrmReportData,
  SpacesReportData,
  ConstructionReportData,
  ComplianceReportData,
  FinancialReportData,
} from './report-data-aggregator';

// ── PDF Exporter (client-side) ──────────────────────────────────────────────
export { exportReportToPdf } from './report-pdf-exporter';
export type {
  ReportPdfConfig,
  ReportPdfKpiCard,
  ReportPdfChartImage,
  ReportPdfTable,
} from './report-pdf-exporter';

// ── Excel Exporter (client-side) ────────────────────────────────────────────
export { exportReportToExcel } from './report-excel-exporter';
export type {
  ReportExcelConfig,
  ExcelSummaryRow,
  ExcelChartDataSection,
  ExcelDetailColumn,
} from './report-excel-exporter';
