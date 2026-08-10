'use client';

/**
 * @module /reports/cash-flow
 * @enterprise ADR-268 Phase 8 — Cash Flow Forecast
 * @lazy ADR-294 Batch 2 — Thin wrapper, content loaded via dynamic import
 */

import { LazyRoutes } from '@/utils/lazyRoutes';

const ReportsCashFlow = LazyRoutes.ReportsCashFlow;

export default function CashFlowPage() {
  return <ReportsCashFlow />;
}
