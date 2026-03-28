/**
 * @module reports/sections/sales/types
 * @enterprise ADR-265 Phase 6 — Sales & Collections view-model types
 */

import type { AgingBucketResult } from '@/services/report-engine';
import type { FunnelStage } from '@/components/reports/core';

export interface SalesReportPayload {
  totalRevenue: number;
  pipelineValue: number;
  soldUnits: number;
  forSaleUnits: number;
  conversionRate: number;
  averagePaymentCoverage: number;
  totalOverdueInstallments: number;
  totalOutstanding: number;
  chequesByStatus: Record<string, number>;
  legalPhases: Record<string, number>;
  agingBuckets: AgingBucketResult[];
  generatedAt: string;
}

export interface RevenueTrendPoint {
  month: string;
  label: string;
  revenue: number;
}

export { type FunnelStage, type AgingBucketResult };
