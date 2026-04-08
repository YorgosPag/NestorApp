'use client';

/**
 * @module /reports/export
 * @enterprise ADR-265 Phase 13 — Export Center
 * @lazy ADR-294 Batch 2 — Thin wrapper, content loaded via dynamic import
 */

import { LazyRoutes } from '@/utils/lazyRoutes';

const ReportsExport = LazyRoutes.ReportsExport;

export default function ExportCenterPage() {
  return <ReportsExport />;
}
