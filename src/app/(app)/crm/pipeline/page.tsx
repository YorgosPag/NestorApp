'use client';

/**
 * CRM Pipeline Page
 * @lazy ADR-294 — Thin wrapper, content loaded via dynamic import
 */

import { LazyRoutes } from '@/utils/lazyRoutes';

const CrmPipeline = LazyRoutes.CrmPipeline;

export default function CrmPipelinePage() {
  return <CrmPipeline />;
}
