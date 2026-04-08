'use client';

/**
 * @module /procurement
 * @enterprise ADR-267 — Procurement Dashboard
 * @lazy ADR-294 Batch 3 — Thin wrapper, content loaded via dynamic import
 */

import { LazyRoutes } from '@/utils/lazyRoutes';

const Procurement = LazyRoutes.Procurement;

export default function ProcurementPage() {
  return <Procurement />;
}
