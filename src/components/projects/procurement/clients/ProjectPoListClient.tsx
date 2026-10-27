'use client';

/**
 * @module components/projects/procurement/clients/ProjectPoListClient
 * @enterprise ADR-330 §5.1 S2 — Project-scoped PO list wrapper
 *
 * Wires `usePurchaseOrders` with `setProjectId(projectId)` and renders the
 * existing `PurchaseOrderList`. Detail click → project-scoped URL via
 * `getPoDetailUrl` (S1 SSoT helper).
 *
 * S3.1 — honours the `?status=` drill-down of the overview cards through the
 * existing ADR-331 drill overlay of `usePurchaseOrders` (no second filter path).
 */

import { useEffect, useMemo } from 'react';
import { useRouter } from '@/lib/workspace/navigation';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { usePurchaseOrders } from '@/hooks/procurement/usePurchaseOrders';
import { PurchaseOrderList } from '@/components/procurement/PurchaseOrderList';
import { getPoDetailUrl } from '@/lib/navigation/procurement-urls';
import { PO_STATUS_TRANSITIONS, type AnalyticsDrillFilters } from '@/types/procurement';
import { useStatusDrillParam } from './useStatusDrillParam';
import { StatusDrillNotice } from './StatusDrillNotice';

export interface ProjectPoListClientProps {
  projectId: string;
}

export function ProjectPoListClient({ projectId }: ProjectPoListClientProps) {
  const router = useRouter();
  const { t } = useTranslation('procurement');
  const drill = useStatusDrillParam(PO_STATUS_TRANSITIONS);

  const drillFilters = useMemo<AnalyticsDrillFilters>(
    () => ({ from: null, to: null, projectIds: [], supplierIds: [], categoryCodes: [], statuses: drill.statuses }),
    [drill.statuses],
  );

  const { purchaseOrders, actionRequired, loading, setProjectId } =
    usePurchaseOrders(drillFilters);

  useEffect(() => {
    setProjectId(projectId);
    return () => setProjectId(null);
  }, [projectId, setProjectId]);

  const handleCreate = () => {
    router.push(`/procurement/new?projectId=${projectId}`);
  };

  const handleView = (poId: string) => {
    router.push(getPoDetailUrl(projectId, poId));
  };

  const handleDuplicate = (poId: string) => {
    router.push(`${getPoDetailUrl(projectId, poId)}?duplicate=1`);
  };

  return (
    <>
      <StatusDrillNotice
        labels={drill.statuses.map((s) => t(`status.${s}`))}
        onClear={drill.clear}
      />
      <PurchaseOrderList
        purchaseOrders={purchaseOrders ?? []}
        actionRequired={actionRequired}
        loading={loading}
        onCreateNew={handleCreate}
        onViewPO={handleView}
        onDuplicate={handleDuplicate}
      />
    </>
  );
}
