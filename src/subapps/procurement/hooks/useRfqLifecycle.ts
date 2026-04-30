'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import type { RFQ, RfqCancellationReason } from '@/subapps/procurement/types/rfq';

interface UseRfqLifecycleParams {
  rfqId: string;
  rfq: RFQ | null;
  t: (key: string, opts?: Record<string, unknown>) => string;
  onChanged: () => Promise<void>;
  onArchived: () => void;
}

interface CancelPayload {
  reason: RfqCancellationReason | null;
  detail: string | null;
  notifyVendors: boolean;
}

export function useRfqLifecycle({
  rfqId,
  rfq,
  t,
  onChanged,
  onArchived,
}: UseRfqLifecycleParams) {
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  const handleClose = useCallback(async () => {
    if (!rfq) return;
    if (!window.confirm(t('rfqs.detail.confirm.close'))) return;
    const res = await fetch(`/api/rfqs/${rfqId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'closed' }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      toast.error(json?.error ?? t('rfqs.detail.errors.closeFailed'));
      return;
    }
    toast.success(t('rfqs.detail.toast.closed'));
    await onChanged();
  }, [rfq, rfqId, onChanged, t]);

  const handleArchive = useCallback(async () => {
    if (!rfq) return;
    if (!window.confirm(t('rfqs.detail.confirm.archive'))) return;
    const res = await fetch(`/api/rfqs/${rfqId}`, { method: 'DELETE' });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      toast.error(json?.error ?? t('rfqs.detail.errors.archiveFailed'));
      return;
    }
    toast.success(t('rfqs.detail.toast.archived'));
    onArchived();
  }, [rfq, rfqId, onArchived, t]);

  const handleReopen = useCallback(async () => {
    if (!rfq) return;
    if (!window.confirm(t('rfqs.detail.confirm.reopen'))) return;
    const res = await fetch(`/api/rfqs/${rfqId}/reopen`, { method: 'POST' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (json?.code === 'PO_EXISTS') {
        toast.error(t('rfqs.detail.errors.reopenBlockedByPo'));
      } else {
        toast.error(json?.error ?? t('rfqs.detail.errors.reopenFailed'));
      }
      return;
    }
    toast.success(t('rfqs.detail.toast.reopened'));
    await onChanged();
  }, [rfq, rfqId, onChanged, t]);

  const handleConfirmCancel = useCallback(async (payload: CancelPayload) => {
    const res = await fetch(`/api/rfqs/${rfqId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      toast.error(json?.error ?? t('rfqs.detail.errors.cancelFailed'));
      return;
    }
    toast.success(t('rfqs.detail.toast.cancelled'));
    setCancelDialogOpen(false);
    await onChanged();
  }, [rfqId, onChanged, t]);

  const openCancelDialog = useCallback(() => setCancelDialogOpen(true), []);
  const closeCancelDialog = useCallback(() => setCancelDialogOpen(false), []);

  return {
    cancelDialogOpen,
    openCancelDialog,
    closeCancelDialog,
    handleClose,
    handleArchive,
    handleReopen,
    handleConfirmCancel,
  };
}
