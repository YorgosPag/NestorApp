'use client';

/**
 * @module /sales/available-storage
 * @enterprise ADR-199 — Sales Available Storage
 * @lazy ADR-294 Batch 3 — Thin wrapper, content loaded via dynamic import
 */

import { LazyRoutes } from '@/utils/lazyRoutes';

const SalesAvailableStorage = LazyRoutes.SalesAvailableStorage;

export default function AvailableStoragePage() {
  return <SalesAvailableStorage />;
}
