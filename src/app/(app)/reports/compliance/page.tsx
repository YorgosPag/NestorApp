'use client';

/**
 * @module /reports/compliance
 * @enterprise ADR-265 Phase 12 — Compliance Report Dashboard
 * @lazy ADR-294 Batch 2 — Thin wrapper, content loaded via dynamic import
 */

import { LazyRoutes } from '@/utils/lazyRoutes';

const ReportsCompliance = LazyRoutes.ReportsCompliance;

export default function ComplianceReportsPage() {
  return <ReportsCompliance />;
}
