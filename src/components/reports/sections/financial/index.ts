/**
 * @module reports/sections/financial
 * @enterprise ADR-265 Phase 5 — Financial Report section components
 */

export { EVMDashboard } from './EVMDashboard';
export { EVMTrendChart } from './EVMTrendChart';
export { CostVarianceWaterfall } from './CostVarianceWaterfall';
export { CashFlowForecast } from './CashFlowForecast';
export { RevenueRecognition } from './RevenueRecognition';

export type {
  FinancialReportPayload,
  CostVarianceItem,
  RevenueByBuilding,
} from './types';
