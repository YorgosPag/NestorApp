'use client';

/**
 * CRM Leads Page
 * @lazy ADR-294 — Thin wrapper, content loaded via dynamic import
 */

import { CrmRoutes } from '@/components/crm/crm-routes';

const CrmLeads = CrmRoutes.CrmLeads;

export default function CrmLeadsPage() {
  return <CrmLeads />;
}
