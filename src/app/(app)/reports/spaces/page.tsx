'use client';

/**
 * @module /reports/spaces
 * @enterprise ADR-265 Phase 10 — Spaces Report Dashboard
 * @lazy ADR-294 Batch 2 — Thin wrapper, content loaded via dynamic import
 */

import { LazyRoutes } from '@/utils/lazyRoutes';

const ReportsSpaces = LazyRoutes.ReportsSpaces;

export default function SpacesReportsPage() {
  return <ReportsSpaces />;
}
