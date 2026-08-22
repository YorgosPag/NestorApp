'use client';

/**
 * @module /reports/projects
 * @enterprise ADR-265 Phase 7 — Projects Report Dashboard
 * @lazy ADR-294 Batch 2 — Thin wrapper, content loaded via dynamic import
 */

import { LazyRoutes } from '@/utils/lazyRoutes';

const ReportsProjects = LazyRoutes.ReportsProjects;

export default function ProjectsReportsPage() {
  return <ReportsProjects />;
}
