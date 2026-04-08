'use client';

/**
 * @module /sales/sold
 * @enterprise Sold Properties Dashboard
 * @lazy ADR-294 Batch 3 — Thin wrapper, content loaded via dynamic import
 */

import { LazyRoutes } from '@/utils/lazyRoutes';

const SalesSold = LazyRoutes.SalesSold;

export default function SoldPropertiesPage() {
  return <SalesSold />;
}
