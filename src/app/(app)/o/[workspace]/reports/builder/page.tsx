'use client';

/**
 * @module /reports/builder
 * @enterprise ADR-268 — Dynamic Report Builder
 * @lazy ADR-294 Batch 2 — Thin wrapper, content loaded via dynamic import
 */

import { LazyRoutes } from '@/utils/lazyRoutes';

const ReportsBuilder = LazyRoutes.ReportsBuilder;

export default function ReportBuilderPage() {
  return <ReportsBuilder />;
}
