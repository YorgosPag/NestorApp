'use client';

/**
 * @fileoverview **Τα κοινά της ουράς ελέγχου**: επιβεβαίωση επιχείρησης και κατοχή μάρκας (ADR-923 §5.13 Ε1α · §16).
 * @module components/admin/pages/supplier-review-queue
 *
 * Ίδια ροή, ίδιες λέξεις: φόρτωση, απόδειξη με ίχνος, σημείωση, δύο καρτέλες. Η κάθε ουρά δίνει μόνο την κάρτα της.
 */

import React from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { apiClient } from '@/lib/api/enterprise-api-client';

const NS = 'admin';

export type ReviewListing = 'pending-review' | 'approved';

export type ReviewQueueState<T> =
  | { readonly state: 'loading' }
  | { readonly state: 'failed' }
  | { readonly state: 'ready'; readonly items: ReadonlyArray<T> };

export function useReviewQueue<T>(listUrl: string, status: ReviewListing): { readonly queue: ReviewQueueState<T>; readonly reload: () => void } {
  const [queue, setQueue] = React.useState<ReviewQueueState<T>>({ state: 'loading' });
  const reload = React.useCallback(() => {
    apiClient
      .get<{ items: T[] }>(`${listUrl}?status=${status}`)
      .then((body) => setQueue({ state: 'ready', items: body.items }))
      .catch(() => setQueue({ state: 'failed' }));
  }, [listUrl, status]);
  React.useEffect(reload, [reload]);
  return { queue, reload };
}

export async function openReviewEvidence(listUrl: string, id: string): Promise<void> {
  const body = await apiClient.get<{ url: string }>(`${listUrl}/${encodeURIComponent(id)}/evidence`);
  window.open(body.url, '_blank', 'noopener,noreferrer');
}

export function ReviewNoteField({ value, onChange }: { readonly value: string; readonly onChange: (note: string) => void }): React.ReactElement {
  const { t } = useTranslation([NS]);
  const noteId = React.useId();
  return (
    <>
      <label htmlFor={noteId} className="text-sm text-muted-foreground">{t('admin:supplierVerifications.note')}</label>
      <Textarea id={noteId} value={value} onChange={(event) => onChange(event.target.value)} size="sm" rows={2} />
    </>
  );
}

interface ReviewListProps<T> {
  readonly listUrl: string;
  readonly listing: ReviewListing;
  readonly renderItem: (item: T, reload: () => void) => React.ReactNode;
}

export function ReviewList<T>({ listUrl, listing, renderItem }: ReviewListProps<T>): React.ReactElement {
  const { t } = useTranslation([NS]);
  const { queue, reload } = useReviewQueue<T>(listUrl, listing);
  return (
    <section className="flex flex-col gap-4">
      {queue.state === 'loading' && <p className="m-0 text-sm text-muted-foreground">{t('admin:supplierVerifications.loading')}</p>}
      {queue.state === 'failed' && (
        <Alert variant="destructive" withIcon><AlertDescription>{t('admin:supplierVerifications.failed')}</AlertDescription></Alert>
      )}
      {queue.state === 'ready' && queue.items.length === 0 && (
        <p className="m-0 text-sm text-muted-foreground">{t('admin:supplierVerifications.empty')}</p>
      )}
      {queue.state === 'ready' && queue.items.map((item) => renderItem(item, reload))}
    </section>
  );
}

export function ReviewTabs({ renderList }: { readonly renderList: (listing: ReviewListing) => React.ReactNode }): React.ReactElement {
  const { t } = useTranslation([NS]);
  return (
    <Tabs defaultValue="pending" className="flex flex-col gap-4">
      <TabsList>
        <TabsTrigger value="pending">{t('admin:supplierVerifications.tabPending')}</TabsTrigger>
        <TabsTrigger value="approved">{t('admin:supplierVerifications.tabApproved')}</TabsTrigger>
      </TabsList>
      <TabsContent value="pending">{renderList('pending-review')}</TabsContent>
      <TabsContent value="approved">{renderList('approved')}</TabsContent>
    </Tabs>
  );
}
