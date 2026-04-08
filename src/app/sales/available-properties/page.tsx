'use client';

/**
 * @module /sales/available-properties
 * @enterprise ADR-197 — Sales Available Properties
 * @lazy ADR-294 Batch 3 — Thin wrapper, content loaded via dynamic import
 */

import { LazyRoutes } from '@/utils/lazyRoutes';

const SalesAvailableProperties = LazyRoutes.SalesAvailableProperties;

export default function AvailablePropertiesPage() {
  return <SalesAvailableProperties />;
}
