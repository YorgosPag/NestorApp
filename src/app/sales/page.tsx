'use client';

/**
 * @module /sales
 * @enterprise Sales Hub Dashboard
 * @lazy ADR-294 Batch 3 — Thin wrapper, content loaded via dynamic import
 */

import { LazyRoutes } from '@/utils/lazyRoutes';

const SalesHub = LazyRoutes.SalesHub;

export default function SalesPage() {
  return <SalesHub />;
}
