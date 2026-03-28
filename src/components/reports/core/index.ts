/**
 * @module reports/core
 * @enterprise ADR-265 — Enterprise Reports System Core Primitives
 *
 * 13 reusable report building blocks used by ALL domain reports.
 * Import: `import { ReportPage, ReportChart, ... } from '@/components/reports/core'`
 */

// Level 0 — Leaf components (no internal deps)
export { ReportTrafficLight } from './ReportTrafficLight';
export type { RAGStatus, ReportTrafficLightProps } from './ReportTrafficLight';

export { ReportSparkline } from './ReportSparkline';
export type { ReportSparklineProps } from './ReportSparkline';

export { ReportGauge } from './ReportGauge';
export type { ReportGaugeProps } from './ReportGauge';

export { ReportEmptyState } from './ReportEmptyState';
export type { ReportEmptyStateProps } from './ReportEmptyState';

export { ReportExportBar } from './ReportExportBar';
export type { ExportFormat, ReportExportBarProps } from './ReportExportBar';

// Level 1 — Mid-level components
export { ReportDateRange } from './ReportDateRange';
export type { PeriodPreset, DateRangeValue, ReportDateRangeProps } from './ReportDateRange';

export { ReportSection } from './ReportSection';
export type { ReportSectionProps } from './ReportSection';

export { ReportFunnel } from './ReportFunnel';
export type { FunnelStage, ReportFunnelProps } from './ReportFunnel';

// Level 2 — Complex components
export { ReportChart } from './ReportChart';
export type { ChartType, ReportChartProps } from './ReportChart';

export { ReportTable } from './ReportTable';
export type { ReportColumnDef, SortDirection, ReportTableProps } from './ReportTable';

export { ReportKPIGrid } from './ReportKPIGrid';
export type { ReportKPI, ReportKPIGridProps } from './ReportKPIGrid';

export { ReportAgingTable } from './ReportAgingTable';
export type { AgingBucket, AgingRow, ReportAgingTableProps } from './ReportAgingTable';

// Level 3 — Page orchestrator
export { ReportPage } from './ReportPage';
export type { ReportPageProps } from './ReportPage';
