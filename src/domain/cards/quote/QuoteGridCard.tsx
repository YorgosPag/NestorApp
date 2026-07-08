'use client';

/**
 * 📄 ENTERPRISE QUOTE GRID CARD - Domain Component
 *
 * Domain-specific card for vendor quotes in grid/tile views. Shared vendor/
 * status/date derivation comes from useQuoteCardCommon (ADR-585); this wrapper
 * owns the Grid-specific StatItems + badge assembly.
 *
 * @fileoverview Quote domain card using centralized GridCard.
 * @see GridCard for base component
 * @see QuoteListCard for list view equivalent
 * @see useQuoteCardCommon for the shared model (ADR-585)
 */

import React, { useMemo } from 'react';
import { FileText, Building2, DollarSign, Calendar } from 'lucide-react';

import { GridCard } from '@/design-system';
import type { StatItem } from '@/design-system';
import type { GridCardBadge, GridCardBadgeVariant } from '@/design-system/components/GridCard/GridCard.types';

import type { Quote } from '@/subapps/procurement/types/quote';
import { formatCurrency } from '@/lib/intl-formatting';
import {
  expiryBadgeState,
  daysUntilExpiry,
  formatValidUntilDate,
} from '@/subapps/procurement/utils/quote-expiration';

import { useQuoteCardCommon, formatQuoteDate } from './quote-card-model';

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
  const { t, vendorName, statusLabel, statusVariant } = useQuoteCardCommon(quote);

  const stats = useMemo<StatItem[]>(() => {
    const items: StatItem[] = [
      {
        icon: Building2,
        iconColor: 'text-[hsl(var(--text-success))]',
        label: t('list.vendorLabel'),
        value: vendorName,
      },
      {
        icon: DollarSign,
        iconColor: 'text-[hsl(var(--text-success))]',
        label: t('list.totalLabel'),
        value: formatCurrency(quote.totals.total),
      },
      {
        icon: Calendar,
        iconColor: 'text-primary',
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
    result.push({ label: statusLabel, variant: statusVariant });
    return result;
  }, [quote, statusLabel, statusVariant, t]);

  return (
    <GridCard
      customIcon={FileText}
      customIconColor="text-[hsl(var(--text-warning))]"
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
