'use client';

/**
 * @module /reports
 * @enterprise ADR-265 Phase 4 — Executive Summary Dashboard
 * @lazy ADR-294 — Thin wrapper, content loaded via dynamic import
 */

import { LazyRoutes } from '@/utils/lazyRoutes';

const ReportsExecutive = LazyRoutes.ReportsExecutive;

export default function ReportsPage() {
  return <ReportsExecutive />;
}
