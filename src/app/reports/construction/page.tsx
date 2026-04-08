'use client';

/**
 * @module /reports/construction
 * @enterprise ADR-265 Phase 11 — Construction & Timeline Report Dashboard
 * @lazy ADR-294 — Thin wrapper, content loaded via dynamic import
 */

import { LazyRoutes } from '@/utils/lazyRoutes';

const ReportsConstruction = LazyRoutes.ReportsConstruction;

export default function ConstructionReportsPage() {
  return <ReportsConstruction />;
}
