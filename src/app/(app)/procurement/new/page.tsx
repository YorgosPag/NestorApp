'use client';

/**
 * @module /procurement/new
 * @enterprise ADR-330 S6 — PO create form at dedicated route.
 *   Restores PO creation after deletion of the [poId] catch-all in S5.
 *   ProcurementDetailPageContent reads params.poId ?? 'new' and
 *   searchParams.get('projectId') for the initialProjectId.
 */

import { LazyRoutes } from '@/utils/lazyRoutes';

const ProcurementDetail = LazyRoutes.ProcurementDetail;

export default function NewPurchaseOrderPage() {
  return <ProcurementDetail />;
}
