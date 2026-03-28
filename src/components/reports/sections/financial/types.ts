/**
 * @module reports/sections/financial/types
 * @enterprise ADR-265 Phase 5 — Financial Report view-model types
 */

import type { EVMResult, SCurveDataPoint, AgingBucketResult } from '@/services/report-engine';

// ---------------------------------------------------------------------------
// API payload (returned by /api/reports/financial)
// ---------------------------------------------------------------------------

export interface FinancialReportPayload {
  totalReceivables: number;
  totalCollected: number;
  collectionRate: number;
  agingBuckets: AgingBucketResult[];
  portfolioEVM: EVMResult | null;
  evmByBuilding: Record<string, EVMResult>;
  buildingNames: Record<string, string>;
  boqEstimatedTotal: number;
  boqActualTotal: number;
  boqVariance: number;
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Chart-ready view-model types
// ---------------------------------------------------------------------------

export interface CostVarianceItem {
  building: string;
  estimated: number;
  actual: number;
  variance: number;
}

export interface RevenueByBuilding {
  building: string;
  earnedValue: number;
}

export { type EVMResult, type SCurveDataPoint, type AgingBucketResult };
