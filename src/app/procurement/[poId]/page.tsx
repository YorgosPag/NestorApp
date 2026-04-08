'use client';

/**
 * @module /procurement/[poId]
 * @enterprise ADR-267 — Purchase Order Detail
 * @lazy ADR-294 Batch 3 — Thin wrapper, content loaded via dynamic import
 */

import { LazyRoutes } from '@/utils/lazyRoutes';

const ProcurementDetail = LazyRoutes.ProcurementDetail;

export default function PurchaseOrderPage() {
  return <ProcurementDetail />;
}
