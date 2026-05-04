'use client';

/**
 * 📄 ENTERPRISE QUOTE GRID CARD - Domain Component
 *
 * Domain-specific card for vendor quotes in grid/tile views.
 * Extends GridCard with quote-specific defaults: vendor, total, validity, version.
 *
 * @fileoverview Quote domain card using centralized GridCard.
 * @see GridCard for base component
 * @see QuoteListCard for list view equivalent
 * @see QUOTE_STATUS_META for status metadata
 */

import React, { useMemo } from 'react';
import { FileText, Building2, DollarSign, Calendar } from 'lucide-react';

import { GridCard } from '@/design-system';
import type { StatItem } from '@/design-system';
import type {
  GridCardBadge,
  GridCardBadgeVariant,
} from '@/design-system/components/GridCard/GridCard.types';

import type { Quote, QuoteStatus } from '@/subapps/procurement/types/quote';
import { QUOTE_STATUS_META } from '@/subapps/procurement/types/quote';

import { useContactById } from '@/hooks/useContactById';
import { getContactDisplayName } from '@/types/contacts/helpers';
import { formatCurrency } from '@/lib/intl-formatting';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  expiryBadgeState,
  daysUntilExpiry,
  formatValidUntilDate,
} from '@/subapps/procurement/utils/quote-expiration';

const STATUS_BADGE_VARIANTS: Record<QuoteStatus, GridCardBadgeVariant> = {
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

function formatQuoteDate(ts: { seconds: number } | null | undefined): string {
  if (!ts?.seconds) return '—';
  return new Date(ts.seconds * 1000).toLocaleDateString('el-GR');
}

export interface QuoteGridCardProps {
  quote: Quote;
  isSelected?: boolean;
  onSelect?: () => void;
  compact?: boolean;
  className?: string;
}

export function QuoteGridCard({
  quote,
  isSelected = false,
  onSelect,
  compact = false,
  className,
}: QuoteGridCardProps) {
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

  const stats = useMemo<StatItem[]>(() => {
    const items: StatItem[] = [
      {
        icon: Building2,
        iconColor: 'text-green-600',
        label: t('list.vendorLabel'),
        value: vendorName,
      },
      {
        icon: DollarSign,
        iconColor: 'text-emerald-600',
        label: t('list.totalLabel'),
        value: formatCurrency(quote.totals.total),
      },
      {
        icon: Calendar,
        iconColor: 'text-blue-600',
        label: quote.validUntil ? t('list.validUntilLabel') : t('list.dateLabel'),
        value: quote.validUntil
          ? formatQuoteDate(quote.validUntil as { seconds: number })
          : formatQuoteDate(quote.createdAt as { seconds: number }),
      },
    ];
    return items;
  }, [vendorName, quote.totals.total, quote.validUntil, quote.createdAt, t]);

  const badges = useMemo<GridCardBadge[]>(() => {
    const result: GridCardBadge[] = [];
    const v = quote.version ?? 1;
    if (v > 1) {
      result.push({ label: `v${v}`, variant: 'info' as GridCardBadgeVariant });
    }
    const state = expiryBadgeState(quote);
    if (state === 'expired') {
      result.push({
        label: t('rfqs.expiry.badge.expired', { date: formatValidUntilDate(quote) }),
        variant: 'destructive' as GridCardBadgeVariant,
      });
    } else if (state === 'expiring_soon') {
      const days = daysUntilExpiry(quote) ?? 0;
      result.push({
        label: t('rfqs.expiry.badge.expiringSoon', { days }),
        variant: 'warning' as GridCardBadgeVariant,
      });
    }
    result.push({ label: statusLabel, variant: STATUS_BADGE_VARIANTS[quote.status] });
    return result;
  }, [quote, statusLabel, t]);

  return (
    <GridCard
      customIcon={FileText}
      customIconColor="text-amber-600"
      title={quote.displayNumber}
      subtitle={vendorName}
      badges={badges}
      stats={stats}
      isSelected={isSelected}
      onClick={onSelect}
      compact={compact}
      className={className}
      aria-label={t('list.cardAriaLabel', {
        number: quote.displayNumber,
        vendor: vendorName,
      })}
    />
  );
}

QuoteGridCard.displayName = 'QuoteGridCard';

export default QuoteGridCard;
