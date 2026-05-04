'use client';

import { useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ProcurementSubNav } from '@/subapps/procurement/components/ProcurementSubNav';
import { PurchaseOrderList } from '@/components/procurement/PurchaseOrderList';
import { usePurchaseOrders } from '@/hooks/procurement/usePurchaseOrders';
import { getPoDetailUrl } from '@/lib/navigation/procurement-urls';
import { PageContainer } from '@/core/containers';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { parseFilterArray } from '@/lib/url-filters/multi-value';
import type { PurchaseOrder, AnalyticsDrillFilters } from '@/types/procurement';

/** Validate YYYY-MM-DD format; returns null for absent/invalid params. */
function parseDateParam(s: string | null): string | null {
  if (!s) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

export default function PurchaseOrdersPage() {
  const { t } = useTranslation('procurement');
  const router = useRouter();
  const searchParams = useSearchParams();

  // ADR-331 Phase F — read analytics drill-down URL params (set by buildPurchaseOrdersUrl in chart-utils.ts)
  const analyticsDrill = useMemo<AnalyticsDrillFilters>(
    () => ({
      from: parseDateParam(searchParams.get('from')),
      to: parseDateParam(searchParams.get('to')),
      projectIds: parseFilterArray(searchParams.get('projectId')),
      supplierIds: parseFilterArray(searchParams.get('supplierId')),
      categoryCodes: parseFilterArray(searchParams.get('categoryCode')),
      statuses: parseFilterArray(searchParams.get('status')),
    }),
    [searchParams],
  );

  const { purchaseOrders, actionRequired, loading } = usePurchaseOrders(analyticsDrill);

  const handleViewPO = useCallback(
    (poId: string) => {
      const po: PurchaseOrder | undefined = purchaseOrders.find((p) => p.id === poId);
      if (po) router.push(getPoDetailUrl(po.projectId, po.id));
    },
    [purchaseOrders, router],
  );

  const handleDuplicate = useCallback(
    (poId: string) => {
      const po: PurchaseOrder | undefined = purchaseOrders.find((p) => p.id === poId);
      if (po) router.push(`${getPoDetailUrl(po.projectId, po.id)}?duplicate=1`);
    },
    [purchaseOrders, router],
  );

  return (
    <PageContainer ariaLabel={t('nav.purchaseOrders')}>
      <div className="px-2 mt-2">
        <ProcurementSubNav className="mb-0" />
      </div>
      <div className="p-4">
        <PurchaseOrderList
          purchaseOrders={purchaseOrders}
          actionRequired={actionRequired}
          loading={loading}
          onCreateNew={() => router.push('/procurement/new')}
          onViewPO={handleViewPO}
          onDuplicate={handleDuplicate}
        />
      </div>
    </PageContainer>
  );
}
