'use client';

/**
 * 🏢 ENTERPRISE VENDOR LIST CARD - Domain Component
 *
 * List card for vendors; single-line truncated subtitle
 * "Total Orders · Total Spend · On-time" + inline trade badges. Shared
 * display-name/specialties derivation comes from useVendorCardCommon (ADR-585).
 *
 * @fileoverview Vendor domain card using centralized ListCard.
 * @see ListCard for base component
 * @see useVendorCardCommon for the shared model (ADR-585)
 */

import React, { useMemo } from 'react';
import { Building2 } from 'lucide-react';

import { ListCard } from '@/design-system';
import type { ListCardBadge, ListCardBadgeVariant } from '@/design-system/components/ListCard/ListCard.types';

import { formatCurrency } from '@/lib/intl-formatting';

import type { VendorCardData } from './vendor-types';
import { useVendorCardCommon } from './vendor-card-model';

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
  const { t, metrics, displayName, tradeSpecialties, ariaLabel } = useVendorCardCommon(data);

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
      customIconColor="text-[hsl(var(--text-success))]"
      title={displayName}
      subtitle={subtitle}
      badges={badges}
      inlineBadges
      isSelected={isSelected}
      onClick={onSelect}
      className={className}
      aria-label={ariaLabel}
    />
  );
}

VendorListCard.displayName = 'VendorListCard';

export default VendorListCard;
