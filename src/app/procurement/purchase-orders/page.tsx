'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ProcurementSubNav } from '@/subapps/procurement/components/ProcurementSubNav';
import { PurchaseOrderList } from '@/components/procurement/PurchaseOrderList';
import { usePurchaseOrders } from '@/hooks/procurement/usePurchaseOrders';
import { getPoDetailUrl } from '@/lib/navigation/procurement-urls';
import { PageContainer } from '@/core/containers';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { PurchaseOrder } from '@/types/procurement';

export default function PurchaseOrdersPage() {
  const { t } = useTranslation('procurement');
  const router = useRouter();
  const { purchaseOrders, actionRequired, loading } = usePurchaseOrders();

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
