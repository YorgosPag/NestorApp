'use client';

/**
 * Purchase Order Detail / Edit Page
 *
 * Shows PO detail view with status actions.
 * "new" as poId shows the create form.
 *
 * @see ADR-267 §Phase A
 */

import { useParams, useRouter } from 'next/navigation';
import { useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/design-system';
import { useTypography } from '@/hooks/useTypography';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useTranslation } from '@/i18n/hooks/useTranslation';

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

export default function PurchaseOrderPage() {
  const params = useParams<{ poId: string }>();
  const router = useRouter();
  const typography = useTypography();
  const { t } = useTranslation('procurement');
  const poId = params.poId;
  const isNew = poId === 'new';
  const [editMode, setEditMode] = useState(isNew);

  const { data: po, loading, refetch } = useAsyncData<PurchaseOrder | null>({
    fetcher: () => (isNew ? Promise.resolve(null) : fetchPO(poId)),
    deps: [poId],
    enabled: !isNew,
  });

  const handleSuccess = useCallback((id: string) => {
    router.push(`/procurement/${id}`);
  }, [router]);

  const handleCancel = useCallback(() => {
    if (isNew) {
      router.push('/procurement');
    } else {
      setEditMode(false);
    }
  }, [isNew, router]);

  const handleAction = useCallback(async (action: string, body?: Record<string, unknown>) => {
    const params = new URLSearchParams({ [QUERY_ACTION]: action });
    await fetch([API_BASE, poId].join('/') + '?' + params.toString(), {
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
      router.push(['/procurement', json.data.id].join('/'));
    }
  }, [poId, router]);

  // Reset edit mode when navigating to existing PO
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

  // Create or Edit form
  if (editMode) {
    return (
      <main className="mx-auto max-w-4xl p-4 md:p-6">
        <PurchaseOrderForm
          existingPO={isNew ? undefined : po}
          onSuccess={handleSuccess}
          onCancel={handleCancel}
        />
      </main>
    );
  }

  // Detail view
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
