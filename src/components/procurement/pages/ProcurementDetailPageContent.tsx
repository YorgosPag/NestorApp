'use client';

/**
 * @module procurement/detail
 * @enterprise ADR-267 §Phase A — Purchase Order Detail / Edit
 * @lazy ADR-294 Batch 3 — Extracted for dynamic import
 */

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/design-system';
import { useTypography } from '@/hooks/useTypography';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { getPoDetailUrl } from '@/lib/navigation/procurement-urls';

const API_BASE = '/api/procurement';
const QUERY_ACTION = 'action';
import { PurchaseOrderDetail } from '@/components/procurement/PurchaseOrderDetail';
import { PurchaseOrderForm } from '@/components/procurement/PurchaseOrderForm';
import type { PurchaseOrder } from '@/types/procurement';

async function fetchPO(poId: string): Promise<PurchaseOrder | null> {
  const res = await fetch(`/api/procurement/${poId}`);
  if (!res.ok) return null;
  const json = await res.json();
  return json.data ?? null;
}

export function ProcurementDetailPageContent() {
  const params = useParams<{ poId?: string; id?: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const typography = useTypography();
  const { t } = useTranslation('procurement');
  // params.id = projectId when rendered inside /projects/[id]/procurement/po/[poId]
  const pathProjectId = params.id;
  // params.poId is undefined on the dedicated /procurement/new page (no [poId] segment)
  const poId = params.poId ?? 'new';
  const isNew = poId === 'new';
  const initialProjectId = isNew
    ? (searchParams.get('projectId') ?? pathProjectId ?? undefined)
    : undefined;
  const [editMode, setEditMode] = useState(isNew);

  const { data: po, loading, refetch } = useAsyncData<PurchaseOrder | null>({
    fetcher: () => (isNew ? Promise.resolve(null) : fetchPO(poId)),
    deps: [poId],
    enabled: !isNew,
  });

  const handleSuccess = useCallback((id: string) => {
    const pid = po?.projectId ?? initialProjectId ?? pathProjectId;
    if (pid) {
      router.push(getPoDetailUrl(pid, id));
    } else {
      router.push('/procurement');
    }
  }, [router, po?.projectId, initialProjectId, pathProjectId]);

  const handleCancel = useCallback(() => {
    if (isNew) {
      router.push('/procurement');
    } else {
      setEditMode(false);
    }
  }, [isNew, router]);

  const handleAction = useCallback(async (action: string, body?: Record<string, unknown>) => {
    const actionParams = new URLSearchParams({ [QUERY_ACTION]: action });
    await fetch([API_BASE, poId].join('/') + '?' + actionParams.toString(), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    });
    await refetch();
  }, [poId, refetch]);

  const handleDuplicate = useCallback(async () => {
    const dupParams = new URLSearchParams({ [QUERY_ACTION]: 'duplicate' });
    const res = await fetch([API_BASE, poId].join('/') + '?' + dupParams.toString(), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const json = await res.json();
    if (json.success && json.data?.id) {
      const pid = po?.projectId ?? pathProjectId;
      if (pid) {
        router.push(getPoDetailUrl(pid, json.data.id));
      } else {
        router.push('/procurement');
      }
    }
  }, [poId, router, po?.projectId, pathProjectId]);

  useEffect(() => {
    if (!isNew) setEditMode(false);
  }, [isNew, poId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (editMode) {
    return (
      <main className="mx-auto max-w-4xl p-4 md:p-6">
        <PurchaseOrderForm
          existingPO={isNew ? undefined : po}
          initialProjectId={initialProjectId}
          onSuccess={handleSuccess}
          onCancel={handleCancel}
        />
      </main>
    );
  }

  if (!po) {
    return (
      <main className="mx-auto max-w-4xl p-4 md:p-6 text-center">
        <p className={cn(typography.body, 'text-muted-foreground')}>
          {t('detail.notFound', 'PO not found')}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl p-4 md:p-6">
      <PurchaseOrderDetail
        po={po}
        onApprove={() => handleAction('approve')}
        onMarkOrdered={() => handleAction('order')}
        onRecordDelivery={() => {/* TODO: open delivery dialog */}}
        onClose={() => handleAction('close')}
        onCancel={() => handleAction('cancel', { reason: 'other' })}
        onEdit={() => setEditMode(true)}
        onDuplicate={handleDuplicate}
      />
    </main>
  );
}

export default ProcurementDetailPageContent;
