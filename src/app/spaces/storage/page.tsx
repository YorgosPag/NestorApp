'use client';

/**
 * @module /spaces/storage
 * @enterprise Storage Management
 * @lazy ADR-294 Batch 3 — Thin wrapper, content loaded via dynamic import
 */

import { LazyRoutes } from '@/utils/lazyRoutes';

const SpacesStorage = LazyRoutes.SpacesStorage;

export default function StoragePage() {
  return <SpacesStorage />;
}
