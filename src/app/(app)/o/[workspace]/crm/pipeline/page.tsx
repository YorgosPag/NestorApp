'use client';

/**
 * CRM Pipeline Page
 * @lazy ADR-294 — Thin wrapper, content loaded via dynamic import
 */

import { CrmRoutes } from '@/components/crm/crm-routes';

const CrmPipeline = CrmRoutes.CrmPipeline;

export default function CrmPipelinePage() {
  return <CrmPipeline />;
}
