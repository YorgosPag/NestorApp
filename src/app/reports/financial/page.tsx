'use client';

/**
 * @module /reports/financial
 * @enterprise ADR-265 Phase 5 — Financial Report Dashboard
 * @lazy ADR-294 — Thin wrapper, content loaded via dynamic import
 */

import { LazyRoutes } from '@/utils/lazyRoutes';

const ReportsFinancial = LazyRoutes.ReportsFinancial;

export default function FinancialReportsPage() {
  return <ReportsFinancial />;
}
