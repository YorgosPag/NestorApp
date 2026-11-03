'use client';

/**
 * @fileoverview **Η ουρά κατοχής μάρκας** (ADR-923 §16), μέσα στο `/admin/supplier-verifications`.
 * @module components/admin/pages/SupplierBrandClaimsQueue
 *
 * Ο άνθρωπος ανοίγει την απόδειξη και εγκρίνει **μόνο** με ημερομηνία λήξης: χωρίς ημερομηνία το κουμπί μένει κλειστό.
 */

import React from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { formatDate } from '@/lib/intl-formatting';
import type { SupplierBrandListing } from '@/server/catalog/supplier-brand-claim.server';
import { validUntilOfDate } from '@/subapps/catalog/public/supplier-brand-claim-rules';
import type { SupplierBrandClaimRecord, SupplierBrandRelation } from '@/subapps/catalog/types/supplier-brand-claim';

import { openReviewEvidence, ReviewList, ReviewNoteField, ReviewTabs } from './supplier-review-queue';

const NS = 'admin';
const LIST_URL = '/api/admin/supplier-brand-claims';

const RELATION_KEYS: Readonly<Record<SupplierBrandRelation, string>> = {
  manufacturer: 'admin:supplierBrandClaims.relationManufacturer',
  'authorized-representative': 'admin:supplierBrandClaims.relationRepresentative',
};

function useDecision(claimId: string, onDecided: () => void) {
  const [busy, setBusy] = React.useState(false);
  const [refused, setRefused] = React.useState(false);
  const decide = async (decision: 'approve' | 'reject' | 'revoke', note: string, date: string) => {
    setBusy(true);
    setRefused(false);
    try {
      await apiClient.post(LIST_URL, { claimId, decision, note: note.trim() || null, validUntil: validUntilOfDate(date) });
    } catch {
      setRefused(true);
    } finally {
      setBusy(false);
      onDecided();
    }
  };
  return { busy, refused, decide };
}

function ClaimCard({ item, listing, onDecided }: { readonly item: SupplierBrandClaimRecord; readonly listing: SupplierBrandListing; readonly onDecided: () => void }): React.JSX.Element {
  const { t } = useTranslation([NS]);
  const [note, setNote] = React.useState('');
  const [date, setDate] = React.useState('');
  const { busy, refused, decide } = useDecision(item.id, onDecided);
  const dateId = React.useId();
  return (
    <Card asChild className="flex flex-col gap-3 p-4">
      <article>
        <header className="flex items-baseline justify-between gap-3">
          <h3 className="m-0 text-base font-semibold">{item.brandName} · {t(RELATION_KEYS[item.relation])}</h3>
          <time dateTime={item.createdAt} className="text-sm text-muted-foreground">{formatDate(item.createdAt)}</time>
        </header>
        {item.grant !== null && <p className="m-0 text-sm text-muted-foreground">{t('admin:supplierBrandClaims.validUntil')}: {formatDate(item.grant.validUntil)}</p>}
        {refused && <Alert variant="destructive" withIcon><AlertDescription>{t('admin:supplierBrandClaims.refused')}</AlertDescription></Alert>}
        {listing === 'pending-review' && (
          <p className="m-0 flex flex-col gap-1">
            <label htmlFor={dateId} className="text-sm text-muted-foreground">{t('admin:supplierBrandClaims.validUntil')}</label>
            <Input id={dateId} type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </p>
        )}
        <ReviewNoteField value={note} onChange={setNote} />
        <footer className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => void openReviewEvidence(LIST_URL, item.id)}>{t('admin:supplierVerifications.openDocument')}</Button>
          {listing === 'pending-review' && <Button type="button" disabled={busy || date === ''} onClick={() => void decide('approve', note, date)}>{t('admin:supplierVerifications.approve')}</Button>}
          {listing === 'pending-review' && <Button type="button" variant="destructive" disabled={busy} onClick={() => void decide('reject', note, '')}>{t('admin:supplierVerifications.reject')}</Button>}
          {listing === 'approved' && <Button type="button" variant="destructive" disabled={busy} onClick={() => void decide('revoke', note, '')}>{t('admin:supplierVerifications.revoke')}</Button>}
        </footer>
      </article>
    </Card>
  );
}

export function SupplierBrandClaimsQueue(): React.JSX.Element {
  const { t } = useTranslation([NS]);
  return (
    <section className="flex flex-col gap-3">
      <h2 className="m-0 text-xl font-semibold">{t('admin:supplierBrandClaims.title')}</h2>
      <ReviewTabs renderList={(listing) => (
        <ReviewList<SupplierBrandClaimRecord>
          listUrl={LIST_URL}
          listing={listing}
          renderItem={(item, reload) => <ClaimCard key={item.id} item={item} listing={listing} onDecided={reload} />}
        />
      )} />
    </section>
  );
}
