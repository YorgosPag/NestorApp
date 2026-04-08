'use client';

/**
 * CRM Leads Page
 * @lazy ADR-294 — Thin wrapper, content loaded via dynamic import
 */

import { LazyRoutes } from '@/utils/lazyRoutes';

const CrmLeads = LazyRoutes.CrmLeads;

export default function CrmLeadsPage() {
  return <CrmLeads />;
}
