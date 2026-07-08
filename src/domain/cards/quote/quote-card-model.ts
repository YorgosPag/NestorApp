'use client';

/**
 * 📄 QUOTE CARD — Shared Model (ADR-585)
 *
 * Shared derived data for QuoteGridCard + QuoteListCard. The two views present
 * differently (Grid = StatItems, List = single-line subtitle + inline badges),
 * so they do NOT share a shell — only this vendor/status/date computation, which
 * was previously duplicated (the `formatQuoteDate` helper + `STATUS_BADGE_VARIANTS`
 * map + vendorName/statusLabel derivation).
 *
 * @see ADR-585 Domain card view-model hook SSoT
 */

import { useMemo } from 'react';

import type { GridCardBadgeVariant } from '@/design-system/components/GridCard/GridCard.types';
import { useContactById } from '@/hooks/useContactById';
import { getContactDisplayName } from '@/types/contacts/helpers';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { Quote, QuoteStatus } from '@/subapps/procurement/types/quote';
import { QUOTE_STATUS_META } from '@/subapps/procurement/types/quote';

/** Status → badge variant (GridCardBadgeVariant ⊂ ListCardBadgeVariant → both shells). */
export const QUOTE_STATUS_BADGE_VARIANTS: Record<QuoteStatus, GridCardBadgeVariant> = {
  draft: 'secondary',
  sent_to_vendor: 'info',
  submitted: 'warning',
  under_review: 'warning',
  accepted: 'success',
  rejected: 'destructive',
  expired: 'destructive',
  archived: 'secondary',
  superseded: 'secondary',
};

/** Format a Firestore-ish `{ seconds }` timestamp as an el-GR date, or em-dash. */
export function formatQuoteDate(ts: { seconds: number } | null | undefined): string {
  if (!ts?.seconds) return '—';
  return new Date(ts.seconds * 1000).toLocaleDateString('el-GR');
}

/**
 * Resolve the shared vendor name, localized status label + badge variant, and
 * the `t` function, for a quote. Consumed by both Quote card views.
 */
export function useQuoteCardCommon(quote: Quote) {
  const { t, i18n } = useTranslation(['quotes']);
  const contact = useContactById(quote.vendorContactId);

  const vendorName = useMemo(() => {
    const extracted = quote.extractedData?.vendorName?.value;
    if (extracted) return extracted;
    if (contact) return getContactDisplayName(contact);
    return quote.vendorContactId;
  }, [quote.extractedData, contact, quote.vendorContactId]);

  const statusMeta = QUOTE_STATUS_META[quote.status];
  const lang = (i18n.language?.startsWith('en') ? 'en' : 'el') as 'el' | 'en';
  const statusLabel = lang === 'en' ? statusMeta.labelEn : statusMeta.labelEl;

  return {
    t,
    vendorName,
    statusLabel,
    statusVariant: QUOTE_STATUS_BADGE_VARIANTS[quote.status],
  };
}
