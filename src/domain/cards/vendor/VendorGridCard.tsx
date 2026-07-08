'use client';

/**
 * 🏢 ENTERPRISE VENDOR GRID CARD - Domain Component
 *
 * Grid card for vendors. Shared display-name/specialties derivation comes from
 * useVendorCardCommon (ADR-585); this wrapper owns the Grid StatItems.
 *
 * @fileoverview Vendor domain card using centralized GridCard.
 * @see GridCard for base component
 * @see VendorListCard for list view equivalent
 * @see useVendorCardCommon for the shared model (ADR-585)
 */

import React, { useMemo } from 'react';
import { Building2, PackageCheck, DollarSign, TrendingUp, Clock } from 'lucide-react';

import { GridCard } from '@/design-system';
import type { StatItem } from '@/design-system';
import type { GridCardBadge, GridCardBadgeVariant } from '@/design-system/components/GridCard/GridCard.types';

import { formatCurrency, formatDate } from '@/lib/intl-formatting';

import type { VendorCardData } from './vendor-types';
import { useVendorCardCommon } from './vendor-card-model';

export interface VendorGridCardProps {
  data: VendorCardData;
  isSelected?: boolean;
  onSelect?: () => void;
  compact?: boolean;
  className?: string;
}

export function VendorGridCard({
  data,
  isSelected = false,
  onSelect,
  compact = false,
  className,
}: VendorGridCardProps) {
  const { t, metrics, displayName, tradeSpecialties, ariaLabel } = useVendorCardCommon(data);

  const subtitle = useMemo(() => {
    if (tradeSpecialties.length === 0) return undefined;
    return tradeSpecialties
      .slice(0, 3)
      .map((code) => t(`trades.${code}`, { defaultValue: '' }) || code)
      .join(' · ');
  }, [tradeSpecialties, t]);

  const stats = useMemo<StatItem[]>(() => {
    if (!metrics) return [];
    const items: StatItem[] = [
      {
        icon: PackageCheck,
        iconColor: 'text-primary',
        label: t('hub.vendorMaster.totalOrders'),
        value: String(metrics.totalOrders),
      },
      {
        icon: DollarSign,
        iconColor: 'text-[hsl(var(--text-success))]',
        label: t('hub.vendorMaster.totalSpend'),
        value: formatCurrency(metrics.totalSpend),
      },
      {
        icon: TrendingUp,
        iconColor: 'text-[hsl(var(--text-success))]',
        label: t('hub.vendorMaster.onTimeRate'),
        value: `${metrics.onTimeDeliveryRate}%`,
      },
    ];
    if (metrics.lastOrderDate) {
      items.push({
        icon: Clock,
        iconColor: 'text-[hsl(var(--text-warning))]',
        label: t('hub.vendorMaster.lastOrder'),
        value: formatDate(metrics.lastOrderDate),
      });
    }
    return items;
  }, [metrics, t]);

  const badges = useMemo<GridCardBadge[]>(() => {
    const isActive = (metrics?.totalOrders ?? 0) > 0;
    return [
      {
        label: t(
          isActive
            ? 'hub.vendorMaster.statusBadge.active'
            : 'hub.vendorMaster.statusBadge.inactive',
        ),
        variant: (isActive ? 'success' : 'secondary') as GridCardBadgeVariant,
      },
    ];
  }, [metrics, t]);

  return (
    <GridCard
      customIcon={Building2}
      customIconColor="text-[hsl(var(--text-success))]"
      title={displayName}
      subtitle={subtitle}
      badges={badges}
      stats={stats}
      isSelected={isSelected}
      onClick={onSelect}
      compact={compact}
      className={className}
      aria-label={ariaLabel}
    />
  );
}

VendorGridCard.displayName = 'VendorGridCard';

export default VendorGridCard;
