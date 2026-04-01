'use client';

/**
 * @fileoverview Sales Property List Card — ADR-197
 * @description Domain card for properties in sales context — extends ListCard molecule
 * @pattern Same as PropertyListCard but with commercial data prominent
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
import { formatCurrencyWhole } from '@/lib/intl-utils';
import type { Property, CommercialStatus } from '@/types/property';
import type { PropertyOwnerEntry } from '@/types/ownership-table';
import { formatOwnerNames, getPrimaryBuyerContactId } from '@/lib/ownership/owner-utils';
import '@/lib/design-system';

// =============================================================================
// 🏢 TYPES
// =============================================================================

interface SalesPropertyListCardProps {
  unit: Property;
  isSelected?: boolean;
  onSelect?: (propertyId: string) => void;
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

function computeDaysOnMarket(listedDate: { toDate?: () => Date } | null | undefined): number | null {
  if (!listedDate || typeof listedDate.toDate !== 'function') return null;
  const listed = listedDate.toDate();
  const now = new Date();
  return Math.floor((now.getTime() - listed.getTime()) / (1000 * 60 * 60 * 24));
}

// =============================================================================
// 🏢 COMPONENT
// =============================================================================

export function SalesPropertyListCard({
  unit,
  isSelected = false,
  onSelect,
  compact = true,
  className,
}: SalesPropertyListCardProps) {
  const { t } = useTranslation('common');

  const commercialStatus = unit.commercialStatus ?? 'unavailable';
  const hasCommercialStatus = !!unit.commercialStatus;
  const badgeConfig = COMMERCIAL_STATUS_BADGE[commercialStatus] ?? COMMERCIAL_STATUS_BADGE['unavailable'];

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
      icon: NAVIGATION_ENTITIES.property.icon,
      iconColor: 'text-teal-600',
      label: t('sales.fields.type', { defaultValue: 'Τύπος' }),
      value: t(`units:types.${unit.type}`, { defaultValue: unit.type }),
    },
    {
      icon: NAVIGATION_ENTITIES.area?.icon ?? Calculator,
      iconColor: 'text-pink-600',
      label: t('sales.fields.area', { defaultValue: 'Εμβαδόν' }),
      value: `${area} m²`,
    },
    ...(unit.floor !== undefined ? [{
      icon: NAVIGATION_ENTITIES.floor?.icon ?? Calendar,
      iconColor: 'text-orange-600',
      label: t('sales.fields.floor', { defaultValue: 'Όροφος' }),
      value: `${unit.floor}ος`,
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
        label: t('sales.fields.askingPrice', { defaultValue: 'Τιμή' }),
        value: formatCurrencyWhole(askingPrice),
      },
    ];

    if (pricePerSqm) {
      stats.push({
        icon: Calculator,
        iconColor: 'text-blue-600',
        label: t('sales.fields.pricePerSqm', { defaultValue: '€/m²' }),
        value: `${formatCurrencyWhole(pricePerSqm)}/m²`,
      });
    }

    if (daysOnMarket !== null) {
      stats.push({
        icon: Calendar,
        iconColor: 'text-gray-500',
        label: t('sales.fields.daysOnMarket', { defaultValue: 'Ημέρες' }),
        value: `${daysOnMarket} ${t('sales.daysOnMarket', { defaultValue: 'ημέρες' })}`,
      });
    }

    return stats;
  }, [askingPrice, pricePerSqm, daysOnMarket, t]);

  // Row 4: Conditional (reserved or sold — buyer + deposit)
  const isReserved = commercialStatus === 'reserved';
  const isSold = commercialStatus === 'sold';
  const showBuyerSection = isReserved || isSold;

  // ADR-244: Derive buyer info from owners[] SSoT
  const propertyOwners = (unit.commercial?.owners as PropertyOwnerEntry[] | null) ?? [];
  const resolvedBuyerName = formatOwnerNames(propertyOwners);
  const primaryBuyerContactId = getPrimaryBuyerContactId(propertyOwners);

  const buyerStats = useMemo(() => {
    if (!showBuyerSection) return undefined;
    const stats = [];

    // Αγοραστής — reserved & sold (ADR-244: from owners[])
    if (primaryBuyerContactId) {
      stats.push({
        icon: User,
        iconColor: 'text-violet-600',
        label: t('sales.fields.buyer', { defaultValue: 'Αγοραστής' }),
        value: resolvedBuyerName ?? t('sales.fields.unknownBuyer', { defaultValue: '...' }),
      });
    }

    // Προκαταβολή — μόνο σε reserved (σε sold δεν ενδιαφέρει πλέον)
    if (isReserved && unit.commercial?.reservationDeposit) {
      stats.push({
        icon: CreditCard,
        iconColor: 'text-amber-600',
        label: t('sales.fields.deposit', { defaultValue: 'Προκαταβολή' }),
        value: formatCurrencyWhole(unit.commercial.reservationDeposit),
      });
    }

    // Τελική τιμή — μόνο σε sold
    if (isSold && unit.commercial?.finalPrice) {
      stats.push({
        icon: DollarSign,
        iconColor: 'text-blue-600',
        label: t('sales.fields.finalPrice', { defaultValue: 'Τελική τιμή' }),
        value: formatCurrencyWhole(unit.commercial.finalPrice),
      });
    }

    return stats.length > 0 ? stats : undefined;
  }, [showBuyerSection, isReserved, isSold, unit.commercial, resolvedBuyerName, t]);

  // Combine all stats
  const allStats = useMemo(() => {
    const combined = [...physicalStats, ...commercialStats];
    if (buyerStats) combined.push(...buyerStats);
    return combined;
  }, [physicalStats, commercialStats, buyerStats]);

  return (
    <ListCard
      title={unit.name || unit.code || unit.id}
      subtitle={unit.code ? `${unit.code}` : undefined}
      badges={badges}
      stats={allStats}
      compact={compact}
      hideIcon
      inlineBadges
      hoverVariant="standard"
      isSelected={isSelected}
      onClick={() => onSelect?.(unit.id)}
      role="option"
      entityType="property"
      className={className}
    />
  );
}
