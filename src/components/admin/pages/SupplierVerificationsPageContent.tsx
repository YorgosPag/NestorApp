'use client';

/**
 * @fileoverview **Η ουρά ελέγχου προμηθευτών** (ADR-923 §5.13 Ε1α) — `/admin/supplier-verifications`.
 * @module components/admin/pages/SupplierVerificationsPageContent
 *
 * Ο άνθρωπος ανοίγει το έγγραφο (σύνδεσμος με ίχνος), συγκρίνει και αποφασίζει. Κλεισμένη εταιρεία ή στοιχεία που
 * άλλαξαν μετά την αίτηση: χωρίς κουμπί έγκρισης. Το ΑΦΜ δεν φτάνει ποτέ εδώ. Δεύτερη καρτέλα: ανάκληση.
 */

import React from 'react';
import { ShieldCheck } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { formatDate } from '@/lib/intl-formatting';
import type { SupplierReviewItem, SupplierReviewListing } from '@/server/catalog/supplier-review.server';

import { openReviewEvidence, ReviewList, ReviewNoteField, ReviewTabs } from './supplier-review-queue';
import { SupplierBrandClaimsQueue } from './SupplierBrandClaimsQueue';

const NS = 'admin';
const LIST_URL = '/api/admin/supplier-verifications';

type Decision = 'approve' | 'reject' | 'revoke';

function useDecision(companyId: string, onDecided: () => void) {
  const [busy, setBusy] = React.useState(false);
  const [refused, setRefused] = React.useState(false);
  const decide = async (decision: Decision, note: string) => {
    setBusy(true);
    setRefused(false);
    try {
      await apiClient.post(LIST_URL, { companyId, decision, note: note.trim() || null });
      onDecided();
    } catch {
      setRefused(true);
      onDecided();
    } finally {
      setBusy(false);
    }
  };
  return { busy, refused, decide };
}

interface ReviewCardProps {
  readonly item: SupplierReviewItem;
  readonly listing: SupplierReviewListing;
  readonly onDecided: () => void;
}

function ReviewCard({ item, listing, onDecided }: ReviewCardProps): React.ReactElement {
  const { t } = useTranslation([NS]);
  const [note, setNote] = React.useState('');
  const { busy, refused, decide } = useDecision(item.companyId, onDecided);

  return (
    <Card asChild className="flex flex-col gap-3 p-4">
      <article>
        <header className="flex items-baseline justify-between gap-3">
          <h2 className="m-0 text-base font-semibold">{item.legalName ?? t('admin:supplierVerifications.unnamed')}</h2>
          <time dateTime={item.createdAt} className="text-sm text-muted-foreground">{formatDate(item.createdAt)}</time>
        </header>
        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">{t('admin:supplierVerifications.gemiNumber')}</dt>
          <dd className="m-0 text-foreground">{item.gemiNumber ?? t('admin:supplierVerifications.noGemiNumber')}</dd>
        </dl>
        {listing === 'pending-review' && !item.approvable && (
          <Alert withIcon><AlertDescription>{t('admin:supplierVerifications.notApprovable')}</AlertDescription></Alert>
        )}
        {refused && (
          <Alert variant="destructive" withIcon><AlertDescription>{t('admin:supplierVerifications.refused')}</AlertDescription></Alert>
        )}
        <ReviewNoteField value={note} onChange={setNote} />
        <footer className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => void openReviewEvidence(LIST_URL, item.companyId)}>{t('admin:supplierVerifications.openDocument')}</Button>
          {listing === 'pending-review' && item.approvable && (
            <Button type="button" disabled={busy} onClick={() => void decide('approve', note)}>{t('admin:supplierVerifications.approve')}</Button>
          )}
          {listing === 'pending-review' && (
            <Button type="button" variant="destructive" disabled={busy} onClick={() => void decide('reject', note)}>{t('admin:supplierVerifications.reject')}</Button>
          )}
          {listing === 'approved' && (
            <Button type="button" variant="destructive" disabled={busy} onClick={() => void decide('revoke', note)}>{t('admin:supplierVerifications.revoke')}</Button>
          )}
        </footer>
      </article>
    </Card>
  );
}

export function SupplierVerificationsPageContent(): React.ReactElement {
  const { t } = useTranslation([NS]);
  return (
    <main className="container mx-auto flex max-w-4xl flex-col gap-4 px-4 py-8">
      <header className="flex flex-col gap-2">
        <h1 className="m-0 flex items-center gap-3 text-2xl font-bold">
          <ShieldCheck aria-hidden="true" className="h-6 w-6" />
          {t('admin:supplierVerifications.title')}
        </h1>
        <p className="m-0 text-sm text-muted-foreground">{t('admin:supplierVerifications.description')}</p>
      </header>
      <ReviewTabs renderList={(listing) => (
        <ReviewList<SupplierReviewItem>
          listUrl={LIST_URL}
          listing={listing}
          renderItem={(item, reload) => <ReviewCard key={item.companyId} item={item} listing={listing} onDecided={reload} />}
        />
      )} />
      <SupplierBrandClaimsQueue />
    </main>
  );
}
