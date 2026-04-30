'use client';

/**
 * 📄 ENTERPRISE QUOTE LIST CARD - Domain Component
 *
 * Domain-specific card for vendor quotes in list views.
 * Extends ListCard with Quote-specific defaults; single-line truncated subtitle
 * "Vendor · Total · ValidUntil/Date" + inline status badge next to displayNumber.
 *
 * @fileoverview Quote domain card using centralized ListCard.
 * @enterprise Fortune 500 compliant - ZERO hardcoded values
 * @see ListCard for base component
 * @see QUOTE_STATUS_META for status metadata
 * @see PurchaseOrderListCard for sibling pattern
 */

import React, { useMemo } from 'react';
import { ChevronDown, ChevronRight, FileText } from 'lucide-react';

// 🏢 DESIGN SYSTEM
import { ListCard } from '@/design-system';
import type { ListCardBadge, ListCardBadgeVariant } from '@/design-system/components/ListCard/ListCard.types';

// 🏢 DOMAIN TYPES
import type { Quote, QuoteStatus } from '@/subapps/procurement/types/quote';
import { QUOTE_STATUS_META } from '@/subapps/procurement/types/quote';

// 🏢 SHARED HOOKS / FORMATTERS
import { useContactById } from '@/hooks/useContactById';
import { getContactDisplayName } from '@/types/contacts/helpers';
import { formatCurrency } from '@/lib/intl-formatting';

// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { expiryBadgeState, daysUntilExpiry, formatValidUntilDate } from '@/subapps/procurement/utils/quote-expiration';

// =============================================================================
// 🏢 TYPES
// =============================================================================

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

// =============================================================================
// 🏢 STATUS COLOR → BADGE VARIANT MAPPING
// =============================================================================

const STATUS_BADGE_VARIANTS: Record<QuoteStatus, ListCardBadgeVariant> = {
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

// =============================================================================
// 🏢 HELPERS
// =============================================================================

function formatQuoteDate(ts: { seconds: number } | null | undefined): string {
  if (!ts?.seconds) return '—';
  return new Date(ts.seconds * 1000).toLocaleDateString('el-GR');
}

// =============================================================================
// 🏢 COMPONENT
// =============================================================================

export function QuoteListCard({
  quote,
  isSelected = false,
  onSelect,
  className,
  hasOlderVersions = false,
  isVersionExpanded = false,
  onVersionToggle,
}: QuoteListCardProps) {
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

  const badges: ListCardBadge[] = useMemo(
    () => [
      ...(versionBadge ? [versionBadge] : []),
      ...(expiryBadge ? [expiryBadge] : []),
      { label: statusLabel, variant: STATUS_BADGE_VARIANTS[quote.status] },
    ],
    [statusLabel, quote.status, versionBadge, expiryBadge],
  );

  const VersionChevron = isVersionExpanded ? ChevronDown : ChevronRight;

  return (
    <div className="relative">
      <ListCard
        customIcon={FileText}
        customIconColor="text-amber-600"
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
