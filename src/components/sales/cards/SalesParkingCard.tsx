'use client';

/**
 * @fileoverview Sales Parking List Card — ADR-199
 * @description Card for parking spots in sales context — extends ListCard molecule
 * @pattern Same as SalesUnitListCard but with parking-specific data
 */

import React, { useMemo } from 'react';
import { DollarSign, Calculator, MapPin, Car } from 'lucide-react';
import { ListCard } from '@/design-system/components/ListCard/ListCard';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { ParkingSpot } from '@/types/parking';

// =============================================================================
// 🏢 TYPES
// =============================================================================

interface SalesParkingCardProps {
  spot: ParkingSpot;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  compact?: boolean;
  className?: string;
}

// =============================================================================
// 🏢 STATUS → BADGE VARIANT MAPPING
// =============================================================================

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info';

const STATUS_BADGE: Record<string, { variant: BadgeVariant; labelKey: string }> = {
  available:   { variant: 'success',     labelKey: 'parking:status.available' },
  occupied:    { variant: 'info',        labelKey: 'parking:status.occupied' },
  reserved:    { variant: 'warning',     labelKey: 'parking:status.reserved' },
  sold:        { variant: 'destructive', labelKey: 'parking:status.sold' },
  maintenance: { variant: 'secondary',   labelKey: 'parking:status.maintenance' },
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

// =============================================================================
// 🏢 COMPONENT
// =============================================================================

export function SalesParkingCard({
  spot,
  isSelected = false,
  onSelect,
  compact = true,
  className,
}: SalesParkingCardProps) {
  const { t } = useTranslation('common');

  const status = spot.status ?? 'available';
  const badgeConfig = STATUS_BADGE[status] ?? STATUS_BADGE.available;

  const badges = useMemo(() => [{
    label: t(badgeConfig.labelKey, { defaultValue: status }),
    variant: badgeConfig.variant,
  }], [t, badgeConfig, status]);

  const price = spot.commercial?.askingPrice ?? spot.price ?? 0;
  const area = spot.area ?? 0;

  const stats = useMemo(() => {
    const items = [
      {
        icon: Car,
        iconColor: 'text-blue-600',
        label: t('parking:general.fields.type', { defaultValue: 'Τύπος' }),
        value: t(`parking:types.${spot.type ?? 'standard'}`, { defaultValue: spot.type ?? 'standard' }),
      },
      {
        icon: MapPin,
        iconColor: 'text-orange-600',
        label: t('parking:general.fields.locationZone', { defaultValue: 'Ζώνη' }),
        value: spot.locationZone
          ? t(`parking:locationZone.${spot.locationZone}`, { defaultValue: spot.locationZone })
          : '—',
      },
      {
        icon: DollarSign,
        iconColor: 'text-green-600',
        label: t('parking:general.fields.price', { defaultValue: 'Τιμή' }),
        value: formatCurrency(price > 0 ? price : null),
      },
    ];

    if (area > 0) {
      items.push({
        icon: Calculator,
        iconColor: 'text-pink-600',
        label: t('parking:general.fields.area', { defaultValue: 'Εμβαδόν' }),
        value: `${area} m²`,
      });
    }

    return items;
  }, [t, spot.type, spot.locationZone, price, area]);

  return (
    <ListCard
      title={spot.number || spot.id}
      subtitle={spot.floor ? `${t('parking:general.fields.floor', { defaultValue: 'Επίπεδο' })}: ${spot.floor}` : undefined}
      badges={badges}
      stats={stats}
      compact={compact}
      hideIcon
      inlineBadges
      hoverVariant="standard"
      isSelected={isSelected}
      onClick={() => onSelect?.(spot.id)}
      role="option"
      entityType="parking"
      className={className}
    />
  );
}
