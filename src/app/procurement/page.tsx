'use client';

/**
 * Procurement Dashboard / List Page
 *
 * Top-level page showing KPIs + PO list with filters.
 *
 * @see ADR-267 §Phase A
 */

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

const API_PROCUREMENT = '/api/procurement';
const ACTION_KEY = 'action';
const DUPLICATE_VALUE = 'duplicate';
import { cn } from '@/lib/design-system';
import { useTypography } from '@/hooks/useTypography';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { usePurchaseOrders } from '@/hooks/procurement';
import { PurchaseOrderKPIs } from '@/components/procurement/PurchaseOrderKPIs';
import { PurchaseOrderList } from '@/components/procurement/PurchaseOrderList';

export default function ProcurementPage() {
  const { t } = useTranslation('procurement');
  const typography = useTypography();
  const router = useRouter();

  const {
    purchaseOrders,
    actionRequired,
    loading,
    filters,
    setSearch,
    refetch,
  } = usePurchaseOrders();

  const handleCreateNew = useCallback(() => {
    router.push(['/procurement', 'new'].join('/'));
  }, [router]);

  const handleViewPO = useCallback((poId: string) => {
    router.push(['/procurement', poId].join('/'));
  }, [router]);

  const handleDuplicate = useCallback(async (poId: string) => {
    const qs = new URLSearchParams({ [ACTION_KEY]: DUPLICATE_VALUE });
    const url = [API_PROCUREMENT, poId].join('/') + '?' + qs.toString();
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const json = await res.json();
    if (json.success && json.data?.id) {
      router.push(`/procurement/${json.data.id}`);
    }
    await refetch();
  }, [router, refetch]);

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <header>
        <h1 className={cn(typography.heading.h1)}>
          {t('list.createPO', 'Προμήθειες')}
        </h1>
      </header>

      <PurchaseOrderKPIs purchaseOrders={purchaseOrders} />

      <PurchaseOrderList
        purchaseOrders={purchaseOrders}
        actionRequired={actionRequired}
        loading={loading}
        searchValue={filters.search}
        onSearchChange={setSearch}
        onCreateNew={handleCreateNew}
        onViewPO={handleViewPO}
        onDuplicate={handleDuplicate}
      />
    </main>
  );
}
