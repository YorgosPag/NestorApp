'use client';

/**
 * @module /reports/crm
 * @enterprise ADR-265 Phase 8 — CRM Report Dashboard
 * @lazy ADR-294 Batch 2 — Thin wrapper, content loaded via dynamic import
 */

import { LazyRoutes } from '@/utils/lazyRoutes';

const ReportsCrm = LazyRoutes.ReportsCrm;

export default function CrmReportsPage() {
  return <ReportsCrm />;
}
