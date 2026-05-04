'use client';

import { useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Package } from 'lucide-react';
import { ProcurementSubNav } from '@/subapps/procurement/components/ProcurementSubNav';
import { PurchaseOrderList } from '@/components/procurement/PurchaseOrderList';
import { PurchaseOrderDetail } from '@/components/procurement/PurchaseOrderDetail';
import { usePurchaseOrders } from '@/hooks/procurement/usePurchaseOrders';
import { getPoDetailUrl } from '@/lib/navigation/procurement-urls';
import { PageContainer, ListContainer, DetailsContainer } from '@/core/containers';
import { MobileDetailsSlideIn } from '@/core/layouts';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { parseFilterArray } from '@/lib/url-filters/multi-value';
import { emitSpendAnalyticsInvalidate } from '@/lib/cache/spend-analytics-bus';
import type { PurchaseOrder, AnalyticsDrillFilters } from '@/types/procurement';

/** Validate YYYY-MM-DD format; returns null for absent/invalid params. */
function parseDateParam(s: string | null): string | null {
  if (!s) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

const API_BASE = '/api/procurement';

export default function PurchaseOrdersPage() {
  const { t } = useTranslation('procurement');
  const router = useRouter();
  const searchParams = useSearchParams();

  // ADR-331 Phase F — analytics drill-down URL params (set by buildPurchaseOrdersUrl in chart-utils.ts)
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

  // ── Master-detail: URL-persistent selection ──────────────────────────────
  const selectedPoId = searchParams.get('poId');
  const selectedPO = useMemo(
    () => purchaseOrders.find((p) => p.id === selectedPoId) ?? null,
    [purchaseOrders, selectedPoId],
  );

  const handleSelectPO = useCallback(
    (po: PurchaseOrder) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('poId', po.id);
      router.replace(`/procurement/purchase-orders?${params.toString()}`);
    },
    [router, searchParams],
  );

  const handleDeselectPO = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('poId');
    router.replace(`/procurement/purchase-orders?${params.toString()}`);
  }, [router, searchParams]);

  // ── PO actions ────────────────────────────────────────────────────────────
  const handleAction = useCallback(
    async (poId: string, action: string, body: Record<string, unknown> = {}) => {
      await fetch(`${API_BASE}/${poId}?action=${action}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      emitSpendAnalyticsInvalidate();
    },
    [],
  );

  const handleApprove = useCallback(async () => {
    if (selectedPO) await handleAction(selectedPO.id, 'approve');
  }, [selectedPO, handleAction]);

  const handleMarkOrdered = useCallback(async () => {
    if (selectedPO) await handleAction(selectedPO.id, 'order');
  }, [selectedPO, handleAction]);

  const handleRecordDelivery = useCallback(async () => {
    if (selectedPO) await handleAction(selectedPO.id, 'record-delivery');
  }, [selectedPO, handleAction]);

  const handleCancel = useCallback(async () => {
    if (selectedPO) await handleAction(selectedPO.id, 'cancel');
  }, [selectedPO, handleAction]);

  const handleEditPO = useCallback(
    (poId: string) => {
      const po = purchaseOrders.find((p) => p.id === poId);
      if (po) router.push(getPoDetailUrl(po.projectId, po.id));
    },
    [purchaseOrders, router],
  );

  const handleDuplicate = useCallback(
    async (poId: string) => {
      const res = await fetch(`${API_BASE}/${poId}?action=duplicate`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json() as { success?: boolean; data?: { id?: string } };
      if (json.success && json.data?.id) {
        emitSpendAnalyticsInvalidate();
        const po = purchaseOrders.find((p) => p.id === poId);
        if (po) router.push(getPoDetailUrl(po.projectId, json.data.id));
      }
    },
    [purchaseOrders, router],
  );

  // ── Shared detail panel props ─────────────────────────────────────────────
  const detailProps = useMemo(
    () =>
      selectedPO
        ? {
            po: selectedPO,
            onApprove: handleApprove,
            onMarkOrdered: handleMarkOrdered,
            onRecordDelivery: handleRecordDelivery,
            onClose: handleDeselectPO,
            onCancel: handleCancel,
            onEdit: () => handleEditPO(selectedPO.id),
            onDuplicate: () => handleDuplicate(selectedPO.id),
            onCreateNew: () => router.push('/procurement/new'),
          }
        : null,
    [
      selectedPO,
      handleApprove,
      handleMarkOrdered,
      handleRecordDelivery,
      handleDeselectPO,
      handleCancel,
      handleEditPO,
      handleDuplicate,
      router,
    ],
  );

  const listProps = {
    purchaseOrders,
    actionRequired,
    loading,
    onCreateNew: () => router.push('/procurement/new'),
    onViewPO: handleEditPO,
    onDuplicate: (poId: string) => { void handleDuplicate(poId); },
    onSelectPO: handleSelectPO,
    selectedPOId: selectedPoId ?? undefined,
    onEditPO: handleEditPO,
  };

  return (
    <PageContainer ariaLabel={t('nav.purchaseOrders')}>
      <div className="px-2 mt-2">
        <ProcurementSubNav className="mb-0" />
      </div>

      <ListContainer>
        <>
          {/* ── Desktop: split list + detail ───────────────────────────────── */}
          <section
            className="hidden md:flex flex-1 gap-2 min-h-0 min-w-0 overflow-hidden"
            aria-label={t('nav.purchaseOrders')}
          >
            <PurchaseOrderList {...listProps} />

            {detailProps ? (
              <div className="flex-1 flex flex-col min-h-0 overflow-y-auto bg-card border rounded-lg shadow-sm p-4">
                <PurchaseOrderDetail {...detailProps} />
              </div>
            ) : (
              <DetailsContainer
                emptyStateProps={{
                  icon: Package,
                  title: t('detail.emptyTitle'),
                  description: t('detail.emptyDescription'),
                }}
                onCreateAction={() => router.push('/procurement/new')}
              />
            )}
          </section>

          {/* ── Mobile: list (hidden when PO selected) ─────────────────────── */}
          <section
            className={`md:hidden flex-1 min-h-0 overflow-hidden ${selectedPO ? 'hidden' : 'block'}`}
            aria-label={t('nav.purchaseOrders')}
          >
            <PurchaseOrderList {...listProps} />
          </section>

          {/* ── Mobile: slide-in detail overlay ────────────────────────────── */}
          <MobileDetailsSlideIn
            isOpen={!!selectedPO}
            onClose={handleDeselectPO}
            title={selectedPO?.poNumber ?? ''}
            actionButtons={
              <button
                type="button"
                className="text-xs underline px-2"
                onClick={() => selectedPO && handleEditPO(selectedPO.id)}
              >
                {t('detail.edit')}
              </button>
            }
          >
            {detailProps && <PurchaseOrderDetail {...detailProps} />}
          </MobileDetailsSlideIn>
        </>
      </ListContainer>
    </PageContainer>
  );
}
