'use client';

/**
 * 📄 ENTERPRISE QUOTE LIST CARD - Domain Component
 *
 * Domain-specific card for vendor quotes in list views; single-line truncated
 * subtitle "Vendor · Total · ValidUntil/Date" + inline status badge, with a
 * version-collapse chevron. Shared vendor/status/date derivation comes from
 * useQuoteCardCommon (ADR-585).
 *
 * @fileoverview Quote domain card using centralized ListCard.
 * @see ListCard for base component
 * @see useQuoteCardCommon for the shared model (ADR-585)
 */

import React, { useMemo } from 'react';
import { ChevronDown, ChevronRight, FileText } from 'lucide-react';

import { ListCard } from '@/design-system';
import type { ListCardBadge, ListCardBadgeVariant } from '@/design-system/components/ListCard/ListCard.types';

import type { Quote } from '@/subapps/procurement/types/quote';
import { formatCurrency } from '@/lib/intl-formatting';
import { expiryBadgeState, daysUntilExpiry, formatValidUntilDate } from '@/subapps/procurement/utils/quote-expiration';

import { useQuoteCardCommon, formatQuoteDate } from './quote-card-model';

export interface QuoteListCardProps {
  quote: Quote;
  isSelected?: boolean;
  onSelect?: () => void;
  className?: string;
  /** Show collapsible chevron when older versions exist */
  hasOlderVersions?: boolean;
  isVersionExpanded?: boolean;
  onVersionToggle?: (e: React.MouseEvent) => void;
}

export function QuoteListCard({
  quote,
  isSelected = false,
  onSelect,
  className,
  hasOlderVersions = false,
  isVersionExpanded = false,
  onVersionToggle,
}: QuoteListCardProps) {
  const { t, vendorName, statusLabel, statusVariant } = useQuoteCardCommon(quote);

  // 🏢 ENTERPRISE: Single-line subtitle "Vendor · Total · ValidUntil/Date"
  const subtitle = useMemo(() => {
    const dateStr = quote.validUntil
      ? formatQuoteDate(quote.validUntil as { seconds: number })
      : formatQuoteDate(quote.createdAt as { seconds: number });
    return [vendorName, formatCurrency(quote.totals.total), dateStr]
      .filter(Boolean)
      .join(' · ');
  }, [vendorName, quote.totals.total, quote.validUntil, quote.createdAt]);

  const versionBadge: ListCardBadge | null = useMemo(() => {
    const v = quote.version ?? 1;
    if (v <= 1) return null;
    return { label: `v${v}`, variant: 'info' as ListCardBadgeVariant };
  }, [quote.version]);

  const expiryBadge: ListCardBadge | null = useMemo(() => {
    const state = expiryBadgeState(quote);
    if (state === 'expired') {
      return {
        label: t('rfqs.expiry.badge.expired', { date: formatValidUntilDate(quote) }),
        variant: 'destructive' as ListCardBadgeVariant,
      };
    }
    if (state === 'expiring_soon') {
      const days = daysUntilExpiry(quote) ?? 0;
      return {
        label: t('rfqs.expiry.badge.expiringSoon', { days }),
        variant: 'warning' as ListCardBadgeVariant,
      };
    }
    return null;
  }, [quote, t]);

  // §5.V.6 — sent badge: shows after vendor is notified of outcome.
  // ⚠️ stale: notified template no longer matches current status.
  const notifiedBadge: ListCardBadge | null = useMemo(() => {
    const lastAt = quote.lastNotifiedAt as { seconds?: number } | null | undefined;
    if (!lastAt) return null;
    const secs = lastAt.seconds;
    if (!secs) return null;
    const date = new Date(secs * 1000).toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit' });
    const expectedTemplate = quote.status === 'accepted' ? 'winner' : 'rejection';
    const stale = quote.lastNotifiedTemplate && quote.lastNotifiedTemplate !== expectedTemplate;
    return {
      label: stale ? t('rfqs.notify.staleBadge') : t('rfqs.notify.sentBadge', { date }),
      variant: (stale ? 'warning' : 'info') as ListCardBadgeVariant,
    };
  }, [quote, t]);

  const badges: ListCardBadge[] = useMemo(
    () => [
      ...(versionBadge ? [versionBadge] : []),
      ...(expiryBadge ? [expiryBadge] : []),
      ...(notifiedBadge ? [notifiedBadge] : []),
      { label: statusLabel, variant: statusVariant },
    ],
    [statusLabel, statusVariant, versionBadge, expiryBadge, notifiedBadge],
  );

  const VersionChevron = isVersionExpanded ? ChevronDown : ChevronRight;

  return (
    <div className="relative">
      <ListCard
        customIcon={FileText}
        customIconColor="text-[hsl(var(--text-warning))]"
        title={quote.displayNumber}
        subtitle={subtitle}
        badges={badges}
        inlineBadges
        isSelected={isSelected}
        onClick={onSelect}
        className={className}
        aria-label={t('list.cardAriaLabel', { number: quote.displayNumber, vendor: vendorName })}
      />
      {hasOlderVersions && onVersionToggle && (
        <button
          type="button"
          onClick={onVersionToggle}
          className="absolute bottom-1 right-2 flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground"
          aria-label={isVersionExpanded
            ? t('rfqs.versioning.collapseButton')
            : t('rfqs.versioning.expandButton')}
        >
          <VersionChevron className="size-3" />
        </button>
      )}
    </div>
  );
}

QuoteListCard.displayName = 'QuoteListCard';

export default QuoteListCard;
