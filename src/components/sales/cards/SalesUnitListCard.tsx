'use client';

/**
 * @fileoverview Sales Unit List Card — ADR-197
 * @description Domain card for units in sales context — extends ListCard molecule
 * @pattern Same as UnitListCard but with commercial data prominent
 */

import React, { useMemo } from 'react';
import {
  DollarSign,
  Calendar,
  Calculator,
  User,
  CreditCard,
} from 'lucide-react';
import { ListCard } from '@/design-system/components/ListCard/ListCard';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { Unit, CommercialStatus } from '@/types/unit';

// =============================================================================
// 🏢 TYPES
// =============================================================================

interface SalesUnitListCardProps {
  unit: Unit;
  isSelected?: boolean;
  onSelect?: (unitId: string) => void;
  compact?: boolean;
  className?: string;
}

// =============================================================================
// 🏢 COMMERCIAL STATUS → BADGE VARIANT MAPPING (ADR-197 §2.6)
// =============================================================================

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info';

const COMMERCIAL_STATUS_BADGE: Record<CommercialStatus, { variant: BadgeVariant; labelKey: string }> = {
  'unavailable':        { variant: 'default',     labelKey: 'sales.commercialStatus.unavailable' },
  'for-sale':           { variant: 'success',     labelKey: 'sales.commercialStatus.forSale' },
  'for-rent':           { variant: 'warning',     labelKey: 'sales.commercialStatus.forRent' },
  'for-sale-and-rent':  { variant: 'info',        labelKey: 'sales.commercialStatus.forSaleAndRent' },
  'reserved':           { variant: 'secondary',   labelKey: 'sales.commercialStatus.reserved' },
  'sold':               { variant: 'destructive', labelKey: 'sales.commercialStatus.sold' },
  'rented':             { variant: 'default',     labelKey: 'sales.commercialStatus.rented' },
};

// =============================================================================
// 🏢 HELPERS
// =============================================================================

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('el-GR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}

function computeDaysOnMarket(listedDate: { toDate?: () => Date } | null | undefined): number | null {
  if (!listedDate || typeof listedDate.toDate !== 'function') return null;
  const listed = listedDate.toDate();
  const now = new Date();
  return Math.floor((now.getTime() - listed.getTime()) / (1000 * 60 * 60 * 24));
}

// =============================================================================
// 🏢 COMPONENT
// =============================================================================

export function SalesUnitListCard({
  unit,
  isSelected = false,
  onSelect,
  compact = true,
  className,
}: SalesUnitListCardProps) {
  const { t } = useTranslation('common');

  const commercialStatus = unit.commercialStatus ?? 'unavailable';
  const hasCommercialStatus = !!unit.commercialStatus;
  const badgeConfig = COMMERCIAL_STATUS_BADGE[commercialStatus];

  // Badge — units without commercialStatus show "Νέα" (not "unavailable")
  const badges = useMemo(() => [{
    label: hasCommercialStatus
      ? t(badgeConfig.labelKey, { defaultValue: commercialStatus })
      : t('sales.commercialStatus.new', { defaultValue: 'Νέα' }),
    variant: hasCommercialStatus ? badgeConfig.variant : ('outline' as BadgeVariant),
  }], [t, badgeConfig, commercialStatus, hasCommercialStatus]);

  // Row 2: Physical stats
  const area = unit.areas?.gross ?? unit.area ?? 0;
  const physicalStats = useMemo(() => [
    {
      icon: NAVIGATION_ENTITIES.unit.icon,
      iconColor: 'text-teal-600',
      label: t(`sales.unitTypes.${unit.type}`, { defaultValue: unit.type }),
      value: '',
    },
    {
      icon: NAVIGATION_ENTITIES.area?.icon ?? Calculator,
      iconColor: 'text-pink-600',
      label: `${area} m²`,
      value: '',
    },
    ...(unit.floor !== undefined ? [{
      icon: NAVIGATION_ENTITIES.floor?.icon ?? Calendar,
      iconColor: 'text-orange-600',
      label: `${unit.floor}ος`,
      value: '',
    }] : []),
  ], [t, unit.type, area, unit.floor]);

  // Row 3: Commercial stats
  const askingPrice = unit.commercial?.askingPrice;
  const pricePerSqm = askingPrice && area > 0 ? Math.round(askingPrice / area) : null;
  const daysOnMarket = computeDaysOnMarket(unit.commercial?.listedDate);

  const commercialStats = useMemo(() => {
    const stats = [
      {
        icon: DollarSign,
        iconColor: 'text-green-600',
        label: formatCurrency(askingPrice),
        value: '',
      },
    ];

    if (pricePerSqm) {
      stats.push({
        icon: Calculator,
        iconColor: 'text-blue-600',
        label: `${formatCurrency(pricePerSqm)}/m²`,
        value: '',
      });
    }

    if (daysOnMarket !== null) {
      stats.push({
        icon: Calendar,
        iconColor: 'text-gray-500',
        label: `${daysOnMarket} ${t('sales.daysOnMarket', { defaultValue: 'ημέρες' })}`,
        value: '',
      });
    }

    return stats;
  }, [askingPrice, pricePerSqm, daysOnMarket, t]);

  // Row 4: Conditional (reserved only — buyer + deposit)
  const isReserved = commercialStatus === 'reserved';
  const buyerStats = useMemo(() => {
    if (!isReserved) return undefined;
    const stats = [];

    if (unit.commercial?.buyerContactId) {
      stats.push({
        icon: User,
        iconColor: 'text-violet-600',
        label: t('sales.buyer', { defaultValue: 'Αγοραστής' }),
        value: '',
      });
    }

    if (unit.commercial?.reservationDeposit) {
      stats.push({
        icon: CreditCard,
        iconColor: 'text-amber-600',
        label: formatCurrency(unit.commercial.reservationDeposit),
        value: '',
      });
    }

    return stats.length > 0 ? stats : undefined;
  }, [isReserved, unit.commercial, t]);

  // Combine all stats
  const allStats = useMemo(() => {
    const combined = [...physicalStats, ...commercialStats];
    if (buyerStats) combined.push(...buyerStats);
    return combined;
  }, [physicalStats, commercialStats, buyerStats]);

  return (
    <ListCard
      title={unit.name || unit.code || unit.id}
      badges={badges}
      stats={allStats}
      compact={compact}
      hideIcon
      inlineBadges
      hoverVariant="standard"
      isSelected={isSelected}
      onClick={() => onSelect?.(unit.id)}
      role="option"
      entityType="unit"
      className={className}
    />
  );
}
