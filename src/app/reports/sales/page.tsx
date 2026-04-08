'use client';

/**
 * @module /reports/sales
 * @enterprise ADR-265 Phase 6 — Sales & Collections Report Dashboard
 * @lazy ADR-294 — Thin wrapper, content loaded via dynamic import
 */

import { LazyRoutes } from '@/utils/lazyRoutes';

const ReportsSales = LazyRoutes.ReportsSales;

export default function SalesReportsPage() {
  return <ReportsSales />;
}
