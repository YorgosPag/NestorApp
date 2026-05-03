'use client';

/**
 * @module /projects/[id]/procurement/po/[poId]
 * @enterprise ADR-330 §5.1 S1 — Project-scoped PO detail (additive).
 *   Reuses ProcurementDetailPageContent which reads `poId` via useParams().
 */

import { LazyRoutes } from '@/utils/lazyRoutes';

const ProcurementDetail = LazyRoutes.ProcurementDetail;

export default function ProjectScopedPurchaseOrderPage() {
  return <ProcurementDetail />;
}
