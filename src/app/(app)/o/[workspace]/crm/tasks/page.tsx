'use client';

/**
 * CRM Tasks Page
 * @lazy ADR-294 — Thin wrapper, content loaded via dynamic import
 */

import { CrmRoutes } from '@/components/crm/crm-routes';

const CrmTasks = CrmRoutes.CrmTasks;

export default function CrmTasksPage() {
  return <CrmTasks />;
}
