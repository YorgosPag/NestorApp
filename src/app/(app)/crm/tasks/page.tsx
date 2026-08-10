'use client';

/**
 * CRM Tasks Page
 * @lazy ADR-294 — Thin wrapper, content loaded via dynamic import
 */

import { LazyRoutes } from '@/utils/lazyRoutes';

const CrmTasks = LazyRoutes.CrmTasks;

export default function CrmTasksPage() {
  return <CrmTasks />;
}
