'use client';

/**
 * CRM Communications Page
 * @lazy ADR-294 — Thin wrapper, content loaded via dynamic import
 */

import { CrmRoutes } from '@/components/crm/crm-routes';

const CrmCommunications = CrmRoutes.CrmCommunications;

export default function CrmCommunicationsPage() {
  return <CrmCommunications />;
}
