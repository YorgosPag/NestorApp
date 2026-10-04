'use client';

/**
 * @fileoverview Τα κοινά μέρη των καρτών της ουράς επαληθεύσεων κατοχής (ADR-900 §3.8 · §8 #2 Β3) — **ένα** σημείο
 * για την κεφαλίδα του δικαιούχου και τον ΚΑΕΚ, ώστε η κάρτα εκκρεμούς και η κάρτα ανάκλησης να λένε το ίδιο.
 * @module components/admin/pages/OwnershipClaimParts
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { OwnershipReviewItem } from '@/services/ownership/ownership-verification-review.service';

/** Ονοματεπώνυμο λογαριασμού · 3 τελευταία ψηφία ΑΦΜ — ποτέ ολόκληρος ο ΑΦΜ. */
export function ClaimantHeader({ item, level: Heading, aside }: {
  readonly item: Pick<OwnershipReviewItem, 'claimantName' | 'claimantTaxIdLast3'>;
  readonly level: 'h2' | 'h3';
  readonly aside: React.ReactNode;
}): React.ReactElement {
  return (
    <header className="flex flex-wrap items-baseline justify-between gap-2">
      <Heading className="m-0 text-base font-semibold text-foreground">{item.claimantName} · …{item.claimantTaxIdLast3}</Heading>
      {aside}
    </header>
  );
}

/** Ο ΚΑΕΚ ως ζεύγος όρου/τιμής — μέσα σε `<dl>` του καλούντος. */
export function KaekTerm({ kaek }: { readonly kaek: string | null }): React.ReactElement {
  const { t } = useTranslation(['admin']);
  return (
    <>
      <dt className="text-muted-foreground">{t('admin:ownershipVerifications.kaek')}</dt>
      <dd className="m-0 text-foreground">{kaek ?? t('admin:ownershipVerifications.unread')}</dd>
    </>
  );
}
