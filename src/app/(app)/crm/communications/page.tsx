'use client';

/**
 * CRM Communications Page
 * @lazy ADR-294 — Thin wrapper, content loaded via dynamic import
 */

import { LazyRoutes } from '@/utils/lazyRoutes';

const CrmCommunications = LazyRoutes.CrmCommunications;

export default function CrmCommunicationsPage() {
  return <CrmCommunications />;
}
