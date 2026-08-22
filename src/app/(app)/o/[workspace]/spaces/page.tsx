'use client';

/**
 * @module /spaces
 * @enterprise Spaces Hub Dashboard
 * @lazy ADR-294 Batch 3 — Thin wrapper, content loaded via dynamic import
 */

import { LazyRoutes } from '@/utils/lazyRoutes';

const SpacesHub = LazyRoutes.SpacesHub;

export default function SpacesPage() {
  return <SpacesHub />;
}
