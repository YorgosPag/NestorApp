'use client';

/**
 * 🏢 ENTERPRISE VENDOR LIST CARD - Domain Component
 *
 * Domain-specific card for vendors (suppliers) in list views.
 * Extends ListCard with vendor-specific defaults; single-line truncated subtitle
 * "Specialties · Total Orders · Total Spend" + inline trade badges.
 *
 * @fileoverview Vendor domain card using centralized ListCard.
 * @enterprise Fortune 500 compliant - ZERO hardcoded values
 * @see ListCard for base component
 * @see VendorCardData for payload type
 */

import React, { useMemo } from 'react';
import { Building2 } from 'lucide-react';

import { ListCard } from '@/design-system';
import type {
  ListCardBadge,
  ListCardBadgeVariant,
} from '@/design-system/components/ListCard/ListCard.types';

import { getContactDisplayName } from '@/types/contacts';
import { formatCurrency } from '@/lib/intl-formatting';
import { useTranslation } from '@/i18n/hooks/useTranslation';

import type { VendorCardData } from './vendor-types';

export interface VendorListCardProps {
  data: VendorCardData;
  isSelected?: boolean;
  onSelect?: () => void;
  className?: string;
}

export function VendorListCard({
  data,
  isSelected = false,
  onSelect,
  className,
}: VendorListCardProps) {
  const { t } = useTranslation('procurement');
  const { contact, metrics } = data;

  const displayName = useMemo(() => getContactDisplayName(contact), [contact]);
  const tradeSpecialties = metrics?.tradeSpecialties ?? [];

  const badges: ListCardBadge[] = useMemo(() => {
    const result: ListCardBadge[] = [];
    tradeSpecialties.slice(0, 2).forEach((code) => {
      const label = t(`trades.${code}`, { defaultValue: '' }) || code;
      result.push({ label, variant: 'outline' as ListCardBadgeVariant });
    });
    if (tradeSpecialties.length > 2) {
      result.push({
        label: `+${tradeSpecialties.length - 2}`,
        variant: 'secondary' as ListCardBadgeVariant,
      });
    }
    return result;
  }, [tradeSpecialties, t]);

  const subtitle = useMemo(() => {
    if (!metrics || metrics.totalOrders === 0) {
      return t('hub.vendorMaster.noOrders');
    }
    return [
      `${metrics.totalOrders} ${t('hub.vendorMaster.totalOrders')}`,
      formatCurrency(metrics.totalSpend),
      `${metrics.onTimeDeliveryRate}% ${t('hub.vendorMaster.onTimeRate')}`,
    ].join(' · ');
  }, [metrics, t]);

  return (
    <ListCard
      customIcon={Building2}
      customIconColor="text-green-600"
      title={displayName}
      subtitle={subtitle}
      badges={badges}
      inlineBadges
      isSelected={isSelected}
      onClick={onSelect}
      className={className}
      aria-label={t('hub.vendorMaster.cardAriaLabel', { name: displayName })}
    />
  );
}

VendorListCard.displayName = 'VendorListCard';

export default VendorListCard;
