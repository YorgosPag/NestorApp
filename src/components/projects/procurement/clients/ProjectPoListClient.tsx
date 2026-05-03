'use client';

/**
 * @module components/projects/procurement/clients/ProjectPoListClient
 * @enterprise ADR-330 §5.1 S2 — Project-scoped PO list wrapper
 *
 * Wires `usePurchaseOrders` with `setProjectId(projectId)` and renders the
 * existing `PurchaseOrderList`. Detail click → project-scoped URL via
 * `getPoDetailUrl` (S1 SSoT helper).
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePurchaseOrders } from '@/hooks/procurement/usePurchaseOrders';
import { PurchaseOrderList } from '@/components/procurement/PurchaseOrderList';
import { getPoDetailUrl } from '@/lib/navigation/procurement-urls';

export interface ProjectPoListClientProps {
  projectId: string;
}

export function ProjectPoListClient({ projectId }: ProjectPoListClientProps) {
  const router = useRouter();
  const { purchaseOrders, actionRequired, loading, setProjectId } =
    usePurchaseOrders();

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
    router.push(`/procurement/${poId}?duplicate=1`);
  };

  return (
    <PurchaseOrderList
      purchaseOrders={purchaseOrders ?? []}
      actionRequired={actionRequired}
      loading={loading}
      onCreateNew={handleCreate}
      onViewPO={handleView}
      onDuplicate={handleDuplicate}
    />
  );
}
