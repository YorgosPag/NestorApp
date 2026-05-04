'use client';

/**
 * 🏢 ENTERPRISE VENDOR GRID CARD - Domain Component
 *
 * Domain-specific card for vendors in grid/tile views.
 * Extends GridCard with vendor-specific defaults and supplier metrics stats.
 *
 * @fileoverview Vendor domain card using centralized GridCard.
 * @see GridCard for base component
 * @see VendorListCard for list view equivalent
 */

import React, { useMemo } from 'react';
import { Building2, PackageCheck, DollarSign, TrendingUp, Clock } from 'lucide-react';

import { GridCard } from '@/design-system';
import type { StatItem } from '@/design-system';
import type {
  GridCardBadge,
  GridCardBadgeVariant,
} from '@/design-system/components/GridCard/GridCard.types';

import { getContactDisplayName } from '@/types/contacts';
import { formatCurrency, formatDate } from '@/lib/intl-formatting';
import { useTranslation } from '@/i18n/hooks/useTranslation';

import type { VendorCardData } from './vendor-types';

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
  const { t } = useTranslation('procurement');
  const { contact, metrics } = data;

  const displayName = useMemo(() => getContactDisplayName(contact), [contact]);
  const tradeSpecialties = metrics?.tradeSpecialties ?? [];

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
        iconColor: 'text-blue-600',
        label: t('hub.vendorMaster.totalOrders'),
        value: String(metrics.totalOrders),
      },
      {
        icon: DollarSign,
        iconColor: 'text-green-600',
        label: t('hub.vendorMaster.totalSpend'),
        value: formatCurrency(metrics.totalSpend),
      },
      {
        icon: TrendingUp,
        iconColor: 'text-emerald-600',
        label: t('hub.vendorMaster.onTimeRate'),
        value: `${metrics.onTimeDeliveryRate}%`,
      },
    ];
    if (metrics.lastOrderDate) {
      items.push({
        icon: Clock,
        iconColor: 'text-amber-600',
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
      customIconColor="text-green-600"
      title={displayName}
      subtitle={subtitle}
      badges={badges}
      stats={stats}
      isSelected={isSelected}
      onClick={onSelect}
      compact={compact}
      className={className}
      aria-label={t('hub.vendorMaster.cardAriaLabel', { name: displayName })}
    />
  );
}

VendorGridCard.displayName = 'VendorGridCard';

export default VendorGridCard;
